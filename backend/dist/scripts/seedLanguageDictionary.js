"use strict";
/**
 * Seed script: populate LanguageDictionary with initial entries.
 * Run: ts-node src/scripts/seedLanguageDictionary.ts
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const mongoose_1 = __importDefault(require("mongoose"));
const LanguageDictionary_1 = require("../models/LanguageDictionary");
function nk(s) {
    return s.toLowerCase().replace(/[\s_\-]+/g, '');
}
const entries = [
    // ── Crops ──────────────────────────────────────────────────────────────────
    { english: 'Wheat', hindi: 'गेहूँ', marwari: 'गेहूँ', category: 'crops', aliases: ['wheat', 'gehu', 'gehun'] },
    { english: 'Rice', hindi: 'चावल', marwari: 'चावल', category: 'crops', aliases: ['rice', 'chawal', 'dhan'] },
    { english: 'Maize', hindi: 'मक्का', marwari: 'मक्की', category: 'crops', aliases: ['maize', 'corn', 'makka', 'makki'] },
    { english: 'Black Gram', hindi: 'उड़द', marwari: 'उड़द', category: 'crops', aliases: ['blackgram', 'blackgram', 'urad', 'urd', 'black gram', 'black_gram', 'black-gram'] },
    { english: 'Green Gram', hindi: 'मूँग', marwari: 'मूँग', category: 'crops', aliases: ['greengram', 'moong', 'mung', 'green gram', 'green_gram'] },
    { english: 'Mustard', hindi: 'सरसों', marwari: 'सरसों', category: 'crops', aliases: ['mustard', 'sarson', 'rai'] },
    { english: 'Soybean', hindi: 'सोयाबीन', marwari: 'सोयाबीन', category: 'crops', aliases: ['soybean', 'soya', 'soyabean'] },
    { english: 'Cotton', hindi: 'कपास', marwari: 'कपास', category: 'crops', aliases: ['cotton', 'kapas', 'narma'] },
    { english: 'Sugarcane', hindi: 'गन्ना', marwari: 'गन्ना', category: 'crops', aliases: ['sugarcane', 'ganna', 'ikhh'] },
    { english: 'Groundnut', hindi: 'मूँगफली', marwari: 'मूँगफली', category: 'crops', aliases: ['groundnut', 'peanut', 'moongfali', 'mungfali'] },
    { english: 'Chickpea', hindi: 'चना', marwari: 'चणा', category: 'crops', aliases: ['chickpea', 'chana', 'gram', 'chick pea'] },
    { english: 'Bajra', hindi: 'बाजरा', marwari: 'बाजरो', category: 'crops', aliases: ['bajra', 'bajri', 'pearl millet', 'pearlmillet'] },
    { english: 'Jowar', hindi: 'ज्वार', marwari: 'ज्वार', category: 'crops', aliases: ['jowar', 'sorghum', 'jwar'] },
    { english: 'Tomato', hindi: 'टमाटर', marwari: 'टमाटर', category: 'crops', aliases: ['tomato', 'tamatar'] },
    { english: 'Onion', hindi: 'प्याज', marwari: 'डुंगरी', category: 'crops', aliases: ['onion', 'pyaz', 'pyaaj', 'dungri'] },
    { english: 'Potato', hindi: 'आलू', marwari: 'आलू', category: 'crops', aliases: ['potato', 'aloo', 'alu'] },
    // ── Diseases ───────────────────────────────────────────────────────────────
    { english: 'Leaf Blight', hindi: 'पत्ती झुलसा', category: 'diseases', aliases: ['leafblight', 'leaf blight', 'leaf_blight', 'patti jhulsa'] },
    { english: 'Powdery Mildew', hindi: 'चूर्णिल आसिता', category: 'diseases', aliases: ['powderymildew', 'powdery mildew', 'churnilasita'] },
    { english: 'Rust', hindi: 'रतुआ', category: 'diseases', aliases: ['rust', 'ratua', 'ratuaa'] },
    { english: 'Bacterial Wilt', hindi: 'जीवाणु म्लानि', category: 'diseases', aliases: ['bacterialwilt', 'bacterial wilt', 'jivanu mlani'] },
    { english: 'Yellow Mosaic', hindi: 'पीला मोज़ेक', category: 'diseases', aliases: ['yellowmosaic', 'yellow mosaic', 'peela mosaic'] },
    { english: 'Stem Rot', hindi: 'तना सड़न', category: 'diseases', aliases: ['stemrot', 'stem rot', 'tana sadan'] },
    { english: 'Root Rot', hindi: 'जड़ सड़न', category: 'diseases', aliases: ['rootrot', 'root rot', 'jad sadan'] },
    { english: 'Anthracnose', hindi: 'एन्थ्रेक्नोज', category: 'diseases', aliases: ['anthracnose', 'anthrax'] },
    // ── Pests ──────────────────────────────────────────────────────────────────
    { english: 'Aphid', hindi: 'माहू', category: 'pests', aliases: ['aphid', 'mahu', 'aphids'] },
    { english: 'Whitefly', hindi: 'सफेद मक्खी', category: 'pests', aliases: ['whitefly', 'white fly', 'safed makkhi'] },
    { english: 'Bollworm', hindi: 'बॉलवर्म', category: 'pests', aliases: ['bollworm', 'boll worm', 'american bollworm'] },
    { english: 'Stem Borer', hindi: 'तना छेदक', category: 'pests', aliases: ['stemborer', 'stem borer', 'tana chhedak'] },
    { english: 'Locust', hindi: 'टिड्डी', category: 'pests', aliases: ['locust', 'tiddi', 'tiddi dal'] },
    { english: 'Thrips', hindi: 'थ्रिप्स', category: 'pests', aliases: ['thrips', 'thrip'] },
    // ── Fertilizers ────────────────────────────────────────────────────────────
    { english: 'Urea', hindi: 'यूरिया', category: 'fertilizers', aliases: ['urea', 'yuria'] },
    { english: 'DAP', hindi: 'डीएपी', category: 'fertilizers', aliases: ['dap', 'diammonium phosphate'] },
    { english: 'NPK', hindi: 'एनपीके', category: 'fertilizers', aliases: ['npk', 'n p k'] },
    { english: 'Potash', hindi: 'पोटाश', category: 'fertilizers', aliases: ['potash', 'mop', 'muriate of potash'] },
    { english: 'Compost', hindi: 'खाद', marwari: 'खाद', category: 'fertilizers', aliases: ['compost', 'khad', 'organic manure'] },
    { english: 'Vermicompost', hindi: 'वर्मी कम्पोस्ट', category: 'fertilizers', aliases: ['vermicompost', 'vermi compost', 'kechua khad'] },
    // ── Soil ───────────────────────────────────────────────────────────────────
    { english: 'pH', hindi: 'पीएच', category: 'soil', aliases: ['ph', 'soil ph'] },
    { english: 'Nitrogen', hindi: 'नाइट्रोजन', category: 'soil', aliases: ['nitrogen', 'n', 'naaitrojan'] },
    { english: 'Phosphorus', hindi: 'फास्फोरस', category: 'soil', aliases: ['phosphorus', 'p', 'phosphorous'] },
    { english: 'Potassium', hindi: 'पोटेशियम', category: 'soil', aliases: ['potassium', 'k'] },
    { english: 'Organic Carbon', hindi: 'जैविक कार्बन', category: 'soil', aliases: ['organiccarbons', 'organic carbon', 'oc'] },
    { english: 'Sandy Soil', hindi: 'बलुई मिट्टी', marwari: 'रेतीली माटी', category: 'soil', aliases: ['sandysoil', 'sandy soil', 'balui mitti'] },
    { english: 'Clay Soil', hindi: 'चिकनी मिट्टी', category: 'soil', aliases: ['claysoil', 'clay soil', 'chikni mitti'] },
    { english: 'Loamy Soil', hindi: 'दोमट मिट्टी', category: 'soil', aliases: ['loamysoil', 'loamy soil', 'domat mitti'] },
    // ── Weather ────────────────────────────────────────────────────────────────
    { english: 'Rainfall', hindi: 'वर्षा', marwari: 'मेह', category: 'weather', aliases: ['rainfall', 'rain', 'varsha', 'meh', 'baarish'] },
    { english: 'Temperature', hindi: 'तापमान', category: 'weather', aliases: ['temperature', 'tapman', 'garmi'] },
    { english: 'Humidity', hindi: 'आर्द्रता', category: 'weather', aliases: ['humidity', 'aardrata', 'nem'] },
    { english: 'Drought', hindi: 'सूखा', marwari: 'अकाल', category: 'weather', aliases: ['drought', 'sukha', 'akal'] },
    { english: 'Frost', hindi: 'पाला', marwari: 'पाळो', category: 'weather', aliases: ['frost', 'pala', 'palo'] },
    // ── Government ─────────────────────────────────────────────────────────────
    { english: 'PM Kisan', hindi: 'पीएम किसान', category: 'government', aliases: ['pmkisan', 'pm kisan', 'pradhan mantri kisan'] },
    { english: 'Kisan Credit Card', hindi: 'किसान क्रेडिट कार्ड', category: 'government', aliases: ['kisancreditcard', 'kcc', 'kisan credit card'] },
    { english: 'Fasal Bima', hindi: 'फसल बीमा', category: 'government', aliases: ['fasalbima', 'fasal bima', 'crop insurance', 'pmfby'] },
    { english: 'Soil Health Card', hindi: 'मृदा स्वास्थ्य कार्ड', category: 'government', aliases: ['soilhealthcard', 'soil health card', 'mridaswasthyakard'] },
    { english: 'MSP', hindi: 'न्यूनतम समर्थन मूल्य', category: 'government', aliases: ['msp', 'minimum support price', 'nyuntam samarthan mulya'] },
    // ── Agriculture Terms ──────────────────────────────────────────────────────
    { english: 'Irrigation', hindi: 'सिंचाई', marwari: 'पाणी देणो', category: 'agriculture', aliases: ['irrigation', 'sinchai', 'pani dena'] },
    { english: 'Sowing', hindi: 'बुवाई', marwari: 'बीजणो', category: 'agriculture', aliases: ['sowing', 'buwai', 'bijno', 'beej bona'] },
    { english: 'Harvesting', hindi: 'कटाई', marwari: 'लुणाई', category: 'agriculture', aliases: ['harvesting', 'katai', 'lunai', 'fasal katna'] },
    { english: 'Crop Rotation', hindi: 'फसल चक्र', category: 'agriculture', aliases: ['croprotation', 'crop rotation', 'fasal chakra'] },
    { english: 'Intercropping', hindi: 'मिश्रित खेती', category: 'agriculture', aliases: ['intercropping', 'mixed farming', 'mishrit kheti'] },
    { english: 'Drip Irrigation', hindi: 'टपक सिंचाई', category: 'agriculture', aliases: ['dripirrigation', 'drip irrigation', 'tapak sinchai'] },
    { english: 'Sprinkler', hindi: 'फव्वारा सिंचाई', category: 'agriculture', aliases: ['sprinkler', 'sprinkler irrigation', 'fawwara'] },
    { english: 'Pesticide', hindi: 'कीटनाशक', category: 'agriculture', aliases: ['pesticide', 'keetnaashak', 'keetnashak', 'dawa'] },
    { english: 'Herbicide', hindi: 'खरपतवारनाशक', category: 'agriculture', aliases: ['herbicide', 'weedicide', 'kharpatawar nashak'] },
    { english: 'Fungicide', hindi: 'फफूंदनाशक', category: 'agriculture', aliases: ['fungicide', 'fafundnashak'] },
    // ── UI Labels ──────────────────────────────────────────────────────────────
    { english: 'Submit', hindi: 'जमा करें', category: 'ui', aliases: ['submit', 'jama karo', 'jama karen'] },
    { english: 'Search', hindi: 'खोजें', category: 'ui', aliases: ['search', 'khojo', 'khoje', 'dhundho'] },
    { english: 'Language', hindi: 'भाषा', category: 'ui', aliases: ['language', 'bhasha', 'boli'] },
    { english: 'Dashboard', hindi: 'डैशबोर्ड', category: 'ui', aliases: ['dashboard'] },
    { english: 'Profile', hindi: 'प्रोफ़ाइल', category: 'ui', aliases: ['profile', 'profail'] },
    { english: 'Logout', hindi: 'लॉग आउट', category: 'ui', aliases: ['logout', 'log out', 'nikal jao'] },
];
async function seed() {
    await mongoose_1.default.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');
    let created = 0, skipped = 0;
    for (const e of entries) {
        const normalizedKey = nk(e.english);
        const aliases = Array.from(new Set((e.aliases ?? []).map(nk)));
        try {
            await LanguageDictionary_1.LanguageDictionary.updateOne({ normalizedKey }, {
                $setOnInsert: {
                    normalizedKey,
                    english: e.english,
                    hindi: e.hindi,
                    marwari: e.marwari,
                    category: e.category,
                    aliases,
                    confidence: 1,
                    approved: true,
                },
            }, { upsert: true });
            created++;
        }
        catch {
            skipped++;
        }
    }
    console.log(`Seed complete: ${created} upserted, ${skipped} skipped`);
    await mongoose_1.default.disconnect();
}
seed().catch(err => { console.error(err); process.exit(1); });
//# sourceMappingURL=seedLanguageDictionary.js.map