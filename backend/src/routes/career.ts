import express, { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { AuthenticatedRequest, authenticate, requireAdmin } from '../middleware/auth';
import { InternCertificate } from '../models/InternCertificate';
import { CertificateAsset } from '../models/CertificateAsset';
import { createSafeRegex } from '../utils/regex';

const router = express.Router();

// ── Directories ───────────────────────────────────────────────────────────────
const certDir  = path.join(process.cwd(), 'uploads', 'certificates');
const qrDir    = path.join(certDir, 'qr');
const pdfDir   = path.join(certDir, 'pdf');
const assetDir = path.join(certDir, 'assets');
[certDir, qrDir, pdfDir, assetDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// Fixed asset filenames — always overwrite so the path never changes
const ASSET_FILENAMES: Record<string, string> = {
  companyLogo:      'company-logo.png',
  founderSignature: 'founder-signature.png',
  companySeal:      'company-seal.png',
};

// Processed (background-removed) signature — transparent PNG used in PDF
const PROCESSED_SIGNATURE_FILENAME = 'founder-signature-processed.png';

// Multer: store with fixed filename (overwrites previous upload)
const assetStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, assetDir),
  filename: (_req, file, cb) => {
    const fixed = ASSET_FILENAMES[file.fieldname];
    cb(null, fixed || `${file.fieldname}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`);
  },
});
const assetUpload = multer({
  storage: assetStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
});

