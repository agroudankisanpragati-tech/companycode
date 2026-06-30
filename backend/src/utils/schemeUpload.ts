import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadsDir = path.join(process.cwd(), 'uploads', 'schemes');
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
  const imageTypes = /jpeg|jpg|png|webp|gif/;
  const videoTypes = /mp4|mov|avi|mkv|webm/;
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  const mime = file.mimetype;

  if (imageTypes.test(ext) || videoTypes.test(ext) || mime.startsWith('image/') || mime.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image and video files are allowed'));
  }
};

export const schemeUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB for videos
});

export const getSchemeFileUrl = (filename: string) => `/uploads/schemes/${filename}`;

export const deleteSchemeFile = (filePath: string) => {
  try {
    const fullPath = path.join(process.cwd(), filePath.startsWith('/') ? filePath.slice(1) : filePath);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  } catch { /* silent */ }
};
