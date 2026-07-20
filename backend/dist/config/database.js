"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = require("../utils/logger");
const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI;
        if (!mongoURI) {
            throw new Error('MONGODB_URI is not configured');
        }
        await mongoose_1.default.connect(mongoURI);
        logger_1.logger.info('MongoDB connected successfully');
        process.on('SIGINT', async () => {
            await mongoose_1.default.disconnect();
            logger_1.logger.info('MongoDB disconnected on app termination');
            process.exit(0);
        });
    }
    catch (error) {
        logger_1.logger.error('MongoDB connection failed', { error: String(error) });
        process.exit(1);
    }
};
exports.connectDB = connectDB;
//# sourceMappingURL=database.js.map