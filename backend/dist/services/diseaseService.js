"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchCache = searchCache;
exports.searchKnowledgeBase = searchKnowledgeBase;
exports.callAIForDisease = callAIForDisease;
exports.autoSaveToKnowledgeBase = autoSaveToKnowledgeBase;
exports.handleFeedbackForKB = handleFeedbackForKB;
const DiseaseRecommendation_1 = require("../models/DiseaseRecommendation");
const DiseaseKnowledgeBase_1 = require("../models/DiseaseKnowledgeBase");
const SIMILARITY_THRESHOLD = 0.80;
const KB_PROMOTE_THRESHOLD = 3; // auto-promote after 3 helpful feedbacks
function normalize(s) { return s.toLowerCase().trim(); }
function stringSimilarity(a, b) {
    if (!a || !b)
        return 0;
    const na = normalize(a);
    const nb = normalize(b);
    if (na === nb)
        return 1;
    if (na.includes(nb) || nb.includes(na))
        return 0.85;
    // token overlap
    const ta = new Set(na.split(/[\s,]+/));
    const tb = new Set(nb.split(/[\s,]+/));
    const intersection = [...ta].filter(x => tb.has(x)).length;
    if (intersection > 0)
        return 0.5 + (intersection / Math.max(ta.size, tb.size)) * 0.3;
    return 0;
}
/** Step 1 — search DiseaseRecommendations (scan history cache) */
async function searchCache(cropName, diseaseName) {
    if (!cropName && !diseaseName)
        return null;
    const filter = {};
    if (cropName)
        filter.cropName = new RegExp(cropName, 'i');
    if (diseaseName)
        filter.diseaseName = new RegExp(diseaseName, 'i');
    const hit = await DiseaseRecommendation_1.DiseaseRecommendation.findOne(filter).sort({ createdAt: -1 }).lean();
    if (!hit)
        return null;
    const score = (stringSimilarity(hit.cropName, cropName || '') + stringSimilarity(hit.diseaseName, diseaseName || '')) / 2;
    if (score < SIMILARITY_THRESHOLD)
        return null;
    return { ...hit, source: 'cache', similarityScore: Math.round(score * 100) };
}
/** Step 2 — search DiseaseKnowledgeBase (permanent knowledge store) */
async function searchKnowledgeBase(cropName, diseaseName) {
    const candidates = await DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.find({
        ...(cropName ? { cropName: new RegExp(cropName, 'i') } : {}),
    }).lean();
    let best = null;
    let bestScore = 0;
    for (const c of candidates) {
        const s = (stringSimilarity(c.cropName, cropName || '') + stringSimilarity(c.diseaseName, diseaseName || '')) / 2;
        if (s > bestScore) {
            bestScore = s;
            best = c;
        }
    }
    if (!best || bestScore < SIMILARITY_THRESHOLD)
        return null;
    // Increment usage counter
    await DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.findByIdAndUpdate(best._id, {
        $inc: { scanCount: 1 },
        lastSeenAt: new Date(),
    });
    return {
        knowledgeBaseId: best._id.toString(),
        cropName: best.cropName,
        diseaseName: best.diseaseName,
        diseaseType: best.diseaseType,
        severityLevel: best.severityLevel,
        symptoms: [best.leafSymptoms, best.stemSymptoms, best.rootSymptoms, best.fruitSymptoms, best.symptomsDescription]
            .filter(Boolean).join('\n'),
        organicTreatment: best.organicTreatment || '',
        chemicalTreatment: best.chemicalTreatment || '',
        treatment: [best.organicTreatment, best.chemicalTreatment, best.treatmentDescription].filter(Boolean).join('\n'),
        prevention: [best.preventionMethods, best.preventionDescription].filter(Boolean).join('\n'),
        recommendedActions: best.recommendedActions || '',
        description: best.description,
        confidenceScore: best.confidenceScore,
        source: 'knowledge_base',
        similarityScore: Math.round(bestScore * 100),
    };
}
/** Step 3 — call OpenAI Vision API */
async function callAIForDisease(imageBase64, cropHint) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey)
        throw new Error('OPENAI_API_KEY not configured');
    const apiUrl = `${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`;
    const prompt = `You are an expert plant pathologist for Indian agriculture.

Analyze this crop image and identify any disease.${cropHint ? ` The farmer says it is a ${cropHint} plant.` : ''}

Return JSON ONLY with these exact fields:
{
  "cropName": "crop name",
  "cropNameHindi": "फसल का नाम",
  "diseaseName": "exact disease name or 'Healthy' if no disease",
  "diseaseNameHindi": "रोग का नाम हिंدी में",
  "diseaseType": "Fungal / Bacterial / Viral / Pest / Nutrient Deficiency / Healthy",
  "severityLevel": "low / medium / high / critical",
  "confidenceScore": 85,
  "symptoms": "visible symptoms in 3-5 sentences",
  "symptomsHindi": "लक्षण हिंदी में",
  "organicTreatment": "organic/natural treatment steps numbered 1,2,3...",
  "organicTreatmentHindi": "जैविक उपचार हिंदी में",
  "chemicalTreatment": "chemical treatment with pesticide/fungicide names numbered 1,2,3...",
  "chemicalTreatmentHindi": "रासायनिक उपचार हिंदी में",
  "prevention": "prevention methods numbered 1,2,3...",
  "preventionHindi": "रोकथाम विधियाँ हिंदी में",
  "recommendedActions": "immediate actions the farmer should take",
  "recommendedActionsHindi": "तत्काल कार्रवाई हिंدी में",
  "description": "comprehensive disease description in 4-6 sentences",
  "descriptionHindi": "विस्तृत विवरण हिंदी में"
}`;
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'openai/gpt-4o-mini',
            messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
                    ],
                }],
            max_tokens: 1500,
            temperature: 0.2,
            response_format: { type: 'json_object' },
        }),
    });
    if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText);
        throw new Error(`AI Vision error: ${errText}`);
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content)
        throw new Error('Empty AI response');
    const p = JSON.parse(content);
    const organic = p.organicTreatment || '';
    const chemical = p.chemicalTreatment || '';
    return {
        cropName: p.cropName || 'Unknown Crop',
        cropNameHindi: p.cropNameHindi || '',
        diseaseName: p.diseaseName || 'Unknown Disease',
        diseaseNameHindi: p.diseaseNameHindi || '',
        diseaseType: p.diseaseType || 'Unknown',
        severityLevel: p.severityLevel || 'medium',
        confidenceScore: Math.min(100, Math.max(0, parseInt(p.confidenceScore) || 75)),
        symptoms: p.symptoms || '',
        symptomsHindi: p.symptomsHindi || '',
        organicTreatment: organic,
        organicTreatmentHindi: p.organicTreatmentHindi || '',
        chemicalTreatment: chemical,
        chemicalTreatmentHindi: p.chemicalTreatmentHindi || '',
        treatment: [organic, chemical].filter(Boolean).join('\n'),
        prevention: p.prevention || '',
        preventionHindi: p.preventionHindi || '',
        recommendedActions: p.recommendedActions || '',
        recommendedActionsHindi: p.recommendedActionsHindi || '',
        description: p.description || '',
        descriptionHindi: p.descriptionHindi || '',
    };
}
/** Auto-save AI result to DiseaseKnowledgeBase for future reuse */
async function autoSaveToKnowledgeBase(aiResult, imageUrl) {
    try {
        await DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.findOneAndUpdate({ cropName: new RegExp(`^${aiResult.cropName}$`, 'i'), diseaseName: new RegExp(`^${aiResult.diseaseName}$`, 'i') }, {
            $setOnInsert: {
                cropName: aiResult.cropName,
                cropCategory: 'General',
                diseaseName: aiResult.diseaseName,
                diseaseType: aiResult.diseaseType,
                severityLevel: aiResult.severityLevel,
                description: aiResult.description,
                symptomsDescription: aiResult.symptoms,
                organicTreatment: aiResult.organicTreatment,
                chemicalTreatment: aiResult.chemicalTreatment,
                preventionMethods: aiResult.prevention,
                recommendedActions: aiResult.recommendedActions,
                diseaseImages: imageUrl ? [imageUrl] : [],
                healthyImages: [],
                source: 'ai_auto',
                confidenceScore: aiResult.confidenceScore,
            },
            $inc: { scanCount: 1 },
            $set: { lastSeenAt: new Date() },
        }, { upsert: true, new: true, setDefaultsOnInsert: true });
    }
    catch (err) {
        // Non-blocking — log but don't fail the scan
        console.error('KB auto-save error:', err);
    }
}
/** Called when feedback is 'helpful' — promote ai_auto to ai_verified after threshold */
async function handleFeedbackForKB(knowledgeBaseId, cropName, diseaseName, isHelpful) {
    const filter = knowledgeBaseId
        ? { _id: knowledgeBaseId }
        : { cropName: new RegExp(`^${cropName}$`, 'i'), diseaseName: new RegExp(`^${diseaseName}$`, 'i') };
    const update = isHelpful
        ? { $inc: { helpfulCount: 1 } }
        : { $inc: { notHelpfulCount: 1 } };
    const doc = await DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.findOneAndUpdate(filter, update, { new: true });
    if (doc && isHelpful && doc.source === 'ai_auto' && doc.helpfulCount >= KB_PROMOTE_THRESHOLD) {
        await DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.findByIdAndUpdate(doc._id, { source: 'ai_verified' });
    }
}
//# sourceMappingURL=diseaseService.js.map