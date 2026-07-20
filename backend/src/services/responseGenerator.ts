/**
 * Response Generator
 *
 * Generates structured, farmer-friendly responses from KB data.
 * Handles all required fields for disease responses:
 *   cause, symptoms, severity, confidence, organic treatment,
 *   chemical treatment, prevention, fertilizer, irrigation,
 *   warnings, next steps
 *
 * Also handles low-confidence responses:
 *   - Asks for crop name if missing
 *   - Asks for location if missing
 *   - Asks for better image if confidence < threshold
 *
 * Rules:
 * - Never fabricates data not present in KB
 * - Always returns bilingual (English + Hindi)
 * - Structured markdown output for UI rendering
 */

import { KBSearchResult } from './knowledgeBaseSearch';

// ─── Confidence thresholds ────────────────────────────────────────────────────

const LOW_CONFIDENCE_THRESHOLD  = 0.50;
const ASK_IMAGE_THRESHOLD       = 0.40;

// ─── Hindi labels ─────────────────────────────────────────────────────────────

const H = {
  disease:     'रोग/कीट',
  cause:       'कारण',
  symptoms:    'लक्षण',
  severity:    'गंभीरता',
  confidence:  'विश्वसनीयता',
  organic:     'जैविक उपचार',
  chemical:    'रासायनिक उपचार',
  prevention:  'बचाव',
  fertilizer:  'खाद सलाह',
  irrigation:  'सिंचाई सलाह',
  warnings:    'चेतावनी',
  nextSteps:   'अगले कदम',
  dos:         'करें',
  donts:       'न करें',
  recovery:    'रिकवरी टिप्स',
  askCrop:     'कृपया फसल का नाम बताएं',
  askImage:    'बेहतर पहचान के लिए फसल की स्पष्ट फोटो भेजें',
  askLocation: 'अपना जिला/राज्य बताएं',
  lowConf:     'पहचान अनिश्चित है',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bullet(items: string | string[] | undefined): string {
  if (!items) return '';
  const arr = Array.isArray(items) ? items : [items];
  return arr.filter(Boolean).map(i => `• ${i}`).join('\n');
}

function section(emoji: string, title: string, content: string | undefined): string {
  if (!content?.trim()) return '';
  return `\n**${emoji} ${title}**\n${content}`;
}

function severityEmoji(severity: string | undefined): string {
  if (!severity) return '⚠️';
  const s = severity.toLowerCase();
  if (s.includes('very high') || s.includes('critical')) return '🔴';
  if (s.includes('high'))   return '🟠';
  if (s.includes('medium')) return '🟡';
  if (s.includes('low'))    return '🟢';
  return '⚠️';
}

function confidenceBar(score: number): string {
  const pct = Math.round(score * 100);
  const bars = Math.round(pct / 10);
  return `${'█'.repeat(bars)}${'░'.repeat(10 - bars)} ${pct}%`;
}

// ─── Disease response generator ───────────────────────────────────────────────

export interface DiseaseResponseResult {
  english:    string;
  hindi:      string;
  confidence: number;
  source:     string;
  needsImage: boolean;
  needsCrop:  boolean;
}

/**
 * Generate a structured disease response from KB data.
 * Handles low confidence by asking for more information.
 */
export function generateDiseaseResponse(
  kbResult:    KBSearchResult,
  yoloConf?:   number,   // YOLO confidence 0–100
  cropName?:   string,
  hasImage?:   boolean,
): DiseaseResponseResult {
  const confidence = kbResult.confidence;
  const d = kbResult.data;

  // ── Low confidence: ask for image ────────────────────────────────────────
  if (!hasImage && !kbResult.found) {
    return {
      english: buildAskForImageResponse(cropName),
      hindi:   buildAskForImageResponseHindi(cropName),
      confidence: 0,
      source:  'none',
      needsImage: true,
      needsCrop:  !cropName,
    };
  }

  // ── Low confidence from YOLO ──────────────────────────────────────────────
  if (yoloConf !== undefined && yoloConf < ASK_IMAGE_THRESHOLD * 100) {
    return {
      english: buildLowConfidenceResponse(cropName, yoloConf),
      hindi:   buildLowConfidenceResponseHindi(cropName, yoloConf),
      confidence: yoloConf / 100,
      source:  'yolo_low_conf',
      needsImage: true,
      needsCrop:  !cropName,
    };
  }

  // ── No KB match ───────────────────────────────────────────────────────────
  if (!kbResult.found || !d.diseaseName) {
    return {
      english: buildNoMatchResponse(cropName),
      hindi:   buildNoMatchResponseHindi(cropName),
      confidence: 0,
      source:  'none',
      needsImage: !hasImage,
      needsCrop:  !cropName,
    };
  }

  // ── Full structured response ──────────────────────────────────────────────
  const sevEmoji = severityEmoji(d.severity);
  const confScore = yoloConf !== undefined ? yoloConf / 100 : confidence;

  const lines: string[] = [];

  // Header
  lines.push(`🌿 **${H.disease}: ${d.diseaseName}**`);
  if (d.cropName) lines.push(`🌾 Crop: ${d.cropName}`);

  // Confidence + Severity
  if (yoloConf !== undefined) {
    lines.push(`\n${H.confidence}: ${confidenceBar(confScore)}`);
  }
  if (d.severity) {
    lines.push(`${sevEmoji} ${H.severity}: ${d.severity}`);
  }

  // Cause
  if (d.cause) lines.push(section('🔬', H.cause, d.cause));

  // Symptoms
  if (d.symptoms) lines.push(section('👁️', H.symptoms, d.symptoms));

  // Organic treatment
  if (d.organicSolution) lines.push(section('🌿', H.organic, d.organicSolution));

  // Chemical treatment
  if (d.chemicalSolution) lines.push(section('💊', H.chemical, d.chemicalSolution));

  // Prevention
  if (d.prevention) lines.push(section('🛡️', H.prevention, d.prevention));

  // Fertilizer advice
  if (d.fertilizerAdvice) lines.push(section('🌱', H.fertilizer, d.fertilizerAdvice));

  // Irrigation advice
  if (d.irrigationAdvice) lines.push(section('💧', H.irrigation, d.irrigationAdvice));

  // Dos and Don'ts
  if (d.dos)   lines.push(section('✅', H.dos,   Array.isArray(d.dos)   ? bullet(d.dos)   : d.dos));
  if (d.donts) lines.push(section('❌', H.donts, Array.isArray(d.donts) ? bullet(d.donts) : d.donts));

  // Recovery tips
  if (d.recoveryTips) lines.push(section('💪', H.recovery, d.recoveryTips));

  // Warnings
  if (d.warnings) lines.push(section('⚠️', H.warnings, Array.isArray(d.warnings) ? bullet(d.warnings) : d.warnings));

  // Next steps
  if (d.nextSteps) {
    lines.push(section('📋', H.nextSteps, Array.isArray(d.nextSteps) ? bullet(d.nextSteps) : d.nextSteps));
  } else {
    // Default next steps
    lines.push(`\n**📋 ${H.nextSteps}**`);
    lines.push(bullet([
      'Take photos of affected plants for monitoring',
      'Apply treatment in early morning or evening',
      'Monitor for 3–5 days after treatment',
      'Contact your local KVK if condition worsens',
    ]));
  }

  // Source attribution
  if (d.source === 'admin_kb') {
    lines.push(`\n_Source: Expert-verified knowledge base_`);
  }

  const english = lines.filter(Boolean).join('\n');

  // Hindi version (structural translation of labels)
  const hindiLines: string[] = [];
  hindiLines.push(`🌿 **${H.disease}: ${d.diseaseName}**`);
  if (d.cropName) hindiLines.push(`🌾 फसल: ${d.cropName}`);
  if (yoloConf !== undefined) hindiLines.push(`\n${H.confidence}: ${confidenceBar(confScore)}`);
  if (d.severity) hindiLines.push(`${sevEmoji} ${H.severity}: ${d.severity}`);
  if (d.cause)            hindiLines.push(section('🔬', H.cause,      d.cause));
  if (d.symptoms)         hindiLines.push(section('👁️', H.symptoms,   d.symptoms));
  if (d.organicSolution)  hindiLines.push(section('🌿', H.organic,    d.organicSolution));
  if (d.chemicalSolution) hindiLines.push(section('💊', H.chemical,   d.chemicalSolution));
  if (d.prevention)       hindiLines.push(section('🛡️', H.prevention, d.prevention));
  if (d.fertilizerAdvice) hindiLines.push(section('🌱', H.fertilizer, d.fertilizerAdvice));
  if (d.irrigationAdvice) hindiLines.push(section('💧', H.irrigation, d.irrigationAdvice));
  if (d.dos)   hindiLines.push(section('✅', H.dos,   Array.isArray(d.dos)   ? bullet(d.dos)   : d.dos));
  if (d.donts) hindiLines.push(section('❌', H.donts, Array.isArray(d.donts) ? bullet(d.donts) : d.donts));
  if (d.recoveryTips) hindiLines.push(section('💪', H.recovery, d.recoveryTips));
  if (d.warnings) hindiLines.push(section('⚠️', H.warnings, Array.isArray(d.warnings) ? bullet(d.warnings) : d.warnings));
  hindiLines.push(`\n**📋 ${H.nextSteps}**`);
  hindiLines.push(bullet([
    'प्रभावित पौधों की फोटो लें',
    'सुबह या शाम को उपचार करें',
    '3-5 दिन बाद निगरानी करें',
    'स्थिति बिगड़ने पर KVK से संपर्क करें',
  ]));

  return {
    english,
    hindi:      hindiLines.filter(Boolean).join('\n'),
    confidence: confScore,
    source:     d.source || kbResult.source,
    needsImage: false,
    needsCrop:  false,
  };
}

// ─── Ask-for-more-info responses ──────────────────────────────────────────────

function buildAskForImageResponse(cropName?: string): string {
  const crop = cropName ? `your ${cropName}` : 'your crop';
  return [
    `🌿 **Disease Detection**`,
    ``,
    `To accurately identify the disease on ${crop}, please:`,
    ``,
    bullet([
      '📸 Upload a clear photo of the affected leaf or plant',
      '🌾 Make sure the image shows the disease symptoms clearly',
      '☀️ Take the photo in good lighting',
      '📍 Mention your crop name and location for better results',
    ]),
    ``,
    `You can upload an image on the **Disease Detection** page (/disease-detection).`,
  ].join('\n');
}

function buildAskForImageResponseHindi(cropName?: string): string {
  const crop = cropName ? `आपकी ${cropName}` : 'आपकी फसल';
  return [
    `🌿 **रोग पहचान**`,
    ``,
    `${crop} में रोग की सटीक पहचान के लिए:`,
    ``,
    bullet([
      '📸 प्रभावित पत्ती या पौधे की स्पष्ट फोटो भेजें',
      '🌾 फोटो में रोग के लक्षण स्पष्ट दिखने चाहिए',
      '☀️ अच्छी रोशनी में फोटो लें',
      '📍 फसल का नाम और अपना जिला बताएं',
    ]),
    ``,
    `रोग पहचान पेज पर जाएं: /disease-detection`,
  ].join('\n');
}

function buildLowConfidenceResponse(cropName?: string, conf?: number): string {
  const pct = conf !== undefined ? `${Math.round(conf)}%` : 'low';
  return [
    `🌿 **Disease Detection — Low Confidence (${pct})**`,
    ``,
    `⚠️ The image quality or angle makes it difficult to identify the disease accurately.`,
    ``,
    `**Please provide:**`,
    bullet([
      cropName ? '' : '🌾 Crop name (e.g., wheat, tomato, moong)',
      '📸 A clearer, closer photo of the affected area',
      '📍 Your district and state',
      '📅 When did you first notice the symptoms?',
    ].filter(Boolean)),
    ``,
    `This will help me give you the correct treatment.`,
  ].join('\n');
}

function buildLowConfidenceResponseHindi(cropName?: string, conf?: number): string {
  const pct = conf !== undefined ? `${Math.round(conf)}%` : 'कम';
  return [
    `🌿 **रोग पहचान — कम विश्वसनीयता (${pct})**`,
    ``,
    `⚠️ फोटो की गुणवत्ता से सटीक पहचान मुश्किल है।`,
    ``,
    `**कृपया बताएं:**`,
    bullet([
      cropName ? '' : '🌾 फसल का नाम (जैसे गेहूं, टमाटर, मूंग)',
      '📸 प्रभावित हिस्से की स्पष्ट और करीबी फोटो',
      '📍 आपका जिला और राज्य',
      '📅 लक्षण कब से दिख रहे हैं?',
    ].filter(Boolean)),
    ``,
    `इससे मैं सही उपचार बता सकूंगा।`,
  ].join('\n');
}

function buildNoMatchResponse(cropName?: string): string {
  const crop = cropName ? `${cropName}` : 'your crop';
  return [
    `🌿 **Disease Information**`,
    ``,
    `I couldn't find specific disease information for ${crop} in the knowledge base.`,
    ``,
    `**Try these steps:**`,
    bullet([
      '📸 Upload a photo on the Disease Detection page for AI-powered diagnosis',
      '🌾 Mention the specific disease name if you know it',
      '📞 Contact your local KVK center for expert advice',
      '🏛️ Check the Disease Detection page: /disease-detection',
    ]),
  ].join('\n');
}

function buildNoMatchResponseHindi(cropName?: string): string {
  const crop = cropName ? `${cropName}` : 'आपकी फसल';
  return [
    `🌿 **रोग जानकारी**`,
    ``,
    `${crop} के लिए ज्ञान आधार में विशिष्ट जानकारी नहीं मिली।`,
    ``,
    `**इन कदमों को आजमाएं:**`,
    bullet([
      '📸 रोग पहचान पेज पर फोटो अपलोड करें',
      '🌾 यदि रोग का नाम पता है तो बताएं',
      '📞 अपने नजदीकी KVK केंद्र से संपर्क करें',
      '🏛️ रोग पहचान पेज: /disease-detection',
    ]),
  ].join('\n');
}

// ─── Generic structured response ─────────────────────────────────────────────

/**
 * Generate a confidence-aware response for any domain.
 * Used when KB returns a result but confidence is borderline.
 */
export function generateLowConfidencePrompt(
  domain:    string,
  missing:   string[],
): { english: string; hindi: string } {
  const english = [
    `🤔 **I need a bit more information to help you better with ${domain}.**`,
    ``,
    `Please provide:`,
    bullet(missing),
  ].join('\n');

  const hindi = [
    `🤔 **${domain} के बारे में बेहतर मदद के लिए थोड़ी और जानकारी चाहिए।**`,
    ``,
    `कृपया बताएं:`,
    bullet(missing),
  ].join('\n');

  return { english, hindi };
}
