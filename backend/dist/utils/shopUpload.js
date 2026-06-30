"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFile = exports.getFileUrl = exports.shopUpload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uploadsDir = path_1.default.join(process.cwd(), 'uploads', 'shops');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${path_1.default.extname(file.originalname)}`);
    },
});
const fileFilter = (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif/;
    const ext = path_1.default.extname(file.originalname).toLowerCase();
    if (allowed.test(ext) && allowed.test(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error('Only image files are allowed'));
    }
};
exports.shopUpload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});
const getFileUrl = (filename) => `/uploads/shops/${filename}`;
exports.getFileUrl = getFileUrl;
const deleteFile = (filePath) => {
    try {
        const fullPath = path_1.default.join(process.cwd(), filePath.startsWith('/') ? filePath.slice(1) : filePath);
        if (fs_1.default.existsSync(fullPath))
            fs_1.default.unlinkSync(fullPath);
    }
    catch {
        // silently ignore
    }
};
exports.deleteFile = deleteFile;
//# sourceMappingURL=shopUpload.js.map