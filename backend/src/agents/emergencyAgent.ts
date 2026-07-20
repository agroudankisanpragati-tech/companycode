/**
 * Emergency Agent
 * Domain: Farming emergencies — crop damage, pest outbreak, flood, poisoning
 * Data sources: Static guidance only (no DB, no LLM)
 * Never communicates directly with the user.
 * LLM is NEVER called for emergency intent.
 */

import { AgentContext, AgentResult } from './types';

const EMERGENCY_GENERAL = `🚨 Emergency Farming Assistance

Immediate steps:
1. Isolate affected plants — prevent disease spread
2. Call KVK Helpline: 1800-180-1551 (toll-free)
3. Contact your nearest agriculture officer
4. Take photos of affected leaves/crops
5. Stop irrigation immediately if root rot is suspected

Upload a crop image above for instant disease identification.`;

const EMERGENCY_PEST = `🚨 Pest Emergency

Immediate steps:
1. Isolate the affected area
2. Spray neem oil (5 ml/litre)
3. KVK Helpline: 1800-180-1551
4. Set light traps at night
5. Upload image for pest identification`;

const EMERGENCY_FLOOD = `🚨 Flood/Waterlogging Emergency

Immediate steps:
1. Arrange drainage from the field
2. Allow roots to breathe
3. Crop insurance claim: 14447
4. PM Fasal Bima Yojana helpline: 1800-200-7710
5. Keep photos and videos of damage`;

const EMERGENCY_POISON = `🚨 Pesticide Poisoning Emergency

Immediate steps:
1. 🏥 Go to nearest hospital immediately
2. National Poison Control: 1800-116-117
3. Ambulance: 108
4. Carry the pesticide container/label
5. Stay in open air`;

function detectEmergencyType(msg: string): string {
  const lower = msg.toLowerCase();
  if (/poison|toxic|pesticide.*poison|विष|कीटनाशक.*विषाक्त/.test(lower)) return 'poison';
  if (/flood|waterlog|बाढ़|जलभराव|drought|सूखा/.test(lower)) return 'flood';
  if (/pest|insect|locust|टिड्डी|aphid|whitefly|कीट/.test(lower)) return 'pest';
  return 'general';
}

export async function runEmergencyAgent(ctx: AgentContext): Promise<AgentResult> {
  const emergencyType = detectEmergencyType(ctx.message);

  const msgMap: Record<string, string> = {
    poison:  EMERGENCY_POISON,
    flood:   EMERGENCY_FLOOD,
    pest:    EMERGENCY_PEST,
    general: EMERGENCY_GENERAL,
  };

  return {
    agent: 'EmergencyAgent',
    success: true,
    data: { emergencyType },
    summary: msgMap[emergencyType],
  };
}
