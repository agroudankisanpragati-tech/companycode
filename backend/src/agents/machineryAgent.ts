/**
 * Machinery Agent
 * Domain: Farm machinery, tractors, sprayers, equipment, subsidies
 * Data sources: Static guidance + KVK referral (no dedicated machinery DB)
 * Never communicates directly with the user.
 */

import { AgentContext, AgentResult } from './types';

const MACHINERY_SUMMARY = `🚜 Farm Machinery Information

For farm machinery:
• Contact your KVK center for demonstrations and training
• Visit the KVK page to find your nearest center
• Apply for machinery subsidy under SMAM scheme

📞 KVK Helpline: 1800-180-1551
📋 SMAM Subsidy: Apply at your state agriculture department`;

export async function runMachineryAgent(ctx: AgentContext): Promise<AgentResult> {
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

function extractMachineType(msg: string): string {
  const machines = [
    'tractor', 'sprayer', 'rotavator', 'thresher', 'harvester',
    'reaper', 'cultivator', 'pump', 'plough',
  ];
  const lower = msg.toLowerCase();
  return machines.find(m => lower.includes(m)) || '';
}
