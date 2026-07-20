/**
 * Crop Agent
 * Domain: Crop advisory, recommendations, cultivation guidance
 * Data sources: CropKnowledgeBase (via knowledgeBaseSearch), FarmerCropRequest history
 * Never communicates directly with the user.
 */

import { FarmerCropRequest } from '../models/FarmerCropRequest';
import { AgentContext, AgentResult } from './types';
import { searchCropKB } from '../services/knowledgeBaseSearch';

export async function runCropAgent(ctx: AgentContext): Promise<AgentResult> {
  try {
    const { userId, message, pageData, farmerProfile } = ctx;

    const cropName =
      pageData?.cropData?.cropName ||
      extractCropFromMessage(message);

    const soilType = farmerProfile?.soilType || '';
    const season   = extractSeasonFromMessage(message);

    // Priority KB search
    if (cropName) {
      const kbResult = await searchCropKB(cropName, soilType, season);
      if (kbResult.found) {
        return {
          agent: 'CropAgent',
          success: true,
          data: kbResult.data,
          summary: kbResult.summary,
        };
      }
    }

    // Fallback: farmer's most recent crop request for context
    const lastRequest = await FarmerCropRequest.findOne({ farmerId: userId })
      .sort({ createdAt: -1 })
      .lean();

    if (lastRequest) {
      return {
        agent: 'CropAgent',
        success: true,
        data: {
          lastRequestSoilType:  lastRequest.soilType,
          lastRequestSeason:    lastRequest.season,
          lastRequestDistrict:  lastRequest.district,
          lastRequestState:     lastRequest.state,
        },
        summary: `Farmer's last crop request: ${lastRequest.soilType} soil, ${lastRequest.season} season in ${lastRequest.district}, ${lastRequest.state}.`,
      };
    }

    return {
      agent: 'CropAgent',
      success: true,
      data: {},
      summary: 'No crop history found. Guide the farmer to use the Crop Advisory page to get personalized recommendations.',
    };
  } catch (err: any) {
    return {
      agent: 'CropAgent',
      success: false,
      error: 'Crop advisory information is temporarily unavailable.',
    };
  }
}

function extractCropFromMessage(msg: string): string {
  const crops = [
    'wheat', 'rice', 'tomato', 'corn', 'maize', 'cotton', 'sugarcane',
    'potato', 'onion', 'mustard', 'gram', 'soybean', 'bajra', 'jowar', // ===== Your 6 AI Crops =====
  'black_gram',
  'green_gram',
  'corn_maize',
  'tomato',
  'pearl_millet _bajra',
  'wheat',

  // ===== Common English =====
  'black gram',
  'green gram',
  'corn',
  'maize',
  'tomato',
  'pearl millet',

  // ===== Hindi / Hinglish =====
  'urad',
  'udad',
  'moong',
  'mung',
  'makka',
  'tamatar',
  'bajra',
  'gehu',
  'gehun',

  // ===== Existing crops =====
  'rice',
  'cotton',
  'sugarcane',
  'potato',
  'onion',
  'mustard',
  'gram',
  'soybean',
  'jowar',
  'groundnut',
  'sunflower',
  'turmeric',
  'ginger',
  'chilli',
  'brinjal',
  'arhar',
    'groundnut', 'sunflower', 'turmeric', 'ginger', 'chilli', 'brinjal',
    'moong', 'mung', 'arhar', 'urad',
  ];
  const lower = msg.toLowerCase();
  return crops.find(c => lower.includes(c)) || '';
}

function extractSeasonFromMessage(msg: string): string {
  const lower = msg.toLowerCase();
  if (/kharif|monsoon|rainy|sawan/.test(lower)) return 'Kharif';
  if (/rabi|winter|sardi/.test(lower))          return 'Rabi';
  if (/zaid|summer|garmi/.test(lower))          return 'Zaid';
  return '';
}
