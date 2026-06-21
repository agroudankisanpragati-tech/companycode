"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const database_1 = require("./config/database");
const auth_1 = __importDefault(require("./routes/auth"));
const crops_1 = __importDefault(require("./routes/crops"));
const weather_1 = __importDefault(require("./routes/weather"));
const users_1 = __importDefault(require("./routes/users"));
const mandi_1 = __importDefault(require("./routes/mandi"));
const admin_1 = __importDefault(require("./routes/admin"));
const blogs_1 = __importDefault(require("./routes/blogs"));
const gallery_1 = __importDefault(require("./routes/gallery"));
const schemes_1 = __importDefault(require("./routes/schemes"));
const shops_1 = __importDefault(require("./routes/shops"));
const rewards_1 = __importDefault(require("./routes/rewards"));
const cropRecommendation_1 = __importDefault(require("./routes/cropRecommendation"));
const myCrops_1 = __importDefault(require("./routes/myCrops"));
const soil_1 = __importDefault(require("./routes/soil"));
const soilMoisture_1 = __importDefault(require("./routes/soilMoisture"));
const aiFos_1 = __importDefault(require("./routes/aiFos"));
const aiAssistant_1 = __importDefault(require("./routes/aiAssistant"));
const settings_1 = __importDefault(require("./routes/settings"));
const farmerProfile_1 = __importDefault(require("./routes/farmerProfile"));
const bootstrapAdmin_1 = require("./utils/bootstrapAdmin");
dotenv_1.default.config({ override: true });
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
const uploadsDir = path_1.default.join(process.cwd(), 'uploads');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
const buildAllowedOrigins = () => {
    const configuredOrigins = [process.env.FRONTEND_URL, process.env.ADMIN_URL]
        .filter(Boolean)
        .flatMap((value) => value.split(','))
        .map((origin) => origin.trim())
        .filter(Boolean);
    const defaultOrigins = process.env.NODE_ENV === 'production'
        ? []
        : ['http://localhost:3000', 'http://localhost:3001'];
    return Array.from(new Set([...defaultOrigins, ...configuredOrigins]));
};
const allowedOrigins = buildAllowedOrigins();
// Middleware
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow server-to-server and non-browser requests that do not send an Origin header.
        if (!origin) {
            callback(null, true);
            return;
        }
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ limit: '10mb', extended: true }));
app.use('/uploads', express_1.default.static(uploadsDir));
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/crops', crops_1.default);
// marketplace routes removed per request (UI replaced with mandi-bhav integration)
app.use('/api/weather', weather_1.default);
app.use('/api/users', users_1.default);
app.use('/api/mandi', mandi_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/blogs', blogs_1.default);
app.use('/api/gallery', gallery_1.default);
app.use('/api/schemes', schemes_1.default);
app.use('/api/shops', shops_1.default);
app.use('/api/rewards', rewards_1.default);
app.use('/api/crop-recommendation', cropRecommendation_1.default);
app.use('/api/my-crops', myCrops_1.default);
app.use('/api/soil', soil_1.default);
app.use('/api/soil-moisture', soilMoisture_1.default);
app.use('/api/ai-fos', aiFos_1.default);
app.use('/api/ai-assistant', aiAssistant_1.default);
app.use('/api/settings', settings_1.default);
app.use('/api/farmer-profile', farmerProfile_1.default);
// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Kisan Unnati Backend is running' });
});
// Error Handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
    });
});
const startServer = async () => {
    await (0, database_1.connectDB)();
    await (0, bootstrapAdmin_1.ensureBootstrapAdmin)();
    const server = app.listen(PORT, () => {
        console.log(`🌾 Kisan Unnati Backend running on port ${PORT}`);
    });
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`❌ Port ${PORT} is already in use. Stop the existing process and restart.`);
            process.exit(1);
        }
        else {
            throw err;
        }
    });
};
startServer();
//# sourceMappingURL=index.js.map