// ── Signature background removal ─────────────────────────────────────────────
//
// Algorithm:
//   1. Decode the raw PNG/JPEG to RGBA pixel buffer via sharp.
//   2. Walk every pixel: if it is "white-ish" (all RGB channels ≥ threshold)
//      set alpha = 0 (fully transparent).
//   3. For pixels near the edge of ink areas, blend alpha proportionally
//      (anti-aliasing) so the ink boundary is smooth rather than jagged.
//   4. Re-encode as PNG with full alpha channel and save with a fixed name.
//
async function processSignatureBackground(inputPath: string): Promise<string> {
  const outputPath = path.join(assetDir, PROCESSED_SIGNATURE_FILENAME);

  // Decode to raw RGBA
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()          // guarantee 4-channel RGBA
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info; // channels === 4
  const buf = Buffer.from(data);            // mutable copy

  // Thresholds — tune here if needed
  const WHITE_THRESHOLD  = 210; // pixels with R,G,B all ≥ this are considered background
  const SOFT_THRESHOLD   = 240; // pixels above this get full transparency (hard white)
  const EDGE_FEATHER_PX  = 2;   // radius for anti-aliased edge softening

  // Pass 1 — mark background pixels (alpha = 0) and near-white pixels (partial alpha)
  for (let i = 0; i < width * height; i++) {
    const base = i * channels;
    const r = buf[base];
    const g = buf[base + 1];
    const b = buf[base + 2];

    const brightness = Math.min(r, g, b); // use min channel to preserve coloured ink

    if (brightness >= SOFT_THRESHOLD) {
      // Fully white — transparent
      buf[base + 3] = 0;
    } else if (brightness >= WHITE_THRESHOLD) {
      // Near-white — proportional fade for smooth edge
      const t = (brightness - WHITE_THRESHOLD) / (SOFT_THRESHOLD - WHITE_THRESHOLD);
      buf[base + 3] = Math.round((1 - t) * 255);
    }
    // Ink pixels (brightness < WHITE_THRESHOLD) keep alpha = 255 (fully opaque)
  }

  // Pass 2 — feather edges: for each ink pixel adjacent to a transparent pixel,
  // slightly reduce its alpha to create a 1-2px anti-aliased fringe.
  const alphaMap = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) alphaMap[i] = buf[i * channels + 3];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx  = y * width + x;
      const base = idx * channels;
      if (alphaMap[idx] === 0) continue; // already transparent

      // Check neighbours within feather radius
      let minNeighbourAlpha = 255;
      for (let dy = -EDGE_FEATHER_PX; dy <= EDGE_FEATHER_PX; dy++) {
        for (let dx = -EDGE_FEATHER_PX; dx <= EDGE_FEATHER_PX; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const nAlpha = alphaMap[ny * width + nx];
          if (nAlpha < minNeighbourAlpha) minNeighbourAlpha = nAlpha;
        }
      }

      if (minNeighbourAlpha < 255) {
        // Blend current pixel alpha toward the neighbour's alpha for smooth edge
        const featherFactor = minNeighbourAlpha / 255;
        buf[base + 3] = Math.round(buf[base + 3] * (0.5 + 0.5 * featherFactor));
      }
    }
  }

  // Re-encode as PNG (lossless, preserves transparency)
  await sharp(buf, { raw: { width, height, channels } })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputPath);

  return outputPath;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function generateCertificateNumber(): Promise<string> {
  const year   = new Date().getFullYear();
  const prefix = `AKP-INT-${year}-`;
  const last   = await InternCertificate.findOne(
    { certificateNumber: { $regex: `^${prefix}` } },
    { certificateNumber: 1 },
    { sort: { certificateNumber: -1 } }
  ).lean();
  const seq = last ? parseInt(last.certificateNumber.split('-').pop()!, 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(6, '0')}`;
}

function buildDescription(name: string, domain: string, start: Date, end: Date): string {
  const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  return `This certificate is proudly presented to ${name} in recognition of the successful completion of the internship at AgroUdan Kisan Pragati LLP in the field of ${domain}. During the internship period from ${fmt(start)} to ${fmt(end)}, the intern demonstrated dedication, professionalism, willingness to learn, and valuable contributions towards assigned projects. We sincerely appreciate their efforts and wish them continued success in their future career.`;
}

// ONE QR per certificate — always points to the single verification URL
async function generateQR(certNumber: string, frontendUrl: string): Promise<string> {
  const verifyUrl = `${frontendUrl}/verify/certificate/${certNumber}`;
  const filename  = `qr-${certNumber}.png`;
  const filePath  = path.join(qrDir, filename);
  await QRCode.toFile(filePath, verifyUrl, { width: 220, margin: 2, color: { dark: '#000000', light: '#ffffff' } });
  return `/uploads/certificates/qr/${filename}`;
}

// Resolve fixed asset path from DB record (falls back to fixed filename on disk)
function resolveAssetPath(dbUrl: string | undefined, fieldname: string): string | null {
  // Always prefer the fixed-filename file on disk (latest upload)
  const fixedPath = path.join(assetDir, ASSET_FILENAMES[fieldname] || '');
  if (fs.existsSync(fixedPath)) return fixedPath;
  // Fallback: path stored in DB
  if (dbUrl) {
    const p = path.join(process.cwd(), dbUrl);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Resolve the processed (transparent) signature — falls back to raw if not yet processed
function resolveProcessedSignaturePath(): string | null {
  const processed = path.join(assetDir, PROCESSED_SIGNATURE_FILENAME);
  if (fs.existsSync(processed)) return processed;
  // Fallback to raw signature if processing hasn't run yet
  const raw = path.join(assetDir, ASSET_FILENAMES.founderSignature);
  if (fs.existsSync(raw)) return raw;
  return null;
}

async function generatePDF(cert: any, assets: any, frontendUrl: string): Promise<string> {
  const filename = `cert-${cert.certificateNumber}.pdf`;
  const filePath = path.join(pdfDir, filename);

  // ── Design tokens ────────────────────────────────────────────────────────
  // Premium light certificate palette
  const C = {
    paper:       '#FDFBF4',   // warm ivory — certificate paper
    paperEdge:   '#F5F0E8',   // slightly darker ivory for subtle depth
    green:       '#1a6b3a',   // AgroUdaan deep green
    greenLight:  '#2d8a50',   // mid green for accents
    greenPale:   '#e8f5ee',   // very pale green tint for header band
    gold:        '#B8860B',   // dark gold for double-border accent
    goldLight:   '#D4A843',   // lighter gold for inner border
    textDark:    '#1a1a1a',   // near-black body text
    textMid:     '#3d3d3d',   // dark grey for secondary text
    textLight:   '#6b6b6b',   // medium grey for labels
    textFaint:   '#999999',   // light grey for captions
    divider:     '#c8b97a',   // warm gold divider
  };

  // ── Pre-resolve signature dimensions BEFORE opening the PDF stream ───────
  const sigPath = resolveProcessedSignaturePath();
  let sigDrawW = 0, sigDrawH = 0, sigOffsetX = 0, sigOffsetY = 0;
  if (sigPath) {
    try {
      const sigMeta = await sharp(sigPath).metadata();
      const sigW    = sigMeta.width  || 300;
      const sigH    = sigMeta.height || 100;
      const maxW    = 140;
      const maxH    = 52;
      const scale   = Math.min(maxW / sigW, maxH / sigH);
      sigDrawW      = Math.round(sigW * scale);
      sigDrawH      = Math.round(sigH * scale);
      sigOffsetX    = Math.round((maxW - sigDrawW) / 2);
      sigOffsetY    = Math.round((maxH - sigDrawH) / 2);
    } catch { /* no signature — skip */ }
  }

  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0, info: {
      Title:   `Internship Certificate — ${cert.name}`,
      Author:  'AgroUdaan Kisan Pragati LLP',
      Subject: 'Internship Certificate',
    }});
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const W   = doc.page.width;    // 841.89 pt  (A4 landscape)
    const H   = doc.page.height;   // 595.28 pt
    const midX = W / 2;

    // ════════════════════════════════════════════════════════════════════════
    // 1. PAPER BACKGROUND
    // ════════════════════════════════════════════════════════════════════════
    doc.rect(0, 0, W, H).fill(C.paper);

    // Subtle vignette — four thin gradient-like edge strips to simulate paper depth
    // (PDFKit has no gradients, so we layer semi-transparent rectangles)
    const vigW = 18;
    doc.rect(0,       0, vigW, H).fill(C.paperEdge);
    doc.rect(W-vigW,  0, vigW, H).fill(C.paperEdge);
    doc.rect(0,       0, W, vigW).fill(C.paperEdge);
    doc.rect(0, H-vigW, W, vigW).fill(C.paperEdge);

    // ════════════════════════════════════════════════════════════════════════
    // 2. DOUBLE-LINE DECORATIVE BORDER  (gold outer + green inner)
    // ════════════════════════════════════════════════════════════════════════
    const bOuter = 10;   // outer gold border inset from page edge
    const bInner = 16;   // inner green border inset from page edge
    const bInner2 = 19;  // second thin inner line

    // Outer gold border — 2 pt
    doc.rect(bOuter, bOuter, W - bOuter*2, H - bOuter*2)
       .lineWidth(2).stroke(C.gold);

    // Inner green border — 1 pt
    doc.rect(bInner, bInner, W - bInner*2, H - bInner*2)
       .lineWidth(1).stroke(C.green);

    // Second inner hairline — 0.4 pt (creates the classic double-line look)
    doc.rect(bInner2, bInner2, W - bInner2*2, H - bInner2*2)
       .lineWidth(0.4).stroke(C.goldLight);

    // ════════════════════════════════════════════════════════════════════════
    // 3. CORNER ORNAMENTS  (four small diamond/cross marks at each corner)
    // ════════════════════════════════════════════════════════════════════════
    const corners = [
      [bOuter + 2, bOuter + 2],
      [W - bOuter - 2, bOuter + 2],
      [bOuter + 2, H - bOuter - 2],
      [W - bOuter - 2, H - bOuter - 2],
    ] as [number, number][];
    corners.forEach(([cx, cy]) => {
      const s = 5;
      doc.moveTo(cx, cy - s).lineTo(cx, cy + s).lineWidth(1).stroke(C.gold);
      doc.moveTo(cx - s, cy).lineTo(cx + s, cy).lineWidth(1).stroke(C.gold);
      doc.circle(cx, cy, 2).fill(C.gold);
    });

    // ════════════════════════════════════════════════════════════════════════
    // 4. HEADER BAND  (pale green wash — not a solid dark block)
    // ════════════════════════════════════════════════════════════════════════
    const headerH = 82;
    doc.rect(bInner2 + 1, bInner2 + 1, W - (bInner2+1)*2, headerH - bInner2)
       .fill(C.greenPale);

    // Thin gold rule under header band
    const headerBottom = headerH + 4;
    doc.moveTo(bInner2 + 8, headerBottom)
       .lineTo(W - bInner2 - 8, headerBottom)
       .lineWidth(0.8).stroke(C.gold);

    // Company logo — left of header
    const logoPath = resolveAssetPath(assets?.companyLogo, 'companyLogo');
    if (logoPath) {
      try { doc.image(logoPath, 30, 18, { width: 52, height: 52 }); } catch {}
    }

    // Company name — centered in header
    doc.fillColor(C.green).fontSize(19).font('Helvetica-Bold')
       .text('AgroUdaan Kisan Pragati LLP', 90, 24, { align: 'center', width: W - 180 });

    // Thin gold rule under company name
    doc.moveTo(midX - 160, 48).lineTo(midX + 160, 48)
       .lineWidth(0.5).stroke(C.goldLight);

    // Tagline
    doc.fillColor(C.textLight).fontSize(8.5).font('Helvetica')
       .text('Empowering Farmers · Empowering India', 90, 52, { align: 'center', width: W - 180, characterSpacing: 0.6 });

    // ════════════════════════════════════════════════════════════════════════
    // 5. CERTIFICATE TITLE
    // ════════════════════════════════════════════════════════════════════════
    const titleY = headerBottom + 14;

    doc.fillColor(C.green).fontSize(22).font('Helvetica-Bold')
       .text('CERTIFICATE OF INTERNSHIP', 0, titleY, { align: 'center', width: W, characterSpacing: 2.5 });

    // Gold ornamental rule pair flanking the title
    const ruleY = titleY + 28;
    const ruleLen = 200;
    // Left rule
    doc.moveTo(midX - ruleLen - 10, ruleY).lineTo(midX - 14, ruleY)
       .lineWidth(1.2).stroke(C.gold);
    doc.moveTo(midX - ruleLen - 10, ruleY + 3).lineTo(midX - 14, ruleY + 3)
       .lineWidth(0.3).stroke(C.goldLight);
    // Right rule
    doc.moveTo(midX + 14, ruleY).lineTo(midX + ruleLen + 10, ruleY)
       .lineWidth(1.2).stroke(C.gold);
    doc.moveTo(midX + 14, ruleY + 3).lineTo(midX + ruleLen + 10, ruleY + 3)
       .lineWidth(0.3).stroke(C.goldLight);
    // Centre diamond
    doc.circle(midX, ruleY + 1.5, 3.5).fill(C.gold);

    // ════════════════════════════════════════════════════════════════════════
    // 6. BODY — certify text + recipient name
    // ════════════════════════════════════════════════════════════════════════
    const bodyStartY = ruleY + 14;

    doc.fillColor(C.textLight).fontSize(10).font('Helvetica')
       .text('This is to certify that', 0, bodyStartY, { align: 'center', width: W, characterSpacing: 0.4 });

    // Recipient name — large, dark, prominent
    doc.fillColor(C.textDark).fontSize(28).font('Helvetica-Bold')
       .text(cert.name, 0, bodyStartY + 14, { align: 'center', width: W });

    // Thin underline beneath name
    const nameUnderY = bodyStartY + 50;
    doc.moveTo(midX - 140, nameUnderY).lineTo(midX + 140, nameUnderY)
       .lineWidth(0.5).stroke(C.divider);

    // Description paragraph
    doc.fillColor(C.textMid).fontSize(8.8).font('Helvetica')
       .text(cert.certificateDescription, 60, nameUnderY + 8,
         { align: 'center', width: W - 120, lineGap: 3.2 });

    // ════════════════════════════════════════════════════════════════════════
    // 7. DETAIL GRID  (two rows × three columns)
    // ════════════════════════════════════════════════════════════════════════
    // Measure where the description text ended
    const descLines  = Math.ceil(cert.certificateDescription.length / 110);
    const detailTopY = nameUnderY + 8 + descLines * 13.5 + 10;

    // Thin full-width gold rule above detail grid
    doc.moveTo(28, detailTopY).lineTo(W - 28, detailTopY)
       .lineWidth(0.5).stroke(C.divider);

    const gridY1 = detailTopY + 8;
    const col1 = 38, col2 = W / 3 + 10, col3 = (W / 3) * 2 + 10;
    const colW  = W / 3 - 20;

    const detailCell = (label: string, value: string, x: number, y: number) => {
      doc.fillColor(C.textFaint).fontSize(6.8).font('Helvetica')
         .text(label.toUpperCase(), x, y, { width: colW, characterSpacing: 0.8 });
      doc.fillColor(C.textDark).fontSize(10).font('Helvetica-Bold')
         .text(value, x, y + 10, { width: colW });
    };

    detailCell('College / University', cert.collegeName,      col1, gridY1);
    detailCell('Internship Domain',    cert.internshipDomain, col2, gridY1);
    detailCell('Duration',             cert.duration,         col3, gridY1);

    const gridY2 = gridY1 + 34;
    detailCell('Internship Type', cert.internshipType, col1, gridY2);
    detailCell('Issue Date',
      new Date(cert.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }),
      col2, gridY2);
    detailCell('Certificate No.', cert.certificateNumber, col3, gridY2);

    // Thin full-width gold rule below detail grid
    const gridBottomY = gridY2 + 30;
    doc.moveTo(28, gridBottomY).lineTo(W - 28, gridBottomY)
       .lineWidth(0.5).stroke(C.divider);

    // ════════════════════════════════════════════════════════════════════════
    // 8. SIGNATURE / SEAL / QR  ROW
    //    Layout (left → right):
    //      [Signature + designation]  |  [Company Seal]  |  [QR Code]
    // ════════════════════════════════════════════════════════════════════════
    const rowY    = gridBottomY + 8;
    const rowH    = H - rowY - 28;   // available height before footer

    // ── 8a. Founder Signature (left column) ─────────────────────────────────
    const sigColX = col1;
    const sigColW = 160;

    if (sigPath && sigDrawW > 0) {
      try {
        // Centre within column, vertically centred in upper 60% of row
        const drawX = sigColX + Math.round((sigColW - sigDrawW) / 2);
        const drawY = rowY + Math.round(((rowH * 0.6) - sigDrawH) / 2);
        doc.image(sigPath, drawX, drawY, { width: sigDrawW, height: sigDrawH });
      } catch {}
    }

    // Signature underline
    const sigLineY = rowY + Math.round(rowH * 0.62);
    doc.moveTo(sigColX, sigLineY).lineTo(sigColX + sigColW, sigLineY)
       .lineWidth(0.6).stroke(C.textLight);

    // Designation text — centred under line
    doc.fillColor(C.textMid).fontSize(7.5).font('Helvetica-Bold')
       .text('Founder & Director', sigColX, sigLineY + 4, { width: sigColW, align: 'center' });
    doc.fillColor(C.green).fontSize(7.5).font('Helvetica-Bold')
       .text('AgroUdaan Kisan Pragati LLP', sigColX, sigLineY + 14, { width: sigColW, align: 'center' });

    // ── 8b. Company Seal (centre column) ────────────────────────────────────
    const sealPath = resolveAssetPath(assets?.companySeal, 'companySeal');
    const sealSize = Math.min(rowH - 4, 72);
    const sealX    = midX - sealSize / 2;
    const sealY    = rowY + Math.round((rowH - sealSize) / 2);
    if (sealPath) {
      try { doc.image(sealPath, sealX, sealY, { width: sealSize, height: sealSize }); } catch {}
    }

    // ── 8c. QR Code (right column) ───────────────────────────────────────────
    const qrSize  = Math.min(rowH - 4, 72);
    const qrX     = W - 28 - qrSize;
    const qrY     = rowY + Math.round((rowH - qrSize) / 2);
    const qrPath  = path.join(process.cwd(), cert.qrCodeUrl);
    if (fs.existsSync(qrPath)) {
      // White background tile behind QR so it scans cleanly on any printer
      doc.rect(qrX - 3, qrY - 3, qrSize + 6, qrSize + 6)
         .fill('#ffffff');
      doc.image(qrPath, qrX, qrY, { width: qrSize, height: qrSize });
      doc.fillColor(C.textFaint).fontSize(6).font('Helvetica')
         .text('Scan to verify', qrX - 3, qrY + qrSize + 4, { width: qrSize + 6, align: 'center' });
    }

    // ════════════════════════════════════════════════════════════════════════
    // 9. FOOTER BAR
    // ════════════════════════════════════════════════════════════════════════
    const footerY = H - 24;
    // Thin gold rule above footer text
    doc.moveTo(28, footerY - 4).lineTo(W - 28, footerY - 4)
       .lineWidth(0.4).stroke(C.goldLight);

    doc.fillColor(C.textFaint).fontSize(6.5).font('Helvetica')
       .text(
         `Verify at: ${frontendUrl}/verify/certificate/${cert.certificateNumber}   ·   Certificate No: ${cert.certificateNumber}   ·   AgroUdaan Kisan Pragati LLP`,
         28, footerY, { align: 'center', width: W - 56, characterSpacing: 0.2 }
       );

    doc.end();
    stream.on('finish', () => resolve(`/uploads/certificates/pdf/${filename}`));
    stream.on('error', reject);
  });
}

// ── PUBLIC: Verify certificate (no auth) ─────────────────────────────────────

router.get('/verify/:certificateNumber', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cert = await InternCertificate.findOne({
      certificateNumber: req.params.certificateNumber,
      status: 'active',
    }).lean();
    if (!cert) return res.status(404).json({ success: false, error: 'Certificate not found' });
    res.json({ success: true, data: cert });
  } catch {
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

// ── ADMIN: Stats ──────────────────────────────────────────────────────────────

router.get('/admin/stats', authenticate, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const [total, paid, unpaid, generated] = await Promise.all([
      InternCertificate.countDocuments(),
      InternCertificate.countDocuments({ internshipType: 'Paid' }),
      InternCertificate.countDocuments({ internshipType: 'Unpaid' }),
      InternCertificate.countDocuments({ pdfUrl: { $ne: '' } }),
    ]);
    res.json({ success: true, data: { total, paid, unpaid, generated } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

// ── ADMIN: Get assets ─────────────────────────────────────────────────────────

router.get('/admin/assets', authenticate, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const assets = await CertificateAsset.findOne().lean();
    // Also report which fixed files actually exist on disk
    const diskStatus = {
      companyLogoExists:      fs.existsSync(path.join(assetDir, ASSET_FILENAMES.companyLogo)),
      founderSignatureExists: fs.existsSync(path.join(assetDir, ASSET_FILENAMES.founderSignature)),
      companySealExists:      fs.existsSync(path.join(assetDir, ASSET_FILENAMES.companySeal)),
    };
    res.json({ success: true, data: { ...(assets || {}), ...diskStatus } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch assets' });
  }
});

// ── ADMIN: Upload assets (fixed filenames — overwrite in place) ───────────────

router.post(
  '/admin/assets',
  authenticate,
  requireAdmin,
  assetUpload.fields([
    { name: 'companyLogo',      maxCount: 1 },
    { name: 'founderSignature', maxCount: 1 },
    { name: 'companySeal',      maxCount: 1 },
  ]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const files  = req.files as Record<string, Express.Multer.File[]>;
      const update: Record<string, string> = {};

      if (files?.companyLogo?.[0])
        update.companyLogo = `/uploads/certificates/assets/${ASSET_FILENAMES.companyLogo}`;
      if (files?.founderSignature?.[0]) {
        update.founderSignature = `/uploads/certificates/assets/${ASSET_FILENAMES.founderSignature}`;
        // Auto-process: remove white background and save transparent PNG
        try {
          const rawPath = path.join(assetDir, ASSET_FILENAMES.founderSignature);
          await processSignatureBackground(rawPath);
        } catch (procErr) {
          console.warn('[Career] Signature background removal failed (non-fatal):', procErr);
        }
      }
      if (files?.companySeal?.[0])
        update.companySeal = `/uploads/certificates/assets/${ASSET_FILENAMES.companySeal}`;

      if (!Object.keys(update).length)
        return res.status(400).json({ success: false, error: 'No files uploaded' });

      update.uploadedAt = new Date().toISOString();
      const assets = await CertificateAsset.findOneAndUpdate({}, { $set: update }, { upsert: true, new: true });
      res.json({ success: true, data: assets });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to upload assets' });
    }
  }
);

// ── ADMIN: List certificates ──────────────────────────────────────────────────

router.get('/admin/certificates', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const { search, internshipType, domain, year } = req.query as Record<string, string>;

    const filter: Record<string, any> = {};
    if (search) {
      const re = createSafeRegex(search);
      filter.$or = [{ name: re }, { certificateNumber: re }, { collegeName: re }, { internshipDomain: re }];
    }
    if (internshipType && ['Paid', 'Unpaid'].includes(internshipType)) filter.internshipType = internshipType;
    if (domain) filter.internshipDomain = createSafeRegex(domain);
    if (year) {
      const y = parseInt(year);
      filter.createdAt = { $gte: new Date(`${y}-01-01`), $lt: new Date(`${y + 1}-01-01`) };
    }

    const [data, total] = await Promise.all([
      InternCertificate.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      InternCertificate.countDocuments(filter),
    ]);

    res.json({ success: true, data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch certificates' });
  }
});

// ── ADMIN: Get single certificate ─────────────────────────────────────────────

router.get('/admin/certificates/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cert = await InternCertificate.findById(req.params.id).lean();
    if (!cert) return res.status(404).json({ success: false, error: 'Certificate not found' });
    res.json({ success: true, data: cert });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch certificate' });
  }
});

// ── ADMIN: Create certificate ─────────────────────────────────────────────────

router.post('/admin/certificates', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, collegeName, internshipDomain, internshipType, duration, startDate, endDate, email, phone, remarks } = req.body;

    if (!name || !collegeName || !internshipDomain || !internshipType || !duration || !startDate || !endDate)
      return res.status(400).json({ success: false, error: 'Missing required fields' });

    const frontendUrl       = process.env.FRONTEND_URL || 'http://localhost:3000';
    const internId          = uuidv4();
    const certificateNumber = await generateCertificateNumber();
    const start             = new Date(startDate);
    const end               = new Date(endDate);
    const description       = buildDescription(name, internshipDomain, start, end);
    const verificationUrl   = `${frontendUrl}/verify/certificate/${certificateNumber}`;

    // Single QR — generated once, points to verification URL
    const qrCodeUrl = await generateQR(certificateNumber, frontendUrl);

    const cert = await InternCertificate.create({
      internId, certificateNumber, name, collegeName, internshipDomain,
      internshipType, duration, startDate: start, endDate: end,
      email: email || '', phone: phone || '', remarks: remarks || '',
      certificateDescription: description, verificationUrl, qrCodeUrl, pdfUrl: '',
    });

    const assets = await CertificateAsset.findOne().lean();
    cert.pdfUrl  = await generatePDF(cert.toObject(), assets, frontendUrl);
    await cert.save();

    res.status(201).json({ success: true, data: cert });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to create certificate' });
  }
});

// ── ADMIN: Regenerate (reuses same QR, regenerates PDF with latest assets) ────

router.post('/admin/certificates/:id/regenerate', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cert = await InternCertificate.findById(req.params.id);
    if (!cert) return res.status(404).json({ success: false, error: 'Certificate not found' });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    // QR already exists — only regenerate if file is missing
    const qrFilePath = path.join(process.cwd(), cert.qrCodeUrl);
    if (!fs.existsSync(qrFilePath)) {
      cert.qrCodeUrl = await generateQR(cert.certificateNumber, frontendUrl);
    }

    const assets = await CertificateAsset.findOne().lean();
    cert.pdfUrl  = await generatePDF(cert.toObject(), assets, frontendUrl);
    await cert.save();

    res.json({ success: true, data: cert });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to regenerate' });
  }
});

// ── ADMIN: Delete certificate ─────────────────────────────────────────────────

router.delete('/admin/certificates/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cert = await InternCertificate.findByIdAndDelete(req.params.id);
    if (!cert) return res.status(404).json({ success: false, error: 'Certificate not found' });

    [cert.qrCodeUrl, cert.pdfUrl].forEach(url => {
      if (url?.startsWith('/uploads/')) {
        const fp = path.join(process.cwd(), url);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
    });

    res.json({ success: true, message: 'Certificate deleted' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete certificate' });
  }
});

export default router;
