"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const auth_1 = require("../middleware/auth");
const SupportRequest_1 = require("../models/SupportRequest");
const router = express_1.default.Router();
const uploadDir = path_1.default.join(process.cwd(), 'uploads', 'support');
if (!fs_1.default.existsSync(uploadDir))
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
const upload = (0, multer_1.default)({
    storage: multer_1.default.diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadDir),
        filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-z0-9.]/gi, '-')}`),
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
});
router.post('/', auth_1.authenticate, upload.array('attachments', 3), async (req, res) => {
    try {
        const { name, email, phone, category, subject, message } = req.body;
        if (!name || !email || !category || !subject || !message) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        const attachments = Array.isArray(req.files)
            ? req.files.map((file) => `/uploads/support/${file.filename}`)
            : [];
        const supportRequest = await SupportRequest_1.SupportRequest.create({
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
    }
    catch (error) {
        console.error('[Support] submit error:', error);
        res.status(500).json({ success: false, error: error?.message || 'Failed to submit support request' });
    }
});
exports.default = router;
//# sourceMappingURL=support.js.map