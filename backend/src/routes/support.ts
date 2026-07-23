import express, { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { SupportRequest } from '../models/SupportRequest';

const router = express.Router();
const uploadDir = path.join(process.cwd(), 'uploads', 'support');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-z0-9.]/gi, '-')}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post('/', authenticate, upload.array('attachments', 3), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, email, phone, category, subject, message } = req.body;
    if (!name || !email || !category || !subject || !message) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const attachments = Array.isArray(req.files)
      ? req.files.map((file: any) => `/uploads/support/${file.filename}`)
      : [];

    const supportRequest = await SupportRequest.create({
      userId: req.user?.userId,
      name: name.trim(),
      email: email.trim(),
      phone: phone?.trim(),
      category: category.trim(),
      subject: subject.trim(),
      message: message.trim(),
      attachments,
    });

    res.json({ success: true, data: supportRequest });
  } catch (error: any) {
    console.error('[Support] submit error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to submit support request' });
  }
});

export default router;
