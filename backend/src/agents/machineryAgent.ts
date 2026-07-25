/**
 * Machinery Agent
 * Fix 2: reads machinery type from ctx.entities
 */

import { AgentContext, AgentResult } from './types';
import { createLogger } from '../utils/logger';

const log = createLogger('machineryAgent');

const MACHINERY_SUMMARY = `🚜 Farm Machinery Information

For farm machinery:
• Contact your KVK center for demonstrations and training
• Visit the KVK page to find your nearest center
• Apply for machinery subsidy under SMAM scheme

📞 KVK Helpline: 1800-180-1551
📋 SMAM Subsidy: Apply at your state agriculture department`;

export async function runMachineryAgent(ctx: AgentContext): Promise<AgentResult> {
  // Fix 2: use pre-extracted entity
  const machineType = ctx.entities?.machinery || '';

  log.debug('MachineryAgent running', { machineType });

  return {
    agent: 'MachineryAgent', success: true,
    data: {
      machineType:   machineType || 'general',
      kvkHelpline:   '1800-180-1551',
      subsidyScheme: 'SMAM (Sub-Mission on Agricultural Mechanization)',
    },
    summary: MACHINERY_SUMMARY,
  };
}
