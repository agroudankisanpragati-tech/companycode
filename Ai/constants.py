# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: constants.py
# Purpose: All fixed values, class registries, and dataset maps.
#          This file NEVER imports from any other project file.
#          Every other file imports FROM this file.
# =============================================================================

# -----------------------------------------------------------------------------
# PYTHON VERSION GUARD
# This module is designed for Python 3.11. It will warn if run on other
# versions but will not crash — allowing forward compatibility.
# -----------------------------------------------------------------------------
import sys

if sys.version_info < (3, 11):
    import warnings
    warnings.warn(
        f"AKP AI module is designed for Python 3.11. "
        f"You are running Python {sys.version_info.major}.{sys.version_info.minor}. "
        f"Some features may not work correctly.",
        RuntimeWarning,
        stacklevel=2,
    )


# =============================================================================
# SECTION 1 — PROJECT IDENTITY
# =============================================================================

PROJECT_NAME: str = "AKP — Agroudan Kisan Pragati"
PROJECT_VERSION: str = "1.0.0"
AI_MODULE_NAME: str = "AKP Crop Disease Detection AI"
ORGANIZATION: str = "Agroudan Kisan Pragati (AKP)"


# =============================================================================
# SECTION 2 — SUPPORTED CROPS REGISTRY
# =============================================================================
# This is the single source of truth for all crops in the system.
# To add a new crop in the future:
#   1. Add its folder name to SUPPORTED_CROPS
#   2. Add its display name to CROP_DISPLAY_NAMES
#   3. Add its diseases to CROP_DISEASE_MAP
#   4. Add its pests to CROP_PEST_MAP
#   5. That's it — the rest of the system picks it up automatically.

SUPPORTED_CROPS: list[str] = [
    "Black_gram",
    "green_gram",
    "corn_maize",
    "Tomato",
    "Pearl_Millet _Bajra",
    "wheat",
]

# Human-readable display names for the UI (maps folder name → display name)
CROP_DISPLAY_NAMES: dict[str, str] = {
    "Black_gram": "Black Gram (Urad Dal)",
    "green_gram": "Green Gram (Moong Dal)",
    "corn_maize": "Corn / Maize",
    "Tomato": "Tomato",
    "Pearl_Millet _Bajra": "Pearl Millet (Bajra)",
    "wheat": "Wheat",
}

# Hindi names for voice assistant and multilingual UI
CROP_HINDI_NAMES: dict[str, str] = {
    "Black_gram": "उड़द दाल",
    "green_gram": "मूंग दाल",
    "corn_maize": "मक्का",
    "Tomato": "टमाटर",
    "Pearl_Millet _Bajra": "बाजरा",
    "wheat": "गेहूँ",
}

