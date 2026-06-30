"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSchemeFile = exports.getSchemeFileUrl = exports.schemeUpload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uploadsDir = path_1.default.join(process.cwd(), 'uploads', 'schemes');
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
    const imageTypes = /jpeg|jpg|png|webp|gif/;
    const videoTypes = /mp4|mov|avi|mkv|webm/;
    const ext = path_1.default.extname(file.originalname).toLowerCase().replace('.', '');
    const mime = file.mimetype;
    if (imageTypes.test(ext) || videoTypes.test(ext) || mime.startsWith('image/') || mime.startsWith('video/')) {
        cb(null, true);
    }
    else {
        cb(new Error('Only image and video files are allowed'));
    }
};
exports.schemeUpload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB for videos
});
const getSchemeFileUrl = (filename) => `/uploads/schemes/${filename}`;
exports.getSchemeFileUrl = getSchemeFileUrl;
const deleteSchemeFile = (filePath) => {
    try {
        const fullPath = path_1.default.join(process.cwd(), filePath.startsWith('/') ? filePath.slice(1) : filePath);
        if (fs_1.default.existsSync(fullPath))
            fs_1.default.unlinkSync(fullPath);
    }
    catch { /* silent */ }
};
exports.deleteSchemeFile = deleteSchemeFile;
//# sourceMappingURL=schemeUpload.js.map