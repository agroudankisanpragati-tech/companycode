# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: intent_engine/intent_alias_resolver.py
# Purpose: Alias-based intent override — runs BEFORE the ML model.
#          Covers real farmer vocabulary across Hindi, English, Hinglish,
#          Rajasthani, Punjabi, Gujarati, Bengali, Tamil transliterations.
#          Normalises input then does O(1) dict lookup.
# =============================================================================

from __future__ import annotations

import re
import unicodedata
from typing import Optional

# ---------------------------------------------------------------------------
# ALIAS TABLE
# intent → frozenset of normalised alias strings
# ---------------------------------------------------------------------------

_RAW: dict[str, list[str]] = {

    "greeting": [
        "hello", "hi", "hey", "hii", "helo", "helo ji",
        "namaste", "namasthe", "namastey", "namaskar", "namaskara", "namaskaram",
        "ram ram", "ram ram sa", "ram ram ji", "ram ram bhai", "jai shree ram",
        "jai shri ram", "jai shri krishna", "jai shri krishna ji",
        "radhe radhe", "radhe radhe ji",
        "khamma ghani", "khamma ghani sa", "khamma",
        "kem cho", "kem chho", "kemcho", "kem chhe",
        "sat sri akal", "sasriyakal", "sat shri akal", "waheguru",
        "adaab", "adab", "salaam", "assalamu alaikum",
        "good morning", "good afternoon", "good evening", "good night",
        "vanakkam", "nomoshkar", "pranam", "pranaam", "charan sparsh",
        "suprabhat", "shubh prabhat", "shubh din",
        "kya haal hai", "kaise ho", "kaisa hai", "sab theek",
        "start", "shuru", "begin", "open",
    ],

    "disease": [
        # Hindi / Hinglish
        "rog", "bimari", "beemari", "bemarhi", "bemari", "bimarhi",
        "keeda", "kida", "kide", "keede", "keedaa",
        "pest", "pests", "aphid", "aphids", "maahu", "mahu",
        "whitefly", "white fly", "safed makhi",
        "fungus", "fungi", "फफूंद", "phaphoond", "phaphund",
        "virus", "viral", "infection", "infekshan",
        "illness", "beemar", "takleef",
        "disease", "diseases", "crop disease", "fasal rog",
        "problem in crop", "crop problem", "fasal me problem",
        "meri fasal me problem hai", "meri fasal kharab ho gayi",
        "fasal kharab", "fasal mar rahi hai", "fasal sukh rahi hai",
        "leaf problem", "patti ki problem", "patti kharab",
        "yellow leaf", "yellow leaves", "peeli patti", "peele patte",
        "patte peele ho rahe hain", "patte peele pad rahe hain",
        "leaf spot", "patti par daag", "daag",
        "stem rot", "tana gal raha hai", "tana saad raha hai",
        "root rot", "jad gal rahi hai", "jad saad rahi hai",
        "fruit rot", "fal gal raha hai",
        "plant dying", "crop dying", "ped mar raha hai",
        "jhulsa", "jhulsan", "blast", "blight", "rust", "zang",
        "powdery mildew", "downy mildew", "tikka", "tikka rog",
        "wilt", "murjhana", "murjha raha hai",
        "caterpillar", "sundi", "sund", "larva",
        "locust", "tiddi", "tiddi dal",
        "mite", "spider mite", "red mite",
        "thrips", "jassid", "stem borer", "tana borer",
        "nematode", "sutra krimi",
        "rog batao", "bimari batao", "keede batao",
        "kya rog hai", "kya bimari hai",
        "ilaj batao", "dawa batao", "upchar batao",
        "treatment", "cure", "dawai", "dawa", "ilaj", "upchar", "upay",
    ],

    "weather": [
        # Hindi / Hinglish
        "mosam", "mausam", "mausam batao", "mausam kaisa hai",
        "aaj ka mausam", "kal ka mausam", "parso ka mausam",
        "weather", "weather today", "today weather", "weather forecast",
        "forecast", "aaj ka forecast",
        "barish", "baarish", "barsaat", "varsha", "rain", "rainfall",
        "barish hogi", "barish kab hogi", "barish ka hal",
        "temperature", "temp", "tapman",
        "garmi", "garam", "heat", "hot",
        "sardi", "thand", "thandi", "cold", "cool",
        "humidity", "nami", "aardrata",
        "wind", "hawa", "tez hawa", "andhi",
        "storm", "toofan", "aandhi", "cyclone",
        "hail", "ola", "ole", "olavrushti",
        "fog", "kohra", "dhund",
        "cloud", "badal", "cloudy",
        "sunny", "dhoop", "sunshine",
        "frost", "pala", "paala",
        "aaj mausam", "kal mausam", "is hafte mausam",
        "kitni garmi", "kitni sardi", "kitni barish",
    ],

    "government": [
        # Hindi / Hinglish
        "yojna", "yojana", "scheme", "schemes", "sarkari yojana",
        "subsidy", "subsidi", "anudan", "sahayata",
        "pm kisan", "pm-kisan", "pmkisan", "pradhan mantri kisan",
        "pmfby", "pm fasal bima yojana", "pradhan mantri fasal bima",
        "crop insurance", "fasal bima", "bima", "insurance",
        "kcc", "kisan credit card", "kisan card",
        "loan", "rin", "karz", "karj", "udhar",
        "government help", "sarkari madad", "sarkar ki madad",
        "sarkari sahayata", "government support",
        "kisan samman nidhi", "samman nidhi",
        "soil health card", "mitti swasthya card",
        "e-nam", "enam", "national agriculture market",
        "mksy", "mukhyamantri kisan",
        "rajasthan kisan", "up kisan", "mp kisan",
        "kisan registration", "kisan portal",
        "government scheme", "govt scheme", "govt yojana",
        "apply kaise kare", "registration kaise kare",
        "form kaise bhare", "documents kya chahiye",
        "paisa kab milega", "kab milega paisa",
    ],

    "market": [
        # Hindi / Hinglish — single word triggers (CRITICAL)
        "mandi", "mandy", "mandi bhav", "mandi rate", "mandi price",
        "mandi bhav batao", "mandi ka bhav", "mandi ka rate",
        "aaj ki mandi", "aaj ka mandi bhav", "today mandi",
        "bhav", "bhaav", "bhav batao", "aaj ka bhav", "bhav kya hai",
        "rate", "rates", "price", "prices",
        "market", "market rate", "market price", "market bhav",
        "market today", "today market", "today price",
        "aaj ka rate", "aaj ka price", "aaj ka market",
        "bajar", "bazar", "bazaar", "baazaar",
        "commodity price", "fasal ka bhav", "fasal ka rate",
        "fasal bhav", "fasal rate", "fasal price",
        "gehu bhav", "gehun bhav", "wheat price", "wheat bhav",
        "chawal bhav", "rice price", "dhan bhav", "dhan rate",
        "sarson bhav", "mustard price", "sarson rate",
        "soybean bhav", "soyabean price", "soya bhav",
        "cotton bhav", "kapas bhav", "kapas rate",
        "onion price", "pyaz bhav", "pyaaz rate", "pyaz rate",
        "tomato price", "tamatar bhav", "tamatar rate",
        "potato price", "aloo bhav", "aloo rate",
        "chana bhav", "gram price", "chana rate",
        "moong bhav", "urad bhav", "moong rate", "urad rate",
        "kahan bechu", "kahan beche", "fasal kahan beche",
        "sabse acha bhav", "best rate", "sabse acha rate",
        "export", "import", "demand",
        "neelamee", "neelami", "auction",
        # Devanagari script
        "मंडी", "मंडी भाव", "मंडी रेट", "मंडी प्राइस",
        "भाव", "भाव बताओ", "आज का भाव", "आज का मंडी भाव",
        "बाजार", "बाज़ार", "बाजार भाव",
        "रेट", "प्राइस", "दाम",
        "फसल का भाव", "फसल भाव", "फसल रेट",
        "गेहूं भाव", "चावल भाव", "सरसों भाव",
        "आज की मंडी", "मंडी का भाव",
        "नीलामी",
    ],

    "crop": [
        # Hindi / Hinglish
        "crop", "crops", "fasal", "fasalen",
        "kheti", "kheti batao", "kheti karna",
        "krishi", "agriculture", "farming",
        "bovai", "buvai", "sowing", "biji",
        "harvesting", "katai", "fasal katna",
        "crop recommendation", "fasal ki salah",
        "best crop", "konsi fasal", "kaunsi fasal",
        "kya ugaun", "kya lagaun", "kya booun",
        "is mausam me kya ugaun", "is season me kya lagaun",
        "rabi", "kharif", "zaid",
        "gehu", "gehun", "wheat",
        "chawal", "dhan", "rice", "paddy",
        "makka", "maize", "corn",
        "sarson", "mustard",
        "soybean", "soya",
        "cotton", "kapas",
        "ganna", "sugarcane",
        "moong", "urad", "chana", "masoor", "arhar", "tur",
        "tomato", "tamatar", "onion", "pyaz", "potato", "aloo",
        "fasal salah", "crop advice", "crop suggestion",
        "intercropping", "mixed farming",
    ],

    "soil": [
        # Hindi / Hinglish
        "mitti", "mitti ki janch", "mitti test",
        "soil", "soil health", "soil test", "soil testing",
        "soil report", "mitti report",
        "ph", "ph level", "ph value", "mitti ka ph",
        "nitrogen", "naijrogen", "n content",
        "potassium", "potash", "k content",
        "phosphorus", "phosphate", "p content",
        "organic carbon", "organic matter", "jaivik carbon",
        "zinc", "boron", "sulphur", "iron", "manganese",
        "mitti ki upjau shakti", "upjau shakti", "fertility",
        "mitti sudhar", "soil improvement",
        "sandy soil", "clay soil", "loam", "baluyi mitti",
        "kali mitti", "lal mitti", "black soil", "red soil",
        "mitti ka rang", "mitti kaisi hai",
        "soil health card", "swasthya card",
    ],

    "fertilizer": [
        # Hindi / Hinglish
        "khad", "khaad", "khad batao", "konsi khad",
        "fertilizer", "fertiliser", "fertilizers",
        "urea", "dap", "npk", "potash", "mop",
        "sulphur", "zinc sulphate", "micronutrient",
        "vermicompost", "vermi compost", "kenchua khad",
        "organic fertilizer", "jaivik khad", "jeevamrit",
        "compost", "gobar khad", "gobar gas slurry",
        "bio fertilizer", "rhizobium", "azotobacter",
        "kitni khad dalu", "kab khad dalu", "khad kab dena chahiye",
        "khad ki matra", "dose of fertilizer",
        "top dressing", "basal dose",
        "foliar spray", "patti par chhidkav",
        "khad ki kami", "nutrient deficiency",
        "peeli patti khad", "lal patti khad",
    ],

    "seed": [
        # Hindi / Hinglish
        "seed", "seeds", "beej", "bij",
        "hybrid seed", "hybrid beej", "sankrit beej",
        "certified seed", "prmaanit beej",
        "seed variety", "beej ki kism", "variety",
        "konsa beej", "kaunsa beej", "best seed",
        "beej upchar", "seed treatment",
        "beej dar", "seed rate", "kitna beej",
        "beej kahan milega", "seed kahan milega",
        "hsd", "nsc", "national seed corporation",
        "gehu beej", "dhan beej", "makka beej",
        "sarson beej", "soybean beej",
        "vegetable seed", "sabji beej",
        "f1 hybrid", "open pollinated",
    ],

    "machinery": [
        # Hindi / Hinglish
        "tractor", "trektar", "tractor ki jankari",
        "machine", "machines", "yantra", "krishi yantra",
        "rotavator", "rotovator",
        "sprayer", "pump", "spray machine", "chhidkav yantra",
        "harvester", "combine", "combine harvester",
        "seed drill", "seed dreel", "buvai yantra",
        "cultivator", "kultivator",
        "thresher", "threshing machine",
        "plough", "hal", "halo",
        "leveler", "laser leveler",
        "transplanter", "rice transplanter",
        "power tiller", "mini tractor",
        "drone", "agri drone", "spray drone",
        "irrigation pump", "submersible pump",
        "machinery subsidy", "yantra anudan",
        "tractor loan", "machine loan",
        "kaunsi machine", "konsi machine", "machine batao",
    ],

    "irrigation": [
        # Hindi / Hinglish
        "pani", "paani", "pani dena", "pani kab dena",
        "water", "watering", "irrigation",
        "sinchai", "sichhai", "seenchain",
        "drip", "drip irrigation", "trickle",
        "sprinkler", "sprinkler irrigation", "phuhara",
        "flood irrigation", "furrow irrigation",
        "kab pani dena chahiye", "kitna pani dena chahiye",
        "pani ki kami", "water stress", "sukha",
        "bore well", "borewell", "tubewell", "nalkoop",
        "canal", "nahar", "nali",
        "rainwater harvesting", "barsaat ka pani",
        "water management", "pani bachao",
        "micro irrigation", "drip subsidy",
        "pani ka schedule", "irrigation schedule",
    ],

    "emergency": [
        # Hindi / Hinglish
        "help", "help me", "madad", "madad karo", "madad chahiye",
        "bachao", "bacha lo", "bachav",
        "urgent", "urgently", "jaldi", "jaldi karo",
        "emergency", "imarjency",
        "meri fasal mar rahi hai", "fasal mar rahi hai",
        "meri fasal kharab ho gayi", "fasal kharab ho gayi",
        "immediate help", "turant madad", "abhi madad",
        "sos", "s.o.s",
        "jaldi madad", "jaldi madad karo",
        "bahut nuksan", "bada nuksan", "bhari nuksan",
        "sab khatam ho gaya", "sab barbad ho gaya",
        "kya karu", "kya karun", "kya karen", "ab kya karu",
        "samajh nahi aa raha", "kuch samajh nahi",
        "poori fasal kharab", "poori fasal mar gayi",
        "locust attack", "tiddi hamla",
        "flood damage", "baadh", "baarh",
        "fire in field", "khet me aag",
        "hail damage", "ole se nuksan",
    ],

    "general": [
        "kya kar sakte ho", "kya kar sakta hai",
        "kya karta hai", "kya ho sakta hai",
        "what can you do", "what do you do",
        "help me with", "mujhe batao",
        "information", "jankari", "jaankari",
        "guide", "guidance", "salah", "advice",
        "pragati ai", "pragati", "ai assistant",
        "kaise kaam karta hai", "how does it work",
        "features", "capabilities",
    ],

    "pest": [
        # Hindi / Hinglish
        "keeda", "keede", "kida", "kide", "keedaa",
        "keet", "keet laga", "keet lag gaya",
        "pest", "pests", "pest attack", "pest control",
        "keet niyantran", "keet prabandhan",
        "aphid", "maahu", "mahu",
        "whitefly", "safed makhi",
        "stem borer", "tana borer",
        "thrips", "jassid",
        "caterpillar", "sundi", "illi",
        "locust", "tiddi", "tiddi dal",
        "mite", "spider mite",
        "nematode", "sutra krimi",
        "bollworm", "fruit borer",
        "grasshopper", "tidda",
        "keet ki dawa", "keetnaashak",
        "insecticide", "pesticide",
        "fasal mein keede", "fasal mein keet",
        "keet se nuksan", "pest damage",
        "organic pest control", "bio pesticide",
        "integrated pest management",
        # Devanagari
        "कीड़े", "कीट", "कीट नियंत्रण",
        "टिड्डी", "टिड्डा", "सुंडी",
        "माहू", "सफेद मक्खी",
        "कीटनाशक", "कीट प्रबंधन",
        "फसल में कीड़े", "कीट से नुकसान",
    ],
}

# ---------------------------------------------------------------------------
# BUILD NORMALISED LOOKUP TABLE  (alias → intent)
# ---------------------------------------------------------------------------

def _norm(text: str) -> str:
    """Same normalisation as intent_classifier.normalise_text.
    FIXED: must match exactly — only NFC + lowercase + whitespace collapse.
    Do NOT strip punctuation here as it changes the token boundaries.
    """
    text = unicodedata.normalize("NFC", text)
    text = text.lower()
    text = re.sub(r"\s+", " ", text)
    return text.strip()


_ALIAS_MAP: dict[str, str] = {}

for _intent, _aliases in _RAW.items():
    for _alias in _aliases:
        _key = _norm(_alias)
        if _key:
            _ALIAS_MAP[_key] = _intent


# ---------------------------------------------------------------------------
# KEYWORD SETS — for partial/fuzzy matching on short inputs
# ---------------------------------------------------------------------------

# Maps a keyword to an intent — used when exact alias fails
_KEYWORD_MAP: dict[str, str] = {
    # Market keywords
    "mandi":   "market",
    "mandy":   "market",
    "bhav":    "market",
    "bhaav":   "market",
    "bajar":   "market",
    "bazar":   "market",
    "bazaar":  "market",
    "market":  "market",
    "price":   "market",
    "prices":  "market",
    "rate":    "market",
    "rates":   "market",
    "auction": "market",
    "neelami": "market",
    "मंडी":    "market",
    "भाव":     "market",
    "बाजार":   "market",
    "नीलामी":  "market",
    "दाम":     "market",
    # Weather keywords
    "mosam":   "weather",
    "mausam":  "weather",
    "weather": "weather",
    "barish":  "weather",
    "baarish": "weather",
    "rain":    "weather",
    "temp":    "weather",
    "garmi":   "weather",
    "sardi":   "weather",
    "मौसम":    "weather",
    "बारिश":   "weather",
    # Government keywords
    "yojana":  "government",
    "yojna":   "government",
    "scheme":  "government",
    "subsidy": "government",
    "योजना":   "government",
    # Soil keywords
    "mitti":   "soil",
    "soil":    "soil",
    "मिट्टी":    "soil",
    # Fertilizer keywords
    "khad":    "fertilizer",
    "khaad":   "fertilizer",
    "urea":    "fertilizer",
    "dap":     "fertilizer",
    "npk":     "fertilizer",
    "खाद":     "fertilizer",
    # Disease keywords
    "rog":     "disease",
    "bimari":  "disease",
    "keeda":   "disease",
    "pest":    "disease",
    "रोग":     "disease",
    "बीमारी":  "disease",
    # Greeting keywords
    "hello":   "greeting",
    "hi":      "greeting",
    "namaste": "greeting",
    "नमस्ते":  "greeting",
    # Crop keywords
    "fasal":   "crop",
    "crop":    "crop",
    "kheti":   "crop",
    "फसल":     "crop",
    "खेती":    "crop",
    # Pest keywords
    "keeda":   "pest",
    "keede":   "pest",
    "keet":    "pest",
    "pest":    "pest",
    "tiddi":   "pest",
    "sundi":   "pest",
    "aphid":   "pest",
    "कीड़े":    "pest",
    "कीट":     "pest",
    "टिड्डी":   "pest",
}


# ---------------------------------------------------------------------------
# PUBLIC API
# ---------------------------------------------------------------------------

def resolve_alias(text: str) -> Optional[str]:
    """
    Returns the intent for text if an exact alias match is found.
    Falls back to keyword-based partial matching for short inputs.

    Args:
        text: Raw user input.

    Returns:
        Intent string (e.g. "market") or None.
    """
    normed = _norm(text)
    # 1. Exact alias match
    result = _ALIAS_MAP.get(normed)
    if result:
        return result

    # 2. Keyword match — check if any keyword is contained in the normed text
    #    or the normed text is contained in a keyword (handles short inputs)
    for keyword, intent in _KEYWORD_MAP.items():
        kw_normed = _norm(keyword)
        if kw_normed and (normed == kw_normed or
                          kw_normed in normed or
                          normed in kw_normed):
            return intent

    return None


def alias_count() -> int:
    """Returns total number of registered aliases (for diagnostics)."""
    return len(_ALIAS_MAP)