# All accepted aliases for each crop (separator-stripped, lowercase)
# Used by _resolve_crop_key for robust matching
CROP_ALIASES: dict[str, list[str]] = {
    "Black_gram":  ["blackgram", "blackgram", "urd", "urad", "uraddal", "blackgramurad",
                    "blackgram",
"black gram",
"black_gram",
"black-gram",
"blackgramcrop",
"black gram crop",
"urd",
"urad",
"udad",
"uraddal",
"udad dal",
"urad dal",
"urd dal",
"blackgramurad",
"blackpulse",
"black pulse",
"vigna mungo",
"vignamungo",
"mash",
"mash dal",
"mashbean",
"mash crop",
"kali dal",
"kali urad",
"kali udad",
"kali mash",
"kala urad",
"kala udad",
"kala dal",
"black lentil",
"blacklentil",
"blackbean",
"black bean",
"उड़द",
"उरद",
"उडद",
"उड़द दाल",
"उरद दाल",
"उडद दाल",
"काली उड़द",
"काली उरद",
"काली उडद",
"काला उड़द",
"काला उरद",
"काला उडद",
"काली दाल",
"उड़द की फसल",
"उरद की फसल",
"उडद की फसल",
"urd ki fasal",
"urad ki fasal",
"udad ki fasal",
"urad crop",
"udad crop",
"urd crop",
"black gram ki fasal",
"blackgram ki fasal",
"black gram plant",
"urad plant",
"udad plant",
"urd plant",
"urad bean",
"udad bean",
"urad seeds",
"udad seeds",
"urad farming",
"udad farming",
"urad kheti",
"udad kheti",
"urad crop india",
"udad crop india",
"marwari urad",
"rajasthani urad",
"rajasthan urad",
"marwadi urad",
"marwadi udad",
"mewari urad",
"hadoti urad",
"dhundhari urad",
"bagri urad",
"shekhawati urad",
"udid",
"udid dal",
"udit dal",
"urdad",
"urrad",
"uraad",
"oorad",
"oorid",
"orad",
"oraad",
"uarad",
"udaad",
"urdh",
"urdd",
"blackgram india",
"black gram india",
"indian black gram",
"indian urad",
"desi urad",
"desi udad",
"desi black gram",
"desi mash",
"blackgramplant",
"blackgramleaf",
"blackgramleaves",
"blackgramfield",
"blackgramfarm",
"blackgramfarming",
"blackgramseed",
"blackgramseeds",
"blackgramcropindia",
"blackgramindia",
"blackgramfarmer",
"blackgramcultivation",
"blackgramagriculture",
"blackgramkheti",
"blackgramfasal",
"blackgramplantation",
"blackgramfieldcrop",
"blackgramharvest",
"blackgramsowing",
"blackgramvariety",
"blackgramseedling",
"blackgramorganic",
"blackgramdisease",
"blackgrampest",
"blackgramhealthy",
"uradbean",
"uradbeans",
"uradleaf",
"uradleaves",
"uradfield",
"uradfarm",
"uradfarmer",
"uradagriculture",
"uradfasal",
"uradbeej",
"uradbija",
"uradbij",
"uradbowai",
"uradbuwai",
"uradkatai",
"uradpaidavar",
"uradutpadan",
"uradorganic",
"uradhealthy",
"uraddisease",
"uradpest",
"uradplantleaf",
"uradgreenleaf",
"uradcropfield",
"udadbean",
"udadbeans",
"udadleaf",
"udadfield",
"udadfarm",
"udadfarmer",
"udadagriculture",
"udadfasal",
"udadbeej",
"udadbija",
"udadbij",
"udadbuwai",
"udadkatai",
"udadpaidavar",
"udadutpadan",
"udadorganic",
"udadhealthy",
"udaddisease",
"udadpest",
"udadcropfield",
"mashbeanindia",
"mashcropindia",
"mashkheti",
"mashfasal",
"mashbeej",
"mashplant",
"mashleaf",
"mashorganic",
"mashhealthy",
"mashdisease",
"mashpest",
"kaliurad",
"kaliudad",
"kaliurd",
"kalaurad",
"kalauudad",
"kaladal",
"desikaliurad",
"desikalaurad",
"desiudad",
"desiurd",
"rajasthaniudad",
"rajasthaniurd",
"marwariudad",
"marwariurd",
"mewariudad",
"hadotiudad",
"bagriudad",
"shekhawatiudad",
"dhundhariudad",
"urat",
"uratdal",
"urdadal",
"uraddaal",
"udaadal",
"udaddaal",
"udadbeanindia",
"uradbeanindia",
"urad ki kheti",
"udad ki kheti",
"urd ki kheti",
"urad ro fasal",
"udad ro fasal",
"urd ro fasal",
"urad ri kheti",
"udad ri kheti",
"urd ri kheti",
"urad ro beej",
"udad ro beej",
"urd ro beej",
"urad ri paidavar",
"udad ri paidavar",
"urad ro paudh",
"udad ro paudh",
"urad ro podho",
"udad ro podho",
"urad ri fasal",
"udad ri fasal",
"urad ka podha",
"udad ka podha",
"urad ka paudha",
"udad ka paudha",
"urad wala crop",
"udad wala crop",
"urad wali fasal",
"udad wali fasal",
"urad crop hai",
"udad crop hai",
"urad plant hai",
"udad plant hai",
"mharo urad",
"mhari urad",
"mharo udad",
"mhari udad",
"mhara khet ro urad",
"mhara khet ro udad",
"mhare khet me urad",
"mhare khet me udad",
"mhare khet ri urad",
"mhare khet ri udad",
"mhane urad",
"mhane udad",
"thane urad",
"thane udad",
"yo urad hai",
"yo udad hai",
"yo urad ro podho",
"yo udad ro podho",
"aa urad che",
"aa udad che",
"aa urad no paak",
"aa udad no paak",
"aa urad ni kheti",
"aa udad ni kheti",
"urad nu paak",
"udad nu paak",
"urad ni fasal",
"udad ni fasal",
"urad no beej",
"udad no beej",
"urad chi sheti",
"udad chi sheti",
"urad pik",
"udad pik",
"urad panta",
"udad panta",
"urad bele",
"udad bele",
"urad gida",
"udad gida",
"urad gida crop",
"udad gida crop",
"urad faslo",
"udad faslo",
"urad kheto",
"udad kheto",
"urad ro kheto",
"udad ro kheto",
"urad ro paak",
"udad ro paak",
"urad no crop",
"udad no crop",
"urad wala paak",
"udad wala paak",
"urad farming india",
"udad farming india",
"urad organic kheti",
"udad organic kheti",
"urad desi fasal",
"udad desi fasal",
"urad indian crop",
"udad indian crop",
"urad farmer crop",
"udad farmer crop",
"urad village crop",
"udad village crop",
"urad rural crop",
"udad rural crop",
"urad local crop",
"udad local crop",
"urad desi beej",
"udad desi beej",
"urad crop rajasthan",
"udad crop rajasthan",
"urad ki fasal hai",
"udad ki fasal hai",
"blackgram",
"black-gram",
"black_gram",
"black",
"gram",
"urad",
"udad",
"urd",
"udid",
"udad",
"udit",
"uraddal",
"udaddal",
"mash",
"mashdal",
"mashbean",
"kalidal",
"kaliurad",
"kaliudad",
"kalaurad",
"kalamash",
"kalaminum",
"vignamungo",
"vigna",
"mungo",
"urat",
"uraad",
"urrad",
"oorad",
"orad",
"urdh",
"urdd",
"uarad",
"udaad",
"udaad",
"uradi",
"udadi",
"uradiya",
"udariya",
"urdo",
"uddo",
"udra",
"udrai",
"udadi",
"uriya",
"udiya",
"उड़द",
"उरद",
"उडद",
"उरड़",
"उड़",
"उर",
"माश",
"काली",
"कालीदाल",
"काळीउडीद",
"उडीद",
"उडीद",
"उडित",
"ઉડદ",
"અડદ",
"ઉરદ",
"ಉದ್ದು",
"ಉದ್ದಿನ",
"ಉದ್ದುಬೇಳೆ",
"ഉഴുന്ന്",
"ഉരട്",
"உளுந்து",
"உரட்",
"మినుము",
"మినుములు",
"మినప",
"మినప్పప్పు",
"ମାଷ",
"ଉଡଦ",
"কালাই",
"মাষ",
"কালোডাল",
"ਕਾਲੀਮਾਂਹ",
"ਮਾਂਹ",
"ਉੜਦ",
"उड़दी",
"उरदी",
"उडदी",
"उराड़ी",
"उड़ाड़ी",
"urdi",
"uddi",
"udadi",
"marwariurad",
"mewariurad",
"hadotiurad",
"bagriurad",
"dhundhariurad",
"shekhawatiurad",
"desiurad",
"desiudad",
"localurad",
"gaonurad",
"kheturad",
"bharatiyaurad",
"indiangram" ],
    "green_gram":  ["greengram", "moong", "mung", "mungbean", "moongdal"
                    "greengram",
"green-gram",
"green_gram",
"green",
"gram",
"moong",
"mung",
"mungbean",
"mungbeans",
"greenbean",
"greenpulse",
"vignaradiata",
"vigna",
"radiata",
"mungo",
"mong",
"moongdal",
"mungdal",
"moongbean",
"mungbean",
"mungo",
"mug",
"mudga",
"mudg",
"mudgaa",
"moonga",
"munga",
"munga",
"mungi",
"moongi",
"mungiya",
"moongiya",
"moongi",
"mungi",
"मूंग",
"मुग",
"मुगा",
"मुगी",
"मूंगी",
"मूंगदाल",
"मूग",
"મગ",
"મગદાળ",
"મૂંગ",
"ಹೆಸರು",
"ಹೆಸರೂಕಾಳು",
"ಹಸಿರುಹೆಸರು",
"ಹೆಸರುಬೇಳೆ",
"పెసర",
"పెసలు",
"పెసరపప్పు",
"పెసరలు",
"பாசிப்பயறு",
"பச்சைப்பயறு",
"பாசிப்பருப்பு",
"പയർ",
"ചെറുപയർ",
"പച്ചപയർ",
"മൂങ്ങ്",
"ମୁଗ",
"ମୁଗଡାଲି",
"মুগ",
"মুগডাল",
"সবুজমুগ",
"ਮੂੰਗ",
"ਮੂੰਗੀ",
"ਮੂੰਗਦਾਲ",
"mungo",
"mongo",
"monga",
"moonga",
"mungaa",
"mungbeanindia",
"moongindia",
"desimoong",
"desimung",
"localmoong",
"gaonmoong",
"khetmoong",
"bharatiyamoong",
"indianmoong",
"marwarimoong",
"mewarimoong",
"hadotimoong",
"bagrimoong",
"dhundharimoong",
"shekhawatimoong",
"rajasthanimoong",
"rajasthanimung",
"moongcrop",
"mungcrop",
"greenmung",
"greenmoong",
"moongseed",
"mungseed",
"moongplant",
"mungplant",
"moongleaf",
"mungleaf",
"moongpulse",
"mungpulse",

                    ],
    "corn_maize":  ["corn", "maize", "cornmaize", "makka", "makai",
                   "corn",
"maize",
"makka",
"makai",
"maka",
"makkaa",
"makkaa",
"maiz",
"maise",
"maeze",
"majee",
"corncrop",
"maizecrop",
"cornplant",
"maizeplant",
"cornseed",
"maizeseed",
"cornleaf",
"maizeleaf",
"sweetcorn",
"sweetcorns",
"babycorn",
"fieldcorn",
"dentcorn",
"flintcorn",
"popcorn",
"corncob",
"bhutta",
"bhuta",
"bhutte",
"bhutto",
"bhutaa",
"bhutt",
"bhutto",
"makki",
"maki",
"makiyaa",
"makiyo",
"makaiya",
"makki",
"मक्का",
"मकई",
"भुट्टा",
"भुट्टे",
"मक्की",
"મકાઈ",
"મકાઇ",
"મક્કાઈ",
"મકાઈદાણા",
"ಮೆಕ್ಕೆಜೋಳ",
"ಮೆಕ್ಕೆ",
"ಮೆಕ್ಕೆಕಾಳು",
"మొక్కజొన్న",
"మొక్కజొన్నలు",
"మక్కజొన్న",
"மக்காச்சோளம்",
"சோளம்",
"ചോളം",
"മക്കച്ചോളം",
"ଭୁଟା",
"ମକା",
"ভুট্টা",
"ভুট্টা",
"ভুটা",
"ਮੱਕੀ",
"ਮਕੀ",
"ਭੁੱਟਾ",
"bhuttaa",
"bhutta",
"bhuttah",
"makkai",
"makay",
"makaii",
"maakai",
"maakaa",
"cornindia",
"maizeindia",
"desimakka",
"desimakai",
"localmakka",
"gaonmakka",
"khetmakka",
"bharatiyamakka",
"indianmaize",
"marwarimakka",
"mewarimakka",
"hadotimakka",
"bagrimakka",
"dhundharimakka",
"shekhawatimakka",
"rajasthanimakka",
"cornfield",
"maizefield",
"corngrain",
"maizegrain",
"cornkernel",
"maizekernel",
"zea",
"zeamays",
"zea_mays",
"cornmaize" ],
    "Tomato":      ["tomato", "tamatar", "tamater",
                    "tomato",
"tomatos",
"tomatoes",
"tamatar",
"tamater",
"tamato",
"tameto",
"tmatar",
"tmato",
"tometo",
"tometa",
"tomata",
"tomoto",
"tomotoes",
"tomat",
"tomet",
"tomatoo",
"tomaato",
"tamaatar",
"tamataro",
"tamatara",
"tamatria",
"tamri",
"tamra",
"tamatra",
"tamter",
"tamtir",
"tamte",
"tamto",
"tamtoe",
"tomatocrop",
"tomatoplant",
"tomatoleaf",
"tomatoseed",
"tomatofruit",
"tomatoveg",
"redtomato",
"cherrytomato",
"roma",
"romatomato",
"plumtomato",
"beeftomato",
"heirloomtomato",
"hybridtomato",
"desitomato",
"localtomato",
"indiantomato",
"gaontamatar",
"khettamatar",
"bharatiyatomato",
"टमाटर",
"टमाटर्",
"टमेटर",
"टमेटो",
"टमाटा",
"टमाटा",
"टमाटो",
"टमाटरां",
"ટામેટા",
"ટામેટું",
"ટમેટા",
"ಟೊಮೇಟೊ",
"ಟೊಮ್ಯಾಟೊ",
"ಟೊಮಾಟೊ",
"ಟೊಮೇಟೊಹಣ್ಣು",
"టమాట",
"టమాటో",
"టొమాటో",
"టమోటా",
"தக்காளி",
"தக்காலி",
"தக்காளிபழம்",
"തക്കാളി",
"തക്കാളിപ്പഴം",
"ଟମାଟୋ",
"ଟମାଟ",
"টমেটো",
"টমাটো",
"টমেটা",
"ਟਮਾਟਰ",
"ਟਮਾਟਰਾਂ",
"tomat",
"tomatoo",
"tamaato",
"tamaatoo",
"tamatari",
"tamatari",
"tamatariya",
"tamatera",
"tomater",
"tomaterr",
"tamatr",
"tamatr",
"tomatoplant",
"tomatoleaves",
"tomatocultivation",
"tomatofarming",
"tomatogarden",
"tomatofield",
"tomatogrow",
"tomatoseedling",
"tomatohybrid",
"tomatodesi"],
"Pearl_Millet _Bajra": [
"pearlmillet",
"pearl millet",
"pearl_millet",
"bajra",
"bajri",
"bajara",
"bajaraa",
"bajaraa",
"bajaro",
"bajro",
"bajroo",
"bajraa",
"bajer",
"bajeraa",
"bajeri",
"bajriya",
"bajariya",
"bajr",
"bajaraa",
"bajraa",
"bajracrop",
"bajraplant",
"bajraseed",
"bajraleaf",
"bajrafield",
"bajrafarming",
"bajrakheti",
"bajrabeej",
"bajrapearl",
"millet",
"millets",
"pearl",
"pearlcrop",
"cumbu",
"kambu",
"bulrushmillet",
"cattailmillet",
"pennisetum",
"glaucum",
"pennisetumglaucum",
"बाजरा",
"बाजरी",
"बाजरो",
"बाजर",
"बाजरीया",
"बाजरो",
"बाजरी",
"बाजरां",
"बाजरिया",
"બાજરી",
"બાજરો",
"બાજરો",
"બાજરીયા",
"ಬಜ್ರಾ",
"ಸಜ್ಜೆ",
"ಸಜ್ಜೆಕಾಳು",
"ಬಜ್ರ",
"బజ్రా",
"సజ్జ",
"సజ్జలు",
"సజ్జధాన్యం",
"கம்பு",
"கம்புதானியம்",
"കമ്പ്",
"കമ്പു",
"ବାଜରା",
"ବାଜ୍ରା",
"বাজরা",
"বাজরি",
"ਬਾਜਰਾ",
"ਬਾਜਰੀ",
"kambo",
"kambu",
"sajje",
"sajjalu",
"sajja",
"bajraindia",
"desibajra",
"localbajra",
"gaonbajra",
"khetbajra",
"bharatiyabajra",
"indianbajra",
"marwaribajra",
"mewaribajra",
"hadotibajra",
"bagribajra",
"dhundharibajra",
"shekhawatibajra",
"rajasthanibajra",
"bajragrain",
"bajrakernel",
"bajrafood",
"bajraro",
"bajrari",
"bajrasa",
"bajrano",
"bajrani",
"bajrawala",
"bajrawali",
"bajraki",
"bajraka"
],
"wheat": [
"wheat",
"wheats",
"wheet",
"whet",
"wheet",
"wheit",
"whit",
"whitcrop",
"whitgrain",
"gehu",
"gehun",
"gehum",
"ghehu",
"gahu",
"gahoo",
"gehoo",
"gehoo",
"gehunn",
"gehunh",
"geh",
"gahuu",
"gehuu",
"गेहूं",
"गेहु",
"गेंहू",
"गेहू",
"गहूं",
"गहु",
"गेहुं",
"गहुं",
"गेहूम",
"गेंहु",
"गेंहुं",
"गऊं",
"गऊ",
"घेहूं",
"घेहु",
"घेहू",
"घऊ",
"घउ",
"ghau",
"ghahu",
"ghu",
"ghum",
"ghoon",
"godhi",
"godhiya",
"godhum",
"godhuma",
"godum",
"godam",
"godamcrop",
"godhumam",
"triticum",
"triticum",
"triticumaestivum",
"aestivum",
"kanak",
"kanakcrop",
"kanik",
"kanika",
"kanka",
"kanakdana",
"kanakgrain",
"kanakbeej",
"kanakseed",
"kanakplant",
"kanakleaf",
"kanakfasal",
"ગહું",
"ઘઉં",
"ઘઉ",
"ಗೋಧಿ",
"ಗೋದಿ",
"ಗೋಧಿಕಾಳು",
"గోధుమ",
"గోదుమ",
"గోదుమలు",
"கோதுமை",
"கோதும",
"ഗോതമ്പ്",
"ഗോതമ്പ",
"ଗହମ",
"ଗହମ୍",
"গম",
"গহম",
"ਕਣਕ",
"ਗੰਹੂ",
"ਗੇਹੂੰ",
"desigehu",
"localgehu",
"gaongehu",
"khetgehu",
"bharatiyagehu",
"indiangehu",
"marwarigehu",
"mewarigehu",
"hadotigehu",
"bagrigehu",
"dhundharigehu",
"shekhawatigehu",
"rajasthanigehu"
],
}


