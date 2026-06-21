"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CropTask = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const schema = new mongoose_1.Schema({
    farmerId: { type: String, required: true, index: true },
    activeCropId: { type: String, required: true, index: true },
    cropName: { type: String, required: true },
    dayNumber: { type: Number, required: true },
    scheduledDate: { type: Date, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    taskType: { type: String, enum: ['irrigation', 'fertilizer', 'pesticide', 'weeding', 'monitoring', 'harvest', 'general'], default: 'general' },
    status: { type: String, enum: ['pending', 'done', 'skipped'], default: 'pending' },
    completedAt: { type: Date },
}, { timestamps: true });
schema.index({ farmerId: 1, scheduledDate: 1 });
schema.index({ activeCropId: 1, dayNumber: 1 });
exports.CropTask = mongoose_1.default.model('CropTask', schema);
//# sourceMappingURL=CropTask.js.map