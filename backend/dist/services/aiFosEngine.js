"use strict";
// AI Farm Operating System — Lifecycle & Task Engine
// Uses OpenAI to generate crop-specific timelines; falls back to built-in templates.
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveStage = resolveStage;
exports.getCropLifecycle = getCropLifecycle;
exports.generateDailyRecommendation = generateDailyRecommendation;
const getApiUrl = () => `${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`;
const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'HTTP-Referer': 'http://localhost:3000',
    'X-Title': 'Kisan Pragati AI-FOS',
});
// ── Built-in fallback templates for common Indian crops ──────────────────────
const CROP_TEMPLATES = {
    wheat: {
        duration: 120,
        stages: [
            { name: 'Land Preparation', startDay: 1, endDay: 5 },
            { name: 'Germination', startDay: 6, endDay: 20 },
            { name: 'Tillering', startDay: 21, endDay: 45 },
            { name: 'Jointing', startDay: 46, endDay: 65 },
            { name: 'Heading', startDay: 66, endDay: 85 },
            { name: 'Grain Filling', startDay: 86, endDay: 105 },
            { name: 'Harvest Ready', startDay: 106, endDay: 120 },
        ],
        tasks: [
            { dayNumber: 1, title: 'Land Preparation & Sowing', description: 'Plough field, prepare seedbed, sow wheat seeds at 100 kg/acre depth 5 cm.', taskType: 'general' },
            { dayNumber: 20, title: 'First Irrigation (Crown Root)', description: 'Apply first irrigation at crown root initiation stage. Critical for establishment.', taskType: 'irrigation' },
            { dayNumber: 21, title: 'Apply Urea (First Split)', description: 'Apply 30 kg Urea per acre as first top dressing after first irrigation.', taskType: 'fertilizer' },
            { dayNumber: 40, title: 'Second Irrigation (Tillering)', description: 'Irrigate at tillering stage to support tiller development.', taskType: 'irrigation' },
            { dayNumber: 55, title: 'Weed Control', description: 'Apply 2,4-D herbicide or manual weeding to control broadleaf weeds.', taskType: 'weeding' },
            { dayNumber: 60, title: 'Third Irrigation (Jointing)', description: 'Irrigate at jointing stage. Apply second split of Urea 20 kg/acre.', taskType: 'irrigation' },
            { dayNumber: 65, title: 'Apply Urea (Second Split)', description: 'Top dress 20 kg Urea per acre after third irrigation.', taskType: 'fertilizer' },
            { dayNumber: 75, title: 'Fourth Irrigation (Heading)', description: 'Irrigate at flag leaf / heading stage for grain set.', taskType: 'irrigation' },
            { dayNumber: 90, title: 'Disease Monitoring', description: 'Scout for rust, powdery mildew. Apply fungicide if infection >5%.', taskType: 'monitoring' },
            { dayNumber: 95, title: 'Fifth Irrigation (Grain Fill)', description: 'Irrigate at grain filling stage. Last irrigation.', taskType: 'irrigation' },
            { dayNumber: 110, title: 'Harvest Preparation', description: 'Check grain moisture (14–16%). Arrange harvesting equipment.', taskType: 'monitoring' },
            { dayNumber: 120, title: 'Harvest', description: 'Harvest when grain moisture ≤14%. Thresh and store properly.', taskType: 'harvest' },
        ],
    },
    rice: {
        duration: 130,
        stages: [
            { name: 'Nursery', startDay: 1, endDay: 25 },
            { name: 'Transplanting', startDay: 26, endDay: 35 },
            { name: 'Tillering', startDay: 36, endDay: 65 },
            { name: 'Panicle Init', startDay: 66, endDay: 85 },
            { name: 'Heading', startDay: 86, endDay: 100 },
            { name: 'Grain Filling', startDay: 101, endDay: 120 },
            { name: 'Harvest Ready', startDay: 121, endDay: 130 },
        ],
        tasks: [
            { dayNumber: 1, title: 'Nursery Preparation & Sowing', description: 'Prepare nursery bed, sow pre-germinated seeds at 20 kg/acre.', taskType: 'general' },
            { dayNumber: 7, title: 'Nursery Fertilizer', description: 'Apply DAP 2 kg per nursery bed for seedling establishment.', taskType: 'fertilizer' },
            { dayNumber: 25, title: 'Transplanting', description: 'Transplant 20–25 day old seedlings at 20×15 cm spacing.', taskType: 'general' },
            { dayNumber: 30, title: 'First Basal Fertilizer', description: 'Apply DAP 50 kg + MOP 25 kg per acre as basal dose after transplant.', taskType: 'fertilizer' },
            { dayNumber: 40, title: 'Weed Control', description: 'Apply pre-emergence herbicide or manual weeding in standing water.', taskType: 'weeding' },
            { dayNumber: 45, title: 'First Urea Top Dressing', description: 'Apply 35 kg Urea per acre at active tillering.', taskType: 'fertilizer' },
            { dayNumber: 70, title: 'Panicle Init Fertilizer', description: 'Apply 20 kg Urea per acre at panicle initiation stage.', taskType: 'fertilizer' },
            { dayNumber: 80, title: 'Pest & Disease Check', description: 'Scout for BPH, blast, bacterial blight. Apply treatments if needed.', taskType: 'pesticide' },
            { dayNumber: 95, title: 'Drain Field', description: 'Drain field 10–14 days before harvest for uniform ripening.', taskType: 'irrigation' },
            { dayNumber: 120, title: 'Harvest Preparation', description: 'Check grain colour — 80% golden yellow. Arrange combine harvester.', taskType: 'monitoring' },
            { dayNumber: 130, title: 'Harvest', description: 'Harvest at 20–22% grain moisture for best quality.', taskType: 'harvest' },
        ],
    },
    mustard: {
        duration: 110,
        stages: [
            { name: 'Germination', startDay: 1, endDay: 10 },
            { name: 'Vegetative', startDay: 11, endDay: 35 },
            { name: 'Flowering', startDay: 36, endDay: 65 },
            { name: 'Pod Formation', startDay: 66, endDay: 90 },
            { name: 'Maturity', startDay: 91, endDay: 110 },
        ],
        tasks: [
            { dayNumber: 1, title: 'Sowing', description: 'Sow mustard seeds at 1.5 kg/acre, depth 2–3 cm, row spacing 30 cm.', taskType: 'general' },
            { dayNumber: 25, title: 'First Irrigation', description: 'First irrigation at branching stage. Avoid water logging.', taskType: 'irrigation' },
            { dayNumber: 30, title: 'Urea Top Dressing', description: 'Apply 25 kg Urea per acre at branching stage.', taskType: 'fertilizer' },
            { dayNumber: 35, title: 'Aphid Monitoring', description: 'Check for mustard aphid infestation. Spray imidacloprid if >25 aphids/plant.', taskType: 'pesticide' },
            { dayNumber: 45, title: 'Second Irrigation (Flower)', description: 'Irrigate at early flowering. Critical for pod set.', taskType: 'irrigation' },
            { dayNumber: 70, title: 'Third Irrigation (Pod Fill)', description: 'Irrigate at pod filling stage. Last irrigation.', taskType: 'irrigation' },
            { dayNumber: 90, title: 'Harvest Preparation', description: 'When 75% pods turn yellow-brown, stop irrigation and prepare harvester.', taskType: 'monitoring' },
            { dayNumber: 110, title: 'Harvest', description: 'Harvest early morning to reduce shattering losses.', taskType: 'harvest' },
        ],
    },
    gram: {
        duration: 110,
        stages: [
            { name: 'Germination', startDay: 1, endDay: 12 },
            { name: 'Vegetative', startDay: 13, endDay: 40 },
            { name: 'Flowering', startDay: 41, endDay: 65 },
            { name: 'Pod Formation', startDay: 66, endDay: 90 },
            { name: 'Maturity', startDay: 91, endDay: 110 },
        ],
        tasks: [
            { dayNumber: 1, title: 'Sowing', description: 'Sow chickpea at 30–35 kg/acre. Seed treat with Rhizobium culture.', taskType: 'general' },
            { dayNumber: 35, title: 'Pre-Flowering Irrigation', description: 'One pre-flowering irrigation if soil is dry. Avoid excess water.', taskType: 'irrigation' },
            { dayNumber: 45, title: 'Pod Borer Monitoring', description: 'Check for Helicoverpa pod borer. Apply neem-based spray if needed.', taskType: 'pesticide' },
            { dayNumber: 60, title: 'Pod Fill Irrigation', description: 'Light irrigation at pod filling if dry conditions persist.', taskType: 'irrigation' },
            { dayNumber: 90, title: 'Wilt Disease Check', description: 'Scout for Fusarium wilt. Remove and destroy infected plants.', taskType: 'monitoring' },
            { dayNumber: 110, title: 'Harvest', description: 'Harvest when 90% pods are dry. Thresh and clean properly.', taskType: 'harvest' },
        ],
    },
};
function normalize(name) {
    return name.toLowerCase().replace(/[^a-z]/g, '');
}
function getTemplate(cropName) {
    const key = normalize(cropName);
    for (const [k, v] of Object.entries(CROP_TEMPLATES)) {
        if (key.includes(k) || k.includes(key))
            return v;
    }
    return null;
}
// ── Stage resolver ───────────────────────────────────────────────────────────
function resolveStage(stages, dayAge) {
    for (const s of stages) {
        if (dayAge >= s.startDay && dayAge <= s.endDay)
            return s.name;
    }
    if (dayAge < stages[0].startDay)
        return stages[0].name;
    return stages[stages.length - 1].name;
}
// ── Default stages for unknown crops ────────────────────────────────────────
const DEFAULT_STAGES = [
    { name: 'Germination', startDay: 1, endDay: 15 },
    { name: 'Vegetative', startDay: 16, endDay: 50 },
    { name: 'Reproductive', startDay: 51, endDay: 85 },
    { name: 'Maturation', startDay: 86, endDay: 110 },
    { name: 'Harvest Ready', startDay: 111, endDay: 999 },
];
// ── AI lifecycle generation ──────────────────────────────────────────────────
async function generateLifecycleWithAI(cropName, duration, state, district) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey)
        throw new Error('No API key');
    const prompt = `You are an expert Indian agricultural scientist.
Generate a complete farming task timeline for ${cropName} grown in ${district}, ${state}, India.
Growing duration: ${duration} days.

Return JSON only:
{
  "tasks": [
    { "dayNumber": <1-${duration}>, "title": "short task name", "description": "1-2 sentence instruction", "taskType": "irrigation|fertilizer|pesticide|weeding|monitoring|harvest|general" }
  ]
}
Generate 10-15 key tasks covering: land prep, sowing, irrigations, fertilizers, pest control, harvest.`;
    const res = await fetch(getApiUrl(), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'openai/gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            max_tokens: 2000,
            response_format: { type: 'json_object' },
        }),
    });
    if (!res.ok)
        throw new Error('AI API failed');
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    return (parsed.tasks || []);
}
// ── Main export: get lifecycle for a crop ────────────────────────────────────
async function getCropLifecycle(cropName, growingDurationDays, state, district) {
    const template = getTemplate(cropName);
    if (template) {
        return { duration: template.duration, stages: template.stages, tasks: template.tasks };
    }
    // Unknown crop — try AI, fallback to generic template
    try {
        const tasks = await generateLifecycleWithAI(cropName, growingDurationDays, state, district);
        return { duration: growingDurationDays, stages: DEFAULT_STAGES, tasks };
    }
    catch {
        // Generic fallback
        const dur = growingDurationDays || 120;
        return {
            duration: dur,
            stages: DEFAULT_STAGES,
            tasks: [
                { dayNumber: 1, title: 'Sowing', description: `Prepare field and sow ${cropName}.`, taskType: 'general' },
                { dayNumber: 20, title: 'First Irrigation', description: 'Apply first irrigation after establishment.', taskType: 'irrigation' },
                { dayNumber: 30, title: 'Fertilizer', description: 'Apply basal fertilizer as per soil health report.', taskType: 'fertilizer' },
                { dayNumber: 60, title: 'Pest Monitoring', description: 'Scout for pests and diseases.', taskType: 'monitoring' },
                { dayNumber: Math.round(dur * 0.8), title: 'Pre-harvest Check', description: 'Check crop maturity.', taskType: 'monitoring' },
                { dayNumber: dur, title: 'Harvest', description: `Harvest ${cropName} at full maturity.`, taskType: 'harvest' },
            ],
        };
    }
}
// ── AI daily recommendation ──────────────────────────────────────────────────
async function generateDailyRecommendation(context) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey)
        return `Your ${context.cropName} is at Day ${context.dayAge} (${context.stage} stage). Follow the scheduled tasks for today.`;
    try {
        const prompt = `You are an AI farm advisor for Indian farmers. In 2-3 sentences give a specific actionable daily tip.

Crop: ${context.cropName}, Day ${context.dayAge}, Stage: ${context.stage}
Location: ${context.district}, ${context.state}
${context.moisture ? `Soil Moisture: ${context.moisture}%` : ''}
${context.humidity ? `Humidity: ${context.humidity}%` : ''}
${context.temp ? `Temperature: ${context.temp}°C` : ''}
${context.modalPrice ? `Market Price: ₹${context.modalPrice}/quintal` : ''}
${context.soilHealth ? `Soil Health: ${context.soilHealth}` : ''}

Give ONE specific recommendation in simple Hindi-English (Hinglish) or English.`;
        const res = await fetch(getApiUrl(), {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                model: process.env.OPENAI_MODEL || 'openai/gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.4,
                max_tokens: 150,
            }),
        });
        if (!res.ok)
            throw new Error('AI failed');
        const data = await res.json();
        return data.choices?.[0]?.message?.content?.trim() || '';
    }
    catch {
        return `Your ${context.cropName} is at Day ${context.dayAge} (${context.stage} stage). Check today's scheduled tasks and monitor your crop condition.`;
    }
}
//# sourceMappingURL=aiFosEngine.js.map