# =============================================================================
# SECTION 3 — DISEASE REGISTRY PER CROP
# =============================================================================
# Maps each crop folder name to its list of disease subfolder names.
# These names MUST exactly match the folder names inside crop/diseases/
# The dataset structure is NEVER modified — only this registry is updated.

CROP_DISEASE_MAP: dict[str, list[str]] = {
    "Black_gram": [
        "Cercospora Leaf Spot",
        "Leaf Crinkle",
        "Yellow Mosaic",
    ],
    "green_gram": [
        "Cercospora Leaf Spot",
        "Leaf Crinkle",
        "Yellow Mosaic",
    ],
    "corn_maize": [
        "Cercospora Leaf Spot (Gray Leaf Spot)",
        "Common Rust",
        "Northern Leaf Blight",
    ],
    "Tomato": [
        "Bacterial Spot",
        "Early Blight",
        "Late Blight",
        "Leaf Mold",
        "Septoria Leaf Spot",
        "Target Spot",
        "Tomato Mosaic Virus (ToMV)",
        "Tomato Yellow Leaf Curl Virus (TYLCV)",
    ],
    "Pearl_Millet _Bajra": [
        "Pearl Millet Blast",
        "Pearl Millet Rust",
    ],

    "wheat": [
        "Wheat Septoria",
        "Wheat Stripe Rust",
    ],
}


