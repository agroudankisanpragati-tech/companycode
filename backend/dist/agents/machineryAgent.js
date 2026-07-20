"use strict";
/**
 * Machinery Agent
 * Domain: Farm machinery, tractors, sprayers, equipment, subsidies
 * Data sources: Static guidance + KVK referral (no dedicated machinery DB)
 * Never communicates directly with the user.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMachineryAgent = runMachineryAgent;
const MACHINERY_SUMMARY = `🚜 Farm Machinery Information

For farm machinery:
• Contact your KVK center for demonstrations and training
• Visit the KVK page to find your nearest center
• Apply for machinery subsidy under SMAM scheme

📞 KVK Helpline: 1800-180-1551
📋 SMAM Subsidy: Apply at your state agriculture department`;
async function runMachineryAgent(ctx) {
    const machineType = extractMachineType(ctx.message);
    return {
        agent: 'MachineryAgent',
        success: true,
        data: {
            machineType: machineType || 'general',
            kvkHelpline: '1800-180-1551',
            subsidyScheme: 'SMAM (Sub-Mission on Agricultural Mechanization)',
        },
        summary: MACHINERY_SUMMARY,
    };
}
function extractMachineType(msg) {
    const machines = [
        'tractor', 'sprayer', 'rotavator', 'thresher', 'harvester',
        'reaper', 'cultivator', 'pump', 'plough',
    ];
    const lower = msg.toLowerCase();
    return machines.find(m => lower.includes(m)) || '';
}
//# sourceMappingURL=machineryAgent.js.map