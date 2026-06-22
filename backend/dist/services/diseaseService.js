"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchCache = searchCache;
exports.searchKnowledgeBase = searchKnowledgeBase;
exports.callAIForDisease = callAIForDisease;
const DiseaseRecommendation_1 = require("../models/DiseaseRecommendation");
const DiseaseKnowledgeBase_1 = require("../models/DiseaseKnowledgeBase");
const SIMILARITY_THRESHOLD = 0.80;
function normalize(s) { return s.toLowerCase().trim(); }
function stringSimilarity(a, b) {
    const na = normalize(a);
    const nb = normalize(b);
    if (na === nb)
        return 1;
    if (na.includes(nb) || nb.includes(na))
        return 0.85;
    return 0;
}
/** Step 1 — search DiseaseRecommendations cache */
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
/** Step 2 — search DiseaseKnowledgeBase */
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
    return {
        cropName: best.cropName,
        diseaseName: best.diseaseName,
        diseaseType: best.diseaseType,
        severityLevel: best.severityLevel,
        symptoms: [best.leafSymptoms, best.stemSymptoms, best.rootSymptoms, best.fruitSymptoms, best.symptomsDescription]
            .filter(Boolean).join('\n'),
        treatment: [best.organicTreatment, best.chemicalTreatment, best.treatmentDescription].filter(Boolean).join('\n'),
        prevention: [best.preventionMethods, best.preventionDescription].filter(Boolean).join('\n'),
        description: best.description,
        source: 'knowledge_base',
        similarityScore: Math.round(bestScore * 100),
    };
}
/** Step 3 — call OpenAI Vision */
async function callAIForDisease(imageBase64, cropHint) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey)
        throw new Error('OPENAI_API_KEY not configured');
    const apiUrl = `${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`;
    const prompt = `You are an expert plant pathologist and agricultural scientist for India.

Analyze this crop/plant image and identify any disease present.${cropHint ? ` The farmer mentions it is a ${cropHint} plant.` : ''}

Return JSON ONLY with these exact fields:
{
  "cropName": "crop plant name",
  "diseaseName": "exact disease name or 'Healthy' if no disease",
  "diseaseType": "Fungal / Bacterial / Viral / Pest / Deficiency / Healthy",
  "severityLevel": "low / medium / high / critical",
  "symptoms": "visible symptoms description in 3-5 sentences",
  "treatment": "specific treatment steps numbered 1,2,3...",
  "prevention": "specific prevention methods numbered 1,2,3...",
  "description": "comprehensive disease description in 4-6 sentences"
}`;
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'openai/gpt-4o-mini',
            messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
                    ],
                }],
            max_tokens: 1200,
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
    const parsed = JSON.parse(content);
    return {
        cropName: parsed.cropName || 'Unknown Crop',
        diseaseName: parsed.diseaseName || 'Unknown Disease',
        diseaseType: parsed.diseaseType || 'Unknown',
        severityLevel: parsed.severityLevel || 'medium',
        symptoms: parsed.symptoms || '',
        treatment: parsed.treatment || '',
        prevention: parsed.prevention || '',
        description: parsed.description || '',
    };
}
//# sourceMappingURL=diseaseService.js.map