# =============================================================================
# SECTION 4 — PEST REGISTRY PER CROP
# =============================================================================
# Maps each crop folder name to its list of pest subfolder names.
# These names MUST exactly match the folder names inside crop/pests/

CROP_PEST_MAP: dict[str, list[str]] = {
    "Black_gram": [
        "Aug_Anomis Sabulifera Guenee",
        "Aug_Aphis gossypii Glover",
        "Aug_Earias cupreoviridis Walker",
        "Aug_Ferisia pseudococcus (Signoret)",
        "Aug_Luperomorpha vittata Duvivier",
        "Aug_Nupserha bicolor (Dutta)",
        "Aug_Odontotermes obesus (Rambur)",
        "Aug_Pericallia ricini Fabricius",
        "Aug_Scopula emissaria Walker",
        "Aug_SL8 Microtermes obesi Holmgren",
        "Aug_Spodoptera exigua (hubner)",
        "Aug_Tetranychus bioculats (Wood-Mason)",
        "field_cricket",
        "FruitMothImage",
        "GallFlyImage",
        "Jute_stem_weevil",
        "LocustImage",
        "spirosoma_obliqua",
        "StemBorerImage",
        "whiteflies",
        "yellow_mite",
    ],
    "green_gram": [
        "Aug_Anomis Sabulifera Guenee",
        "Aug_Aphis gossypii Glover",
        "Aug_Earias cupreoviridis Walker",
        "Aug_Ferisia pseudococcus (Signoret)",
        "Aug_Luperomorpha vittata Duvivier",
        "Aug_Nupserha bicolor (Dutta)",
        "Aug_Odontotermes obesus (Rambur)",
        "Aug_Pericallia ricini Fabricius",
        "Aug_Scopula emissaria Walker",
        "Aug_SL8 Microtermes obesi Holmgren",
        "Aug_Spodoptera exigua (hubner)",
        "Aug_Tetranychus bioculats (Wood-Mason)",
        "field_cricket",
        "FruitMothImage",
        "GallFlyImage",
        "Jute_stem_weevil",
        "LocustImage",
        "spirosoma_obliqua",
        "StemBorerImage",
        "whiteflies",
        "yellow_mite",
    ],
    "corn_maize": [
        "aphids",
        "corn borer",
        "corn earworm",
        "cutworm",
        "fall armyworm",
        "grasshopper",
        "large cutworm",
        "stem borer",
        "Termite",
        "Thrips",
        "whitefly",
        "wireworm",
        "yellow cutworm",
    ],
    "Tomato": [
        "aphids",
        "army worm",
        "cutworm",
        "fall armyworm",
        "grasshopper",
        "Mealybug",
        "red spider",
        "Spider Mites (Two-spotted Spider Mite)",
        "Termite",
        "Thrips",
        "whitefly",
        "wireworm",
    ],
    "Pearl_Millet _Bajra": [
        "Pearl_Millet_Aphids",
        "Pearl_Millet_Armyworm",
        "Pearl_Millet_Cutworm",
        "Pearl_Millet_Grasshopper",
        "Pearl_Millet_Grub",
        "Pearl_Millet_Locust",
        "Pearl_Millet_Mites",
        "Pearl_Millet_Red_Spider_Mite",
        "Pearl_Millet_Stem_Borer",
        "Pearl_Millet_Termite",
        "Pearl_Millet_Thrips",
        "Pearl_Millet_Whitefly",
        "Pearl_Millet_Wireworm",
        "Pearl_Millet_Yellow_Cutworm",
    ],
}


