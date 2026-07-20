"use strict";
/**
 * Farm Diary Agent
 * Domain: Active crops, daily tasks, crop lifecycle tracking (AI-FOS)
 * Data sources: MyCrop, CropTask, ActiveCrop MongoDB collections
 * Never communicates directly with the user.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runFarmDiaryAgent = runFarmDiaryAgent;
const MyCrop_1 = require("../models/MyCrop");
const CropTask_1 = require("../models/CropTask");
async function runFarmDiaryAgent(ctx) {
    try {
        const { userId, pageData } = ctx;
        // If farm diary data is already on the page, use it
        if (pageData?.farmDiaryData) {
            const f = pageData.farmDiaryData;
            return {
                agent: 'FarmDiaryAgent',
                success: true,
                data: f,
                summary: `Active crop: ${f.cropName}, Day ${f.dayAge} (${f.stage} stage). Today's tasks: ${(f.todayTasks || []).join(', ') || 'None scheduled'}.`,
            };
        }
        // Fetch farmer's active crops
        const activeCrops = await MyCrop_1.MyCrop.find({ farmerId: userId, status: 'active' })
            .sort({ sowingDate: -1 })
            .limit(3)
            .lean();
        if (activeCrops.length === 0) {
            return {
                agent: 'FarmDiaryAgent',
                success: true,
                data: {},
                summary: 'No active crops found. Guide the farmer to add crops in the My Crops section.',
            };
        }
        // Get today's tasks for the most recent active crop
        const primaryCrop = activeCrops[0];
        const today = new Date();
        const sowingDate = new Date(primaryCrop.sowingDate);
        const dayAge = Math.floor((today.getTime() - sowingDate.getTime()) / (1000 * 60 * 60 * 24));
        const todayTasks = await CropTask_1.CropTask.find({
            myCropId: primaryCrop._id,
            status: { $in: ['pending', 'due'] },
        }).sort({ scheduledDate: 1 }).limit(5).lean();
        const cropSummary = {
            cropName: primaryCrop.cropName,
            variety: primaryCrop.variety,
            dayAge,
            sowingDate: primaryCrop.sowingDate,
            expectedHarvestDate: primaryCrop.expectedHarvestDate,
            fieldArea: primaryCrop.fieldArea,
            status: primaryCrop.status,
            todayTasks: todayTasks.map((t) => ({
                title: t.title,
                description: t.description,
                taskType: t.taskType,
                scheduledDate: t.scheduledDate,
            })),
            allActiveCrops: activeCrops.map((c) => c.cropName),
        };
        return {
            agent: 'FarmDiaryAgent',
            success: true,
            data: cropSummary,
            summary: `Active crop: ${primaryCrop.cropName}, Day ${dayAge}. Pending tasks: ${todayTasks.length}. Tasks: ${todayTasks.slice(0, 2).map((t) => t.title).join(', ') || 'None'}.`,
        };
    }
    catch (err) {
        return {
            agent: 'FarmDiaryAgent',
            success: false,
            error: 'Farm diary information is temporarily unavailable.',
        };
    }
}
//# sourceMappingURL=farmDiaryAgent.js.map