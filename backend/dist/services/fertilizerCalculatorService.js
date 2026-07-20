"use strict";
// =============================================================================
// Fertilizer Calculator Service
// Calculates organic + chemical fertilizer requirements based on:
//   crop nutrient demand × area − soil available nutrients
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.AREA_UNITS = exports.SUPPORTED_CROPS = void 0;
exports.calculateFertilizer = calculateFertilizer;
// Conversion to hectares
const TO_HECTARE = {
    hectare: 1,
    acre: 0.404686,
    bigha: 0.2529, // 1 Rajasthan/UP bigha ≈ 0.2529 ha
    guntha: 0.010117,
    katha: 0.006772,
};
// NPK requirement in kg/hectare for each crop (N, P2O5, K2O)
const CROP_NPK = {
    wheat: { N: 120, P: 60, K: 40, label: 'Wheat', labelHi: 'गेहूं' },
    rice: { N: 120, P: 60, K: 60, label: 'Rice', labelHi: 'धान' },
    maize: { N: 150, P: 75, K: 50, label: 'Maize', labelHi: 'मक्का' },
    cotton: { N: 150, P: 60, K: 60, label: 'Cotton', labelHi: 'कपास' },
    sugarcane: { N: 250, P: 100, K: 120, label: 'Sugarcane', labelHi: 'गन्ना' },
    potato: { N: 180, P: 100, K: 150, label: 'Potato', labelHi: 'आलू' },
    tomato: { N: 120, P: 80, K: 100, label: 'Tomato', labelHi: 'टमाटर' },
    onion: { N: 100, P: 50, K: 100, label: 'Onion', labelHi: 'प्याज' },
    mustard: { N: 80, P: 40, K: 40, label: 'Mustard', labelHi: 'सरसों' },
    soybean: { N: 30, P: 60, K: 40, label: 'Soybean', labelHi: 'सोयाबीन' },
    gram: { N: 20, P: 50, K: 30, label: 'Gram', labelHi: 'चना' },
    groundnut: { N: 25, P: 50, K: 75, label: 'Groundnut', labelHi: 'मूंगफली' },
    sunflower: { N: 90, P: 60, K: 60, label: 'Sunflower', labelHi: 'सूरजमुखी' },
    bajra: { N: 80, P: 40, K: 40, label: 'Bajra', labelHi: 'बाजरा' },
    jowar: { N: 80, P: 40, K: 40, label: 'Jowar', labelHi: 'ज्वार' },
    barley: { N: 60, P: 30, K: 20, label: 'Barley', labelHi: 'जौ' },
    lentil: { N: 20, P: 40, K: 20, label: 'Lentil', labelHi: 'मसूर' },
    moong: { N: 20, P: 40, K: 20, label: 'Moong', labelHi: 'मूंग' },
    urad: { N: 20, P: 40, K: 20, label: 'Urad', labelHi: 'उड़द' },
    garlic: { N: 100, P: 50, K: 80, label: 'Garlic', labelHi: 'लहसुन' },
    ginger: { N: 75, P: 50, K: 75, label: 'Ginger', labelHi: 'अदरक' },
    turmeric: { N: 60, P: 50, K: 120, label: 'Turmeric', labelHi: 'हल्दी' },
    brinjal: { N: 100, P: 50, K: 50, label: 'Brinjal', labelHi: 'बैंगन' },
    cabbage: { N: 120, P: 60, K: 60, label: 'Cabbage', labelHi: 'पत्तागोभी' },
    cauliflower: { N: 120, P: 60, K: 60, label: 'Cauliflower', labelHi: 'फूलगोभी' },
    pea: { N: 40, P: 60, K: 50, label: 'Pea', labelHi: 'मटर' },
};
// Organic options database — sorted by priority (1 = highest)
function buildOrganicOptions(defN, defP, defK, areaHa) {
    const options = [];
    // FYM always recommended
    const fymTons = Math.round(areaHa * 10 * 10) / 10;
    options.push({
        name: 'Farm Yard Manure (FYM)',
        nameHi: 'गोबर की खाद (FYM)',
        quantity: `${fymTons} tonnes`,
        benefit: 'Improves soil structure, adds all nutrients slowly',
        benefitHi: 'मिट्टी की संरचना सुधारे, सभी पोषक तत्व धीरे-धीरे मिलें',
        priority: 1,
    });
    // Vermicompost
    const vermiTons = Math.round(areaHa * 2.5 * 10) / 10;
    options.push({
        name: 'Vermicompost',
        nameHi: 'वर्मीकम्पोस्ट',
        quantity: `${vermiTons} tonnes`,
        benefit: 'Rich in micronutrients, improves water retention',
        benefitHi: 'सूक्ष्म पोषक तत्वों से भरपूर, जल धारण क्षमता बढ़ाए',
        priority: 2,
    });
    if (defN > 30) {
        options.push({
            name: 'Neem Cake',
            nameHi: 'नीम की खली',
            quantity: `${Math.round(areaHa * 200)} kg`,
            benefit: 'Slow-release nitrogen + pest repellent',
            benefitHi: 'धीमी गति से नाइट्रोजन + कीट नाशक',
            priority: 3,
        });
        options.push({
            name: 'Green Manure (Dhaincha/Sunhemp)',
            nameHi: 'हरी खाद (ढैंचा/सनई)',
            quantity: `${Math.round(areaHa * 25)} kg seed`,
            benefit: 'Fixes atmospheric nitrogen, adds organic matter',
            benefitHi: 'वायुमंडलीय नाइट्रोजन स्थिर करे, जैविक पदार्थ बढ़ाए',
            priority: 4,
        });
    }
    if (defP > 20) {
        options.push({
            name: 'Rock Phosphate',
            nameHi: 'रॉक फॉस्फेट',
            quantity: `${Math.round(areaHa * 250)} kg`,
            benefit: 'Slow-release phosphorus, improves root growth',
            benefitHi: 'धीमी गति से फॉस्फोरस, जड़ विकास में सहायक',
            priority: 5,
        });
    }
    if (defK > 20) {
        options.push({
            name: 'Wood Ash',
            nameHi: 'लकड़ी की राख',
            quantity: `${Math.round(areaHa * 500)} kg`,
            benefit: 'Natural potassium source, raises soil pH',
            benefitHi: 'प्राकृतिक पोटाश स्रोत, मिट्टी का pH बढ़ाए',
            priority: 6,
        });
    }
    options.push({
        name: 'Biofertilizer (Rhizobium/PSB/KSB)',
        nameHi: 'जैव उर्वरक (राइजोबियम/PSB/KSB)',
        quantity: `${Math.round(areaHa * 5)} packets (200g each)`,
        benefit: 'Fixes N, solubilizes P & K, boosts soil biology',
        benefitHi: 'नाइट्रोजन स्थिरीकरण, P-K घुलनशीलता, मिट्टी जीवाणु बढ़ाए',
        priority: 7,
    });
    return options.sort((a, b) => a.priority - b.priority);
}
// Chemical fertilizer calculation
// Nutrient content: Urea=46%N, DAP=18%N+46%P, MOP=60%K, SSP=16%P, CAN=26%N
function buildChemicalFertilizers(defN, defP, defK, areaHa) {
    const result = [];
    // After organic, assume 40% of deficit covered by organic
    const chemN = Math.max(0, defN * 0.6);
    const chemP = Math.max(0, defP * 0.6);
    const chemK = Math.max(0, defK * 0.6);
    // DAP covers P + some N
    if (chemP > 0) {
        const dapKg = Math.round((chemP / 0.46) * areaHa);
        const nFromDap = Math.round(dapKg * 0.18);
        result.push({
            name: 'DAP (Di-Ammonium Phosphate)',
            nameHi: 'डीएपी (डाई-अमोनियम फॉस्फेट)',
            npkRatio: '18:46:0',
            quantityKg: dapKg,
            quantityPerUnit: `${Math.round(dapKg / areaHa)} kg/ha`,
            nutrientProvided: `P₂O₅: ${Math.round(chemP * areaHa)} kg, N: ${nFromDap} kg`,
            applicationTime: 'Basal (at sowing)',
            applicationTimeHi: 'बुवाई के समय (बेसल)',
            costEstimate: `₹${Math.round(dapKg * 27)}–₹${Math.round(dapKg * 30)}`,
        });
        // Reduce N requirement by N from DAP
        const remainN = Math.max(0, chemN - nFromDap / areaHa);
        if (remainN > 0) {
            const ureaKg = Math.round((remainN / 0.46) * areaHa);
            result.push({
                name: 'Urea',
                nameHi: 'यूरिया',
                npkRatio: '46:0:0',
                quantityKg: ureaKg,
                quantityPerUnit: `${Math.round(ureaKg / areaHa)} kg/ha`,
                nutrientProvided: `N: ${Math.round(remainN * areaHa)} kg`,
                applicationTime: 'Split: 50% basal + 50% top-dress at tillering',
                applicationTimeHi: '50% बुवाई + 50% कल्ले निकलते समय',
                costEstimate: `₹${Math.round(ureaKg * 6)}–₹${Math.round(ureaKg * 7)}`,
            });
        }
    }
    else if (chemN > 0) {
        const ureaKg = Math.round((chemN / 0.46) * areaHa);
        result.push({
            name: 'Urea',
            nameHi: 'यूरिया',
            npkRatio: '46:0:0',
            quantityKg: ureaKg,
            quantityPerUnit: `${Math.round(ureaKg / areaHa)} kg/ha`,
            nutrientProvided: `N: ${Math.round(chemN * areaHa)} kg`,
            applicationTime: 'Split: 50% basal + 50% top-dress',
            applicationTimeHi: '50% बुवाई + 50% खड़ी फसल में',
            costEstimate: `₹${Math.round(ureaKg * 6)}–₹${Math.round(ureaKg * 7)}`,
        });
    }
    if (chemK > 0) {
        const mopKg = Math.round((chemK / 0.60) * areaHa);
        result.push({
            name: 'MOP (Muriate of Potash)',
            nameHi: 'एमओपी (म्यूरेट ऑफ पोटाश)',
            npkRatio: '0:0:60',
            quantityKg: mopKg,
            quantityPerUnit: `${Math.round(mopKg / areaHa)} kg/ha`,
            nutrientProvided: `K₂O: ${Math.round(chemK * areaHa)} kg`,
            applicationTime: 'Basal (at sowing)',
            applicationTimeHi: 'बुवाई के समय (बेसल)',
            costEstimate: `₹${Math.round(mopKg * 17)}–₹${Math.round(mopKg * 20)}`,
        });
    }
    return result;
}
function buildSchedule(crop) {
    const base = [
        { stage: 'Land Preparation', stageHi: 'भूमि तैयारी', products: 'FYM, Vermicompost, Rock Phosphate, DAP, MOP' },
        { stage: 'Sowing / Transplanting', stageHi: 'बुवाई / रोपाई', products: 'Biofertilizer seed treatment, 50% Urea' },
        { stage: 'Vegetative Stage (30–40 days)', stageHi: 'वानस्पतिक अवस्था (30–40 दिन)', products: '50% Urea top-dress, Neem Cake' },
        { stage: 'Flowering / Fruiting', stageHi: 'फूल / फल अवस्था', products: 'Foliar spray: 2% DAP solution or 0.5% Boron' },
    ];
    if (['sugarcane', 'potato', 'cotton'].includes(crop)) {
        base.push({ stage: 'Ratoon / Second Dose', stageHi: 'रैटून / दूसरी खुराक', products: 'Additional Urea + MOP split dose' });
    }
    return base;
}
function calculateFertilizer(input) {
    const { crop, areaValue, areaUnit, soil } = input;
    const cropKey = crop.toLowerCase().trim();
    const cropData = CROP_NPK[cropKey] || CROP_NPK['wheat'];
    const areaHa = areaValue * TO_HECTARE[areaUnit];
    // Total crop requirement (kg for the whole field)
    const totalN = cropData.N * areaHa;
    const totalP = cropData.P * areaHa;
    const totalK = cropData.K * areaHa;
    // Available from soil (convert kg/ha to field total)
    const soilN = (soil?.nitrogen ?? 0) * areaHa;
    const soilP = (soil?.phosphorus ?? 0) * areaHa;
    const soilK = (soil?.potassium ?? 0) * areaHa;
    // Deficit = what we need to apply
    const defN = Math.max(0, totalN - soilN);
    const defP = Math.max(0, totalP - soilP);
    const defK = Math.max(0, totalK - soilK);
    // Per-hectare deficits for fertilizer calc
    const defNha = areaHa > 0 ? defN / areaHa : cropData.N;
    const defPha = areaHa > 0 ? defP / areaHa : cropData.P;
    const defKha = areaHa > 0 ? defK / areaHa : cropData.K;
    const organicFirst = buildOrganicOptions(defNha, defPha, defKha, areaHa);
    const chemicalFertilizers = buildChemicalFertilizers(defNha, defPha, defKha, areaHa);
    // Cost estimate
    const chemCostMin = chemicalFertilizers.reduce((s, f) => {
        const m = f.costEstimate.match(/₹(\d+)/);
        return s + (m ? parseInt(m[1]) : 0);
    }, 0);
    const chemCostMax = chemicalFertilizers.reduce((s, f) => {
        const m = f.costEstimate.match(/₹\d+–₹(\d+)/);
        return s + (m ? parseInt(m[1]) : 0);
    }, 0);
    const organicCostMin = Math.round(areaHa * 3000);
    const organicCostMax = Math.round(areaHa * 5000);
    const tips = [
        'Always do soil testing before applying fertilizers.',
        'Apply organic manure 2–3 weeks before sowing for best results.',
        'Split urea application reduces nitrogen loss by 30–40%.',
        'Biofertilizers can reduce chemical fertilizer need by 20–25%.',
        'Avoid over-application — excess fertilizer pollutes groundwater.',
    ];
    const tipsHi = [
        'उर्वरक डालने से पहले हमेशा मिट्टी की जांच करें।',
        'सर्वोत्तम परिणाम के लिए बुवाई से 2–3 सप्ताह पहले जैविक खाद डालें।',
        'यूरिया को विभाजित मात्रा में देने से नाइट्रोजन की हानि 30–40% कम होती है।',
        'जैव उर्वरक रासायनिक उर्वरक की आवश्यकता 20–25% कम कर सकते हैं।',
        'अधिक उर्वरक न डालें — अतिरिक्त उर्वरक भूजल को प्रदूषित करता है।',
    ];
    return {
        crop: cropData.label,
        cropHi: cropData.labelHi,
        areaHectares: Math.round(areaHa * 100) / 100,
        areaDisplay: `${areaValue} ${areaUnit}`,
        requiredN: Math.round(totalN),
        requiredP: Math.round(totalP),
        requiredK: Math.round(totalK),
        deficitN: Math.round(defN),
        deficitP: Math.round(defP),
        deficitK: Math.round(defK),
        organicFirst,
        chemicalFertilizers,
        applicationSchedule: buildSchedule(cropKey),
        totalCostMin: chemCostMin + organicCostMin,
        totalCostMax: chemCostMax + organicCostMax,
        soilUsed: !!(soil?.nitrogen || soil?.phosphorus || soil?.potassium),
        tips,
        tipsHi,
    };
}
exports.SUPPORTED_CROPS = Object.entries(CROP_NPK).map(([key, v]) => ({
    key,
    label: v.label,
    labelHi: v.labelHi,
}));
exports.AREA_UNITS = [
    { value: 'bigha', label: 'Bigha', labelHi: 'बीघा' },
    { value: 'acre', label: 'Acre', labelHi: 'एकड़' },
    { value: 'hectare', label: 'Hectare', labelHi: 'हेक्टेयर' },
    { value: 'guntha', label: 'Guntha', labelHi: 'गुंठा' },
    { value: 'katha', label: 'Katha', labelHi: 'कट्ठा' },
];
//# sourceMappingURL=fertilizerCalculatorService.js.map