# =============================================================================
# SECTION 5 — DATASET FOLDER STRUCTURE CONSTANTS
# =============================================================================
# These are the exact subfolder names used inside each crop folder.
# Tomato uses "disease" (singular) — this inconsistency is handled here
# so no other file needs to know about it.

DATASET_SUBFOLDERS: dict[str, str] = {
    "healthy": "healthy",
    "diseases": "diseases",
    "pests": "pests",
}

# Tomato has a different folder name for diseases — map it here
CROP_DISEASE_FOLDER_OVERRIDE: dict[str, str] = {
    "Tomato": "disease",  # Tomato uses "disease" not "diseases"
}

# Supported image file extensions for dataset scanning
SUPPORTED_IMAGE_EXTENSIONS: tuple[str, ...] = (
    ".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".webp",
)


# =============================================================================
# SECTION 6 — MODEL ARCHITECTURE CONSTANTS
# =============================================================================

# Available YOLOv8 classification model sizes
# n=nano, s=small, m=medium, l=large, x=extra-large
# Recommended: yolov8s-cls for CPU training, yolov8m-cls for GPU training
YOLO_MODEL_SIZES: dict[str, str] = {
    "nano":        "yolov8n-cls.pt",   # Fastest, least accurate — for testing
    "small":       "yolov8s-cls.pt",   # Recommended for CPU training
    "medium":      "yolov8m-cls.pt",   # Recommended for GPU training
    "large":       "yolov8l-cls.pt",   # High accuracy, needs good GPU
    "extra_large": "yolov8x-cls.pt",   # Best accuracy, needs powerful GPU
}

