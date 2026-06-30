import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadsDir = path.join(process.cwd(), 'uploads', 'shops');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = /jpeg|jpg|png|webp|gif/;
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.test(ext) && allowed.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

export const shopUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

export const getFileUrl = (filename: string) => `/uploads/shops/${filename}`;

export const deleteFile = (filePath: string) => {
  try {
    const fullPath = path.join(process.cwd(), filePath.startsWith('/') ? filePath.slice(1) : filePath);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  } catch {
    // silently ignore
  }
};