# Default model for this project (CPU-safe)
DEFAULT_MODEL_SIZE: str = "small"
DEFAULT_MODEL_WEIGHTS: str = YOLO_MODEL_SIZES[DEFAULT_MODEL_SIZE]

# Input image size for the model (width = height)
# 224 is standard for classification. 320 gives better accuracy but is slower.
IMAGE_SIZE: int = 224

# Number of color channels (3 = RGB)
IMAGE_CHANNELS: int = 3


# =============================================================================
# SECTION 7 — TRAINING HYPERPARAMETER DEFAULTS
# =============================================================================
# These are starting defaults. They will be overridden by config.py
# and individual YAML configs per crop. Defined here as safe fallbacks.

DEFAULT_EPOCHS: int = 50
DEFAULT_BATCH_SIZE: int = 16          # Safe for 8GB RAM CPU training
DEFAULT_LEARNING_RATE: float = 0.001
DEFAULT_PATIENCE: int = 10            # Early stopping patience (epochs)
DEFAULT_WORKERS: int = 4              # DataLoader worker threads
DEFAULT_TRAIN_SPLIT: float = 0.80     # 80% training data
DEFAULT_VAL_SPLIT: float = 0.10       # 10% validation data
DEFAULT_TEST_SPLIT: float = 0.10      # 10% test data
DEFAULT_SPLIT_SEED: int = 42          # Reproducible random seed for splits


# =============================================================================
# SECTION 6b — AUGMENTATION DEFAULTS
# =============================================================================
# Default probability and magnitude values for every augmentation transform.
# All values are consumed by AugmentationConfig in config.py.
# Setting a probability to 0.0 effectively disables that transform.

AUG_ENABLED: bool = True                    # Master switch for augmentation

# Geometric transforms
AUG_HFLIP_P: float        = 0.5             # Horizontal flip probability
AUG_VFLIP_P: float        = 0.2             # Vertical flip probability
AUG_ROTATE_P: float       = 0.5             # Rotation probability
AUG_ROTATE_LIMIT: int     = 30              # Max rotation degrees (±)
AUG_PERSPECTIVE_P: float  = 0.3             # Perspective distortion probability
AUG_PERSPECTIVE_SCALE: tuple[float, float] = (0.05, 0.10)  # Distortion scale range
AUG_ZOOM_P: float         = 0.3             # Random zoom (scale) probability
AUG_ZOOM_LIMIT: tuple[float, float] = (0.8, 1.2)           # Zoom scale range
AUG_CROP_P: float         = 0.4             # Random crop probability
AUG_CROP_SCALE: tuple[float, float] = (0.7, 1.0)           # Crop area fraction range
AUG_CROP_RATIO: tuple[float, float] = (0.75, 1.33)         # Crop aspect ratio range

# Colour / photometric transforms
AUG_BRIGHTNESS_P: float         = 0.4       # Brightness/contrast adjust probability
AUG_BRIGHTNESS_LIMIT: float     = 0.2       # Brightness change limit (±)
AUG_CONTRAST_LIMIT: float       = 0.2       # Contrast change limit (±)
AUG_HUE_SAT_P: float            = 0.4       # Hue-saturation-value shift probability
AUG_HUE_SHIFT_LIMIT: int        = 15        # Hue shift limit (±degrees)
AUG_SAT_SHIFT_LIMIT: int        = 25        # Saturation shift limit (±)
AUG_VAL_SHIFT_LIMIT: int        = 15        # Value (brightness) shift limit (±)

# Noise / blur transforms
AUG_BLUR_P: float           = 0.2           # Gaussian blur probability
AUG_BLUR_LIMIT: tuple[int, int] = (3, 7)    # Blur kernel size range (odd integers)
AUG_NOISE_P: float          = 0.2           # Gaussian noise probability
AUG_NOISE_VAR: tuple[float, float] = (5.0, 25.0)  # Noise variance range

# Erasing
AUG_ERASE_P: float          = 0.2           # Random erasing probability
AUG_ERASE_SCALE: tuple[float, float] = (0.02, 0.15)  # Erased area fraction range
AUG_ERASE_RATIO: tuple[float, float] = (0.3, 3.3)    # Erased region aspect ratio range


# =============================================================================
# SECTION 7b — PREPROCESSING CONSTANTS
# =============================================================================
# Defaults for the image preprocessing pipeline.
# All values are consumed by PreprocessingConfig in config.py.

# Interpolation modes for resizing (used with cv2 / Pillow)
INTERP_BILINEAR: str = "bilinear"      # Good quality, fast — default
INTERP_BICUBIC: str  = "bicubic"       # Higher quality, slightly slower
INTERP_NEAREST: str  = "nearest"       # Fastest, lower quality

# Default interpolation for resize
DEFAULT_INTERP: str = INTERP_BILINEAR

# Letterbox fill colour (RGB) — used when padding to preserve aspect ratio
LETTERBOX_FILL_COLOR: tuple[int, int, int] = (114, 114, 114)  # ImageNet grey

# ImageNet normalisation statistics (mean and std per RGB channel)
# Used when normalize_mode == "imagenet"
IMAGENET_MEAN: tuple[float, float, float] = (0.485, 0.456, 0.406)
IMAGENET_STD:  tuple[float, float, float] = (0.229, 0.224, 0.225)

# Normalisation modes
NORM_MODE_IMAGENET: str = "imagenet"   # Subtract ImageNet mean, divide by std
NORM_MODE_MINMAX:   str = "minmax"     # Scale pixel values to [0, 1]
NORM_MODE_NONE:     str = "none"       # No normalisation — raw uint8 pixels

DEFAULT_NORM_MODE: str = NORM_MODE_IMAGENET

# CLAHE (Contrast Limited Adaptive Histogram Equalisation) defaults
CLAHE_CLIP_LIMIT: float = 2.0
CLAHE_TILE_GRID_SIZE: tuple[int, int] = (8, 8)

# Denoising strength (h parameter for cv2.fastNlMeansDenoisingColored)
DENOISE_H: int = 10


# =============================================================================
# SECTION 8 — EXPORT FORMAT CONSTANTS
# =============================================================================

# Supported export formats for deployment
EXPORT_FORMATS: dict[str, str] = {
    "onnx":          "ONNX — Universal format, runs in browser via onnxruntime-web",
    "torchscript":   "TorchScript — Optimized PyTorch format for server deployment",
    "tflite":        "TFLite — TensorFlow Lite for Android/iOS mobile apps",
    "openvino":      "OpenVINO — Intel CPU optimized format",
    "coreml":        "CoreML — Apple devices (Mac, iPhone, iPad)",
}

# Default export format for this project (browser PWA deployment)
DEFAULT_EXPORT_FORMAT: str = "onnx"

# ONNX opset version — 12 is widely supported by onnxruntime-web in browsers
ONNX_OPSET_VERSION: int = 12


# =============================================================================
# SECTION 9 — LOGGING CONSTANTS
# =============================================================================

# Log levels
LOG_LEVEL_DEBUG: str = "DEBUG"
LOG_LEVEL_INFO: str = "INFO"
LOG_LEVEL_WARNING: str = "WARNING"
LOG_LEVEL_ERROR: str = "ERROR"
LOG_LEVEL_CRITICAL: str = "CRITICAL"

# Default log level for production
DEFAULT_LOG_LEVEL: str = LOG_LEVEL_INFO

# Log file rotation settings
LOG_MAX_BYTES: int = 10 * 1024 * 1024   # 10 MB per log file
LOG_BACKUP_COUNT: int = 5                # Keep last 5 rotated log files

# Log date format
LOG_DATE_FORMAT: str = "%Y-%m-%d %H:%M:%S"
LOG_FILENAME_DATE_FORMAT: str = "%Y%m%d_%H%M%S"


# =============================================================================
# SECTION 10 — OUTPUT & REPORT CONSTANTS
# =============================================================================

# Minimum acceptable model performance thresholds
# Training will warn (not fail) if these are not met
MIN_ACCEPTABLE_ACCURACY: float = 0.80      # 80% minimum accuracy
MIN_ACCEPTABLE_F1_SCORE: float = 0.75      # 75% minimum F1 score
TARGET_ACCURACY: float = 0.92             # 92% target accuracy for production

# Confusion matrix figure size (width, height in inches)
CONFUSION_MATRIX_FIGSIZE: tuple[int, int] = (12, 10)

# Training curve figure size
TRAINING_CURVE_FIGSIZE: tuple[int, int] = (14, 5)
