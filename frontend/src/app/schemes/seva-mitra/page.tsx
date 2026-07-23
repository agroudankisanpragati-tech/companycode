'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePageContext } from '@/hooks/usePageContext';
import {
    FaMicrophone,
    FaStop,
    FaCheckCircle,
    FaSpinner,
    FaFileAlt,
    FaPrint,
    FaVolumeUp,
    FaFileUpload,
    FaRobot,
    FaUndo,
    FaPaperPlane,
    FaTimes,
    FaMobileAlt,
    FaCheck,
    FaChevronRight,
    FaWaveSquare,
    FaFemale,
    FaBars
} from 'react-icons/fa';

// ─── CONSTANTS & OPTIONS ──────────────────────────────────────────────────────

const LANGUAGES = [
    { code: 'hi', label: 'हिंदी (Hindi)' },
    { code: 'marwari', label: 'मारवाड़ी (Marwari)' },
    { code: 'en', label: 'English' },
    { code: 'sanskrit', label: 'संस्कृत (Sanskrit)' },
    { code: 'punjabi', label: 'पंजाबी (Punjabi)' },
    { code: 'haryanvi', label: 'हरियाणवी (Haryanvi)' },
    { code: 'marathi', label: 'मराठी (Marathi)' },
    { code: 'gujarati', label: 'गुजराती (Gujarati)' }
];

const OCCUPATIONS = [
    { value: 'farmer', label: '🌾 Farmer / Agriculture (किसान / खेती)' },
    { value: 'agricultural-laborer', label: '🚜 Laborer / Worker (मजदूर / श्रमिक)' },
    { value: 'student', label: '🎓 Student (छात्र / विद्यार्थी)' },
    { value: 'self-employed', label: '💼 Self Employed / Business (स्वरोजगार / उद्यमी)' },
    { value: 'unemployed', label: '🏠 Unemployed (बेरोजगार)' },
    { value: 'housewife', label: '👩‍🍳 Housewife / Homemaker (गृहिणी)' },
    { value: 'private-service', label: '🏢 Private Service (प्राइवेट नौकरी)' },
    { value: 'govt-service', label: '🏛️ Government Service (सरकारी नौकरी)' },
    { value: 'artisan', label: '🎨 Artisan / Craftsman (कारीगर / हस्तशिल्पी)' },
    { value: 'retired', label: '👴 Retired / Pensioner (सेवानिवृत्त / पेंशनभोगी)' },
    { value: 'other', label: '🧩 Other (अन्य)' }
];

const AGE_GROUPS = [
    { value: 'under18', label: '18 वर्ष से कम (< 18)' },
    { value: '18to60', label: '18 से 60 वर्ष (18 - 60)' },
    { value: 'above60', label: '60 वर्ष से अधिक (> 60 / वरिष्ठ नागरिक)' }
];

const INCOME_RANGES = [
    { value: 'under1l', label: '₹1 लाख से कम (< 1 Lakh)' },
    { value: '1lto5l', label: '₹1 लाख से ₹5 लाख (1 - 5 Lakhs)' },
    { value: '5lto8l', label: '₹5 लाख से ₹8 लाख (5 - 8 Lakhs)' },
    { value: 'above8l', label: '₹8 लाख से अधिक (> 8 Lakhs)' }
];

const RAJASTHAN_DISTRICTS = [
    'Jaipur', 'Jodhpur', 'Bhilwara', 'Udaipur', 'Bikaner', 'Kota', 'Ajmer', 'Alwar',
    'Pali', 'Sikar', 'Nagaur', 'Jhunjhunu', 'Tonk', 'Chittorgarh', 'Barmer', 'Jaisalmer'
];

const OTHER_STATES = [
    'Madhya Pradesh', 'Uttar Pradesh', 'Haryana', 'Gujarat', 'Punjab', 'Bihar', 'Maharashtra', 'Delhi'
];

const CATEGORIES = [
    { value: 'obc', label: 'OBC (अन्य पिछड़ा वर्ग)' },
    { value: 'general', label: 'General (सामान्य)' },
    { value: 'sc', label: 'SC (अनुसूचित जाति)' },
    { value: 'st', label: 'ST (अनुसूचित जनजाति)' },
    { value: 'ews', label: 'EWS / Other (आर्थिक रूप से कमजोर)' }
];

export default function SevaMitraPage() {
    const [activeOption, setActiveOption] = useState<'discovery' | 'document_ocr'>('discovery');
    const [sidebarOpen, setSidebarOpen] = useState(true);
    usePageContext({ pageContext: 'government' });

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

    // ──────────────────────────────────────────────────────────────────────────
    // 🔊 PREMIUM INDIAN FEMALE VOICE SYNTHESIS (NATURAL SWARA / GOOGLE HINDI)
    // ──────────────────────────────────────────────────────────────────────────
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [interimText, setInterimText] = useState('');
    const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [voiceGender, setVoiceGender] = useState<'female' | 'male'>('female');

    const recognitionRef = useRef<any>(null);
    const handleVoiceResultRef = useRef<(text: string) => void>(() => {});

    // Dynamic Voice List Loader
    useEffect(() => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            const loadVoices = () => {
                const voices = window.speechSynthesis.getVoices();
                if (voices.length > 0) setAvailableVoices(voices);
            };
            loadVoices();
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
    }, []);

    // 🔊 Premium Natural Indian Female Voice Readout
    const speakText = useCallback((textToSpeak: string) => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

        try {
            window.speechSynthesis.cancel();
            window.speechSynthesis.resume();

            // Format conversational Indian phrasing
            const cleanText = textToSpeak
                .replace(/([0-9]+)\s*lakhs?/gi, '$1 लाख रुपये')
                .replace(/under18/gi, '18 वर्ष से कम')
                .replace(/18to60/gi, '18 से 60 वर्ष')
                .replace(/above60/gi, '60 वर्ष से अधिक')
                .replace(/1lto5l/gi, '1 लाख से 5 लाख रुपये')
                .replace(/5lto8l/gi, '5 लाख से 8 लाख रुपये')
                .replace(/under1l/gi, '1 लाख रुपये से कम')
                .replace(/above8l/gi, '8 लाख रुपये से अधिक');

            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.lang = 'hi-IN';

            // Tuned for natural Indian Female cadence (Swara / Kalpana style)
            if (voiceGender === 'female') {
                utterance.rate = 0.92;
                utterance.pitch = 1.25; // Warm, natural female pitch
            } else {
                utterance.rate = 0.88;
                utterance.pitch = 0.95;
            }

            const voices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();

            // Find top Indian Female Voice (Microsoft Swara Online Natural / Google Hindi Female / Kalpana)
            let selectedVoice = null;

            if (voiceGender === 'female') {
                selectedVoice = voices.find(v => 
                    v.name.includes('Swara') || 
                    v.name.includes('Kalpana') || 
                    (v.name.includes('Google') && v.lang.includes('hi')) || 
                    v.name.includes('Heera') ||
                    v.name.includes('Neerja') ||
                    (v.lang.toLowerCase().includes('hi') && !v.name.includes('Hemant'))
                );
            } else {
                selectedVoice = voices.find(v => v.name.includes('Hemant') || (v.lang.toLowerCase().includes('hi') && v.name.includes('Male')));
            }

            // Fallback to any Indian voice
            if (!selectedVoice) {
                selectedVoice = voices.find(v => v.lang.toLowerCase() === 'hi-in' || v.lang.toLowerCase().includes('hi') || v.lang.includes('en-IN'));
            }

            if (selectedVoice) {
                utterance.voice = selectedVoice;
            }

            utterance.onstart = () => setIsSpeaking(true);
            utterance.onend = () => setIsSpeaking(false);
            utterance.onerror = () => setIsSpeaking(false);

            window.speechSynthesis.speak(utterance);
        } catch (err) {
            console.error('TTS error:', err);
            setIsSpeaking(false);
        }
    }, [availableVoices, voiceGender]);

    // ──────────────────────────────────────────────────────────────────────────
    // CONVERSATIONAL AI STATE MACHINE WITH REF SYNC
    // ──────────────────────────────────────────────────────────────────────────
    const [chatStep, setChatStep] = useState<number>(0);
    const chatStepRef = useRef<number>(0);

    const updateStep = (newStep: number) => {
        chatStepRef.current = newStep;
        setChatStep(newStep);
    };

    const [profile, setProfile] = useState({
        language: 'hi',
        name: '',
        occupation: 'farmer',
        ageGroup: '18to60',
        incomeRange: '1lto5l',
        stateType: 'Rajasthan',
        stateName: 'Rajasthan',
        district: 'Jaipur',
        category: 'obc',
        land: '1.5',
        phone: ''
    });

    // isFirstTime: true=new user, false=returning, null=not answered yet
    const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);
    const [phoneInput, setPhoneInput] = useState('');
    const [phoneError, setPhoneError] = useState('');

    const [janaadhaarInput, setJanaadhaarInput] = useState('');
    const [verifyingJanaadhaar, setVerifyingJanaadhaar] = useState(false);
    const [janaadhaarError, setJanaadhaarError] = useState('');

    // Language code → speech recognition lang tag
    const SPEECH_LANG_MAP: Record<string, string> = {
        hi: 'hi-IN', en: 'en-IN', marwari: 'hi-IN', punjabi: 'pa-IN',
        haryanvi: 'hi-IN', marathi: 'mr-IN', gujarati: 'gu-IN',
        sanskrit: 'hi-IN', te: 'te-IN', ta: 'ta-IN', kn: 'kn-IN',
        ml: 'ml-IN', bn: 'bn-IN', or: 'or-IN', as: 'as-IN', ur: 'ur-IN',
    };

    // Fallback static responses
    const getFallbackResponse = (stepIndex: number | string, name: string = '', lang: string): string => {
        const isMw = lang === 'marwari';
        const isEn = lang === 'en';
        const t = (hi: string, mw: string, en: string) => isEn ? en : isMw ? mw : hi;
        const map: Record<string | number, string> = {
            1:   t('क्या आप पहली बार आए हैं?', 'क्या आप पहली बार आया सा?', 'Is this your first visit?'),
            '1b': t('अपना 10 अंक का मोबाइल नंबर दर्ज करें:', 'आपनो 10 अंक को मोबाइल नंबर दाओ सा:', 'Enter your 10-digit mobile number:'),
            2:   t('आपका नाम क्या है?', 'आपनो नाम बताओ सा?', 'What is your name?'),
            3:   t(`धन्यवाद ${name} जी! अपना व्यवसाय चुनें:`, `घणो खम्मा ${name} सा! धंधो चुनो:`, `Thanks ${name}! Select your occupation:`),
            4:   t(`उम्र चुनें ${name} जी:`, `उमर बताओ ${name} सा:`, `Select age group ${name}:`),
            5:   t('सालाना आय चुनें:', 'सालाना कमाई बताओ सा:', 'Select annual income:'),
            6:   t('राज्य, जिला, श्रेणी और भूमि चुनें:', 'जिलो, जात और ज़मीन बताओ सा:', 'Select state, district, category & land:'),
            61:  t(`अपना मोबाइल नंबर दें ताकि आपकी जानकारी सेव हो सके:`, `मोबाइल नंबर दाओ सा ताकि आपनी जानकारी सेव हो जावे:`, 'Share your mobile number to save your profile:'),
            7:   t(`योग्य योजनाएं खोजी जा रही हैं ${name} जी...`, `योजनाएं खोजी जा रही है ${name} सा...`, `Searching eligible schemes for ${name}...`),
        };
        return map[stepIndex] || t('आपकी पात्र योजनाएं नीचे उपलब्ध हैं।', 'थारी पात्रता योजनाएं दाईं तरफ मिल जासी सा।', 'Your eligible schemes are shown below.');
    };

    // Fetch AI response from backend (OpenAI powered, multilingual)
    const fetchAIResponse = useCallback(async (
        step: number | string,
        currentProfile: typeof profile,
        userInput?: string
    ): Promise<string> => {
        try {
            const res = await fetch(`${API_BASE}/schemes/seva-mitra-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ step, profile: currentProfile, userInput }),
            });
            const data = await res.json();
            if (data.success && data.reply) return data.reply;
        } catch { /* fall through to fallback */ }
        return getFallbackResponse(step, currentProfile.name, currentProfile.language);
    }, [API_BASE]);

    // Save profile to backend by phone
    const saveProfileByPhone = useCallback(async (phone: string, currentProfile: typeof profile) => {
        try {
            await fetch(`${API_BASE}/schemes/seva-mitra-profile/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, profile: { ...currentProfile, phone } }),
            });
        } catch { /* silent */ }
    }, [API_BASE]);

    // Load saved profile by phone (returning user)
    const loadProfileByPhone = useCallback(async (phone: string): Promise<typeof profile | null> => {
        try {
            const res = await fetch(`${API_BASE}/schemes/seva-mitra-profile/${phone}`);
            const data = await res.json();
            if (data.success && data.found && data.profile) return data.profile;
        } catch { /* silent */ }
        return null;
    }, [API_BASE]);

    const handleJanaadhaarVerify = async () => {
        if (!janaadhaarInput.trim()) return;
        setVerifyingJanaadhaar(true);
        setJanaadhaarError('');
        try {
            const res = await fetch(`${API_BASE}/schemes/janaadhaar-mock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: janaadhaarInput })
            });
            const data = await res.json();
            if (data.success && data.profile) {
                const prof = data.profile;
                
                const newProfile = {
                    language: profile.language,
                    name: prof.name.split(' ')[0],
                    occupation: prof.occupation.includes('Farmer') || prof.occupation.includes('किसान') ? 'farmer' 
                              : prof.occupation.includes('Labourer') || prof.occupation.includes('मजदूर') ? 'agricultural-laborer'
                              : prof.occupation.includes('Unemployed') || prof.occupation.includes('बेरोजगार') ? 'unemployed'
                              : 'other',
                    ageGroup: prof.age < 18 ? 'under18' : prof.age > 60 ? 'above60' : '18to60',
                    incomeRange: prof.income < 100000 ? 'under1l' : prof.income < 500000 ? '1lto5l' : prof.income < 800000 ? '5lto8l' : 'above8l',
                    stateType: prof.state,
                    stateName: prof.state,
                    district: prof.district,
                    category: prof.category.toLowerCase(),
                    land: String(prof.landOwnedHectares || 0)
                };

                setProfile(newProfile);
                
                const greetText = profile.language === 'marwari'
                    ? `जन आधार सत्यापित हो ग्यो सा! राम राम सा ${prof.name} जी। आपरी प्रोफाइल: \n• काम: ${prof.occupation}\n• कमाई: ₹${prof.income.toLocaleString()}\n• ज़मीन: ${prof.landOwnedHectares} हेक्टेयर\n• जात: ${prof.category}\n• निवास: ${prof.district}, ${prof.state}`
                    : `जन आधार सत्यापित! राम राम सा, ${prof.name} जी। आपकी प्रोफाइल प्राप्त हो गई है:\n• व्यवसाय: ${prof.occupation}\n• वार्षिक आय: ₹${prof.income.toLocaleString()}\n• भूमि: ${prof.landOwnedHectares} हेक्टेयर\n• वर्ग: ${prof.category}\n• निवास: ${prof.district}, ${prof.state}`;
                
                setChatHistory(prev => [
                    ...prev,
                    { sender: 'user', text: `जन आधार / SSO सत्यापन: ${janaadhaarInput}` },
                    { sender: 'ai', text: greetText }
                ]);
                
                setChatStep(6);
                speakText(profile.language === 'marwari'
                    ? `जन आधार सत्यापित हो ग्यो सा! राम राम सा ${prof.name} जी। थारे सारू योजनाएं खोजी जा रही है सा।`
                    : `जन आधार सत्यापित! राम राम सा ${prof.name} जी। आपके डेटाबेस से आपकी योग्य योजनाएं खोजी जा रही हैं...`);
                
                await fetchEligibleSchemes(newProfile);
            } else {
                setJanaadhaarError(profile.language === 'marwari' ? 'गलत जन आधार / SSO आईडी सा।' : 'अवैध जन आधार / SSO आईडी। कृपया पुनः प्रयास करें।');
            }
        } catch (err) {
            setJanaadhaarError(profile.language === 'marwari' ? 'कनेक्शन में खराबी आई सा।' : 'कनेक्शन में त्रुटि। कृपया पुनः प्रयास करें।');
        } finally {
            setVerifyingJanaadhaar(false);
        }
    };

    const [isApplying, setIsApplying] = useState(false);
    const [applyingScheme, setApplyingScheme] = useState<any>(null);
    const [applyStep, setApplyStep] = useState(0);
    const [applyData, setApplyData] = useState({
        bankAccount: '',
        ifsc: '',
        mutationNumber: '',
        phone: ''
    });

    const startApplyWorkflow = (scheme: any) => {
        setIsApplying(true);
        setApplyingScheme(scheme);
        setApplyStep(0);
        setApplyData({
            bankAccount: '',
            ifsc: '',
            mutationNumber: '',
            phone: ''
        });

        const startMsg = profile.language === 'marwari'
            ? `राम राम सा! '${scheme.title}' सारू आवेदन शुरू हो ग्यो है सा। मेहरबानी करके आपनो बैंक खातो नम्बर बताओ सा?`
            : `आवेदन प्रक्रिया शुरू! '${scheme.title}' के लिए आवेदन पत्र भरने में मैं आपकी सहायता करूँगी। कृपया अपना बैंक खाता संख्या (Bank Account Number) दर्ज करें या बोलकर बताएं:`;
        
        setChatHistory([
            { sender: 'ai', text: startMsg }
        ]);
        speakText(startMsg);
    };

    const handleApplyStepSubmit = (stepIndex: number, text: string) => {
        setChatHistory(prev => [...prev, { sender: 'user', text }]);
        setChatLoading(true);

        let aiReply = '';
        const currentData = { ...applyData };

        if (stepIndex === 0) {
            currentData.bankAccount = text;
            setApplyData(currentData);
            setApplyStep(1);
            aiReply = profile.language === 'marwari'
                ? `बैंक खातो नम्बर सेव कर लियो सा। अब आपनो बैंक को IFSC कोड बताओ सा (जैसे SBIN0001234)?`
                : `खाता संख्या दर्ज कर ली गई है। अब कृपया अपने बैंक शाखा का IFSC कोड दर्ज करें या बोलकर बताएं (जैसे SBIN0001234):`;
        } else if (stepIndex === 1) {
            currentData.ifsc = text.toUpperCase();
            setApplyData(currentData);
            setApplyStep(2);
            aiReply = profile.language === 'marwari'
                ? `IFSC कोड भी सेव कर लियो सा। अब आपनो मोबाईल नम्बर बताओ सा?`
                : `IFSC कोड सहेज लिया गया है। अब कृपया अपना 10-अंकीय मोबाइल नंबर दर्ज करें या बोलकर बताएं:`;
        } else if (stepIndex === 2) {
            currentData.phone = text;
            setApplyData(currentData);
            
            const isFarmerScheme = (applyingScheme?.audience || '').toLowerCase().includes('farmer') || 
                                   (applyingScheme?.title || '').toLowerCase().includes('kisan') || 
                                   (applyingScheme?.title || '').includes('किसान') || 
                                   profile.occupation === 'farmer';

            if (isFarmerScheme) {
                setApplyStep(3);
                aiReply = profile.language === 'marwari'
                    ? `मोबाईल नम्बर सेव कर लिया सा। अब मेहरबानी करके आपनी ज़मीन को म्यूटेशन/खेवट नम्बर (Mutation/Khewat Number) बताओ सा?`
                    : `मोबाइल नंबर सहेज लिया गया है। अब कृपया अपने खेत का म्यूटेशन/खेवट नंबर (Land Mutation/Khewat Number) दर्ज करें या बोलकर बताएं:`;
            } else {
                setApplyStep(4);
                aiReply = profile.language === 'marwari'
                    ? `घणी मेहरबानी सा! आपरो आवेदन फॉर्म पूरा भर ग्यो है सा। नीचे दिए गए बटन से आपरी e-Mitra रसीद प्रिंट कर लो सा।`
                    : `धन्यवाद! आवेदन फॉर्म के सभी विवरण सफलतापूर्वक एकत्र कर लिए गए हैं। नीचे दिए गए बटन से अपने e-Mitra आवेदन पत्र का प्रिंट या PDF प्राप्त करें।`;
            }
        } else if (stepIndex === 3) {
            currentData.mutationNumber = text;
            setApplyData(currentData);
            setApplyStep(4);
            aiReply = profile.language === 'marwari'
                ? `घणी मेहरबानी सा! म्यूटेशन नम्बर सेव हो ग्यो है। आपरो आवेदन फॉर्म पूरा भर ग्यो है सा। नीचे दिए गए बटन से आपरी e-Mitra रसीद प्रिंट कर लो सा।`
                : `धन्यवाद! सभी आवश्यक विवरण (भूमि विवरण सहित) सफलतापूर्वक एकत्र कर लिए गए हैं। नीचे दिए गए बटन से अपने e-Mitra आवेदन पत्र का प्रिंट या PDF प्राप्त करें।`;
        }

        setChatHistory(prev => [...prev, { sender: 'ai', text: aiReply }]);
        setChatLoading(false);
        speakText(aiReply);
    };

    const [chatHistory, setChatHistory] = useState<Array<{ sender: 'ai' | 'user'; text: string }>>([
        { 
            sender: 'ai', 
            text: 'राम राम सा! मैं आपकी AI सेवा मित्र हूँ। कृपया अपनी पसंदीदा भाषा चुनें:' 
        }
    ]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);

    const [matchedSchemes, setMatchedSchemes] = useState<any[]>([]);
    const [matchLoading, setMatchLoading] = useState(false);
    
    // Scheme Modal State
    const [modalScheme, setModalScheme] = useState<any | null>(null);
    const [selectedDetailTab, setSelectedDetailTab] = useState<'overview' | 'eligibility' | 'benefits' | 'process'>('overview');

    // Speech Recognition Setup — recreate only when language changes
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                const rec = new SpeechRecognition();
                rec.continuous = false;
                rec.interimResults = true;
                rec.lang = SPEECH_LANG_MAP[profile.language] || 'hi-IN';

                rec.onstart = () => {
                    setIsListening(true);
                    setInterimText('');
                };

                rec.onresult = (event: any) => {
                    let interim = '';
                    let final = '';
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) {
                            final += event.results[i][0].transcript;
                        } else {
                            interim += event.results[i][0].transcript;
                        }
                    }
                    if (interim) setInterimText(interim);
                    if (final) {
                        setIsListening(false);
                        setInterimText('');
                        // Use ref so we always call the latest handler (no stale closure)
                        handleVoiceResultRef.current(final);
                    }
                };

                rec.onerror = () => setIsListening(false);
                rec.onend = () => setIsListening(false);
                recognitionRef.current = rec;
            }
        }
    }, [profile.language]);

    // Query Database for Eligible Schemes
    const fetchEligibleSchemes = useCallback(async (userProfile = profile) => {
        setMatchLoading(true);
        try {
            const queryBody = {
                age: userProfile.ageGroup === 'under18' ? 16 : userProfile.ageGroup === 'above60' ? 65 : 35,
                income: userProfile.incomeRange === 'under1l' ? 80000 : userProfile.incomeRange === '1lto5l' ? 250000 : userProfile.incomeRange === '5lto8l' ? 600000 : 900000,
                occupation: userProfile.occupation,
                category: userProfile.category,
                state: userProfile.stateName,
                district: userProfile.district,
                land: parseFloat(userProfile.land) || 0
            };

            const res = await fetch(`${API_BASE}/schemes/match`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(queryBody)
            });
            const data = await res.json();
            if (data.success) {
                const eligibleOnly = (data.data || []).filter((s: any) => s.eligible);
                setMatchedSchemes(eligibleOnly);

                const speakMsg = userProfile.language === 'en'
                    ? `Analysis complete! Found ${eligibleOnly.length} eligible schemes for you.`
                    : userProfile.language === 'marwari'
                    ? `राम राम सा! थारे सारू ${eligibleOnly.length} योजनाएं मिली है सा।`
                    : `विश्लेषण पूर्ण हुआ। आपके लिए ${eligibleOnly.length} पात्र योजनाएं पाई गई हैं।`;
                speakText(speakMsg);
            }
        } catch (err) {
            console.error('Match failed:', err);
        } finally {
            setMatchLoading(false);
        }
    }, [API_BASE, profile, speakText]);

    // Step Submit Logic
    const handleStepSubmit = async (stepIndex: number | string, rawVal: string, displayLabel: string) => {
        const text = rawVal.trim();
        if (!text && stepIndex !== 5) return;

        setChatHistory(prev => [...prev, { sender: 'user', text: displayLabel }]);
        setChatLoading(true);

        const currentProf = { ...profile };
        let nextStep: number | string = typeof stepIndex === 'number' ? stepIndex + 1 : 2;

        switch (stepIndex) {
            case 0:
                currentProf.language = text;
                setProfile(currentProf);
                updateStep(1);
                nextStep = 1;
                break;

            case 1:
                // Yes = first time, No = returning
                if (text === 'yes') {
                    setIsFirstTime(true);
                    updateStep(2);
                    nextStep = 2;
                } else {
                    setIsFirstTime(false);
                    updateStep(-1); // special: waiting for phone
                    nextStep = '1b';
                }
                break;

            case -1:
            case '1b': {
                // Returning user entered phone
                const phone = text.replace(/\D/g, '').slice(0, 10);
                if (!/^[6-9]\d{9}$/.test(phone)) {
                    setPhoneError(currentProf.language === 'en' ? 'Invalid mobile number.' : 'अमान्य मोबाइल नंबर।');
                    setChatLoading(false);
                    return;
                }
                setPhoneError('');
                const saved = await loadProfileByPhone(phone);
                if (saved) {
                    const restoredProfile = { ...saved, language: currentProf.language };
                    setProfile(restoredProfile);
                    const welcomeBack = currentProf.language === 'en'
                        ? `Welcome back ${saved.name}! Your saved profile has been loaded. Searching eligible schemes...`
                        : currentProf.language === 'marwari'
                        ? `राम राम सा ${saved.name} जी! आपरी पुरानी जानकारी मिल गई सा। योजनाएं खोजी जा रही है...`
                        : `स्वागत है ${saved.name} जी! आपकी सेव की गई जानकारी मिल गई। योग्य योजनाएं खोजी जा रही हैं...`;
                    setChatHistory(prev => [...prev, { sender: 'ai', text: welcomeBack }]);
                    setChatLoading(false);
                    updateStep(7);
                    speakText(welcomeBack);
                    fetchEligibleSchemes(restoredProfile);
                    return;
                } else {
                    setIsFirstTime(true);
                    updateStep(2);
                    nextStep = 2;
                    const notFound = currentProf.language === 'en'
                        ? `No saved profile found for this number. Let's create your profile!`
                        : currentProf.language === 'marwari'
                        ? `इस नंबर पर कोई जानकारी नहीं मिली सा। नई प्रोफाइल बनाते हैं।`
                        : `इस नंबर पर कोई प्रोफाइल नहीं मिली। नई प्रोफाइल बनाते हैं!`;
                    setChatHistory(prev => [...prev, { sender: 'ai', text: notFound }]);
                    setChatLoading(false);
                    speakText(notFound);
                    const namePrompt = await fetchAIResponse(2, currentProf);
                    setChatHistory(prev => [...prev, { sender: 'ai', text: namePrompt }]);
                    speakText(namePrompt);
                    return;
                }
            }

            case 2: {
                const userName = text.replace(/(?:मेरा नाम|name is|म्हारो नाम|हूँ|हू)/gi, '').trim() || text;
                currentProf.name = userName;
                setProfile(currentProf);
                updateStep(3);
                nextStep = 3;
                break;
            }
            case 3: {
                let occ = text;
                if (/kisan|farm|crop|agri|खेती|किसान|कृषक/i.test(text)) occ = 'farmer';
                else if (/labor|work|mazdoor|मजदूर|मजदूरी|श्रमिक/i.test(text)) occ = 'agricultural-laborer';
                else if (/business|self|dokan|shop|दुकान|उद्यमी/i.test(text)) occ = 'self-employed';
                else if (/student|padh|छात्र|पढ़ाई/i.test(text)) occ = 'student';
                else if (/unemployed|bero|बेरोजगार/i.test(text)) occ = 'unemployed';
                currentProf.occupation = occ;
                setProfile(currentProf);
                updateStep(4);
                nextStep = 4;
                break;
            }
            case 4:
                currentProf.ageGroup = text;
                setProfile(currentProf);
                updateStep(5);
                nextStep = 5;
                break;
            case 5:
                currentProf.incomeRange = text;
                setProfile(currentProf);
                updateStep(6);
                nextStep = 6;
                break;
            case 6:
                // State/district/category/land submitted — ask for mobile
                updateStep(61);
                nextStep = 61;
                break;
            case 61: {
                // Mobile number submitted — save profile and search schemes
                const phone = text.replace(/\D/g, '').slice(0, 10);
                if (!/^[6-9]\d{9}$/.test(phone)) {
                    setPhoneError(profile.language === 'en' ? 'Invalid mobile number.' : 'अमान्य मोबाइल नंबर।');
                    setChatLoading(false);
                    return;
                }
                setPhoneError('');
                currentProf.phone = phone;
                setProfile(currentProf);
                await saveProfileByPhone(phone, currentProf);
                updateStep(7);
                nextStep = 7;
                fetchEligibleSchemes(currentProf);
                break;
            }
            default:
                break;
        }

        const aiReply = await fetchAIResponse(nextStep, currentProf);
        setChatHistory(prev => [...prev, { sender: 'ai', text: aiReply }]);
        setChatLoading(false);
        speakText(aiReply);
    };

    // Text or Voice Submit Handler
    const handleTextOrVoiceSubmit = async (textOverride?: string) => {
        const text = (textOverride || chatInput).trim();
        if (!text) return;

        setChatInput('');
        if (isApplying) {
            handleApplyStepSubmit(applyStep, text);
        } else {
            // step -1 is the returning-user phone input, maps to case '1b'
            const activeStep = chatStepRef.current === -1 ? '1b' : chatStepRef.current;
            await handleStepSubmit(activeStep, text, text);
        }
    };

    // Keep voice result ref always pointing to latest handler
    useEffect(() => {
        handleVoiceResultRef.current = handleTextOrVoiceSubmit;
    });

    // Toggle Mic Listening
    const toggleListening = () => {
        if (!recognitionRef.current) return;

        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
            try {
                recognitionRef.current.start();
            } catch (e) {
                console.warn('Rec start error:', e);
            }
        }
    };

    // Reset Flow
    const handleReset = () => {
        updateStep(0);
        setIsFirstTime(null);
        setPhoneInput('');
        setPhoneError('');
        setProfile({
            language: 'hi',
            name: '',
            occupation: 'farmer',
            ageGroup: '18to60',
            incomeRange: '1lto5l',
            stateType: 'Rajasthan',
            stateName: 'Rajasthan',
            district: 'Jaipur',
            category: 'obc',
            land: '1.5',
            phone: ''
        });
        const init = 'राम राम सा! मैं आपकी AI सेवा मित्र हूँ। कृपया अपनी पसंदीदा भाषा चुनें:';
        setChatHistory([{ sender: 'ai', text: init }]);
        setMatchedSchemes([]);
        setModalScheme(null);
        setJanaadhaarInput('');
        setJanaadhaarError('');
        setIsApplying(false);
        setApplyingScheme(null);
        setApplyStep(0);
        speakText(init);
    };

    // Open Modal for Scheme Details
    const openSchemeModal = (scheme: any) => {
        setModalScheme(scheme);
        setSelectedDetailTab('overview');
        speakText(`राम राम सा! ${scheme.title}! ${scheme.summary}. मुख्य लाभ: ${(scheme.benefits || []).slice(0, 2).join(', ')}.`);
    };

    // ──────────────────────────────────────────────────────────────────────────
    // OPTION 2: DOCUMENT OCR & ERROR SCANNER
    // ──────────────────────────────────────────────────────────────────────────
    const [docFile, setDocFile] = useState<File | null>(null);
    const [ocrLoading, setOcrLoading] = useState(false);
    const [ocrAnalysis, setOcrAnalysis] = useState<any | null>(null);

    const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setDocFile(file);
        setOcrLoading(true);
        setOcrAnalysis(null);

        const formData = new FormData();
        formData.append('document', file);

        try {
            const res = await fetch(`${API_BASE}/schemes/ocr-mock`, { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) {
                const ext = data.extracted;
                setOcrAnalysis({
                    docType: file.name.toLowerCase().includes('jan') ? 'जन आधार कार्ड' : 'आधार / फ़ॉर्म',
                    fileName: file.name,
                    extractedName: ext.name || 'कमला देवी',
                    uniqueId: ext.uniqueId || 'XXXX-XXXX-9023',
                    checks: [
                        { check: 'फ़ोटो एवं लिखावट', pass: true, note: 'स्पष्ट है (Clear)' },
                        { check: 'नाम स्पेलिंग मैच', pass: false, note: 'आवेदन पत्र और जन-आधार में स्पेलिंग अंतर' },
                        { check: 'जमाबंदी नक़ल वैधता', pass: false, note: '6 महीने से पुरानी प्रति' }
                    ],
                    fixes: [
                        'जन-आधार के अनुसार आवेदन पर स्पेलिंग ठीक करें।',
                        'ई-मित्र से नई जमाबंदी नक़ल लगाकर संलग्न करें।'
                    ]
                });
                speakText('दस्तावेज़ की जाँच पूर्ण। २ त्रुटियां पाई गई हैं।');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setOcrLoading(false);
        }
    };

    // Sidebar nav items — add more here later
    const NAV_ITEMS = [
        { id: 'discovery' as const, icon: <FaRobot size={16} />, label: 'AI Chatbot', sublabel: 'सेवा मित्र' },
        { id: 'document_ocr' as const, icon: <FaFileUpload size={16} />, label: 'Document OCR', sublabel: 'दस्तावेज़ जाँच' },
    ];

    return (
        <main className="flex h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 overflow-hidden">

            {/* ── LEFT SIDEBAR ── */}
            <aside className={`flex-shrink-0 flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-300 ${sidebarOpen ? 'w-52' : 'w-14'}`}>
                {/* Sidebar top: logo + toggle */}
                <div className="flex items-center justify-between px-3 py-4 border-b border-slate-800">
                    {sidebarOpen && (
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest leading-tight">
                            Rajasthan<br />AI Seva Mitra
                        </span>
                    )}
                    <button
                        onClick={() => setSidebarOpen(o => !o)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition flex-shrink-0"
                    >
                        <FaBars size={14} />
                    </button>
                </div>

                {/* Nav items */}
                <nav className="flex-1 py-3 space-y-1 px-2">
                    {NAV_ITEMS.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveOption(item.id)}
                            className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-xl transition text-left ${
                                activeOption === item.id
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white border border-transparent'
                            }`}
                        >
                            <span className="flex-shrink-0">{item.icon}</span>
                            {sidebarOpen && (
                                <span className="flex flex-col min-w-0">
                                    <span className="text-[11px] font-bold truncate">{item.label}</span>
                                    <span className="text-[9px] opacity-60 truncate">{item.sublabel}</span>
                                </span>
                            )}
                        </button>
                    ))}
                </nav>

                {/* Sidebar bottom: version */}
                <div className="px-3 py-3 border-t border-slate-800">
                    {sidebarOpen
                        ? <span className="text-[9px] text-slate-600 font-mono">v1.0 · e-Mitra AI</span>
                        : <span className="text-[9px] text-slate-600 font-mono">v1</span>
                    }
                </div>
            </aside>

            {/* ── MAIN CONTENT AREA ── */}
            <div className="flex-1 flex flex-col overflow-hidden">

                {/* ── OPTION 1: AI CHATBOT ── */}
                {activeOption === 'discovery' && (
                    <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
                        {/* CHATBOT DEVICE CONTAINER — fills available height */}
                        <div className="border-[6px] border-slate-800 bg-slate-950 rounded-[32px] shadow-2xl overflow-hidden flex flex-col w-full max-w-2xl" style={{ height: 'calc(100vh - 2rem)' }}>

                            {/* Phone Notch Header */}
                            <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs transition ${isSpeaking ? 'bg-pink-500 text-slate-950 animate-pulse' : 'bg-pink-500/20 text-pink-400'}`}>
                                        <FaRobot />
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-bold text-white leading-none flex items-center gap-1">
                                            <span>Pragati AI (महिला मित्र)</span>
                                            {isSpeaking && <FaWaveSquare className="text-pink-400 text-[10px] animate-pulse" />}
                                        </h3>
                                        <span className="text-[10px] text-pink-400 font-semibold">
                                            {isApplying ? `आवेदन: चरण ${applyStep + 1}` : chatStep === 7 ? 'पात्र योजनाएं' : chatStep < 0 ? 'मोबाइल से खोजें' : `चरण ${chatStep + 1} / 8`}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* Female / Male Voice Selector Toggle */}
                                    <button
                                        onClick={() => {
                                            const next = voiceGender === 'female' ? 'male' : 'female';
                                            setVoiceGender(next);
                                            speakText(next === 'female' ? 'भारतीय महिला AI अवाज़ सक्रिय की गई।' : 'पुरुष AI अवाज़ सक्रिय की गई।');
                                        }}
                                        className={`px-2 py-1 rounded-lg border text-[10px] font-bold transition flex items-center gap-1 ${voiceGender === 'female' ? 'bg-pink-500/20 text-pink-300 border-pink-500/40' : 'bg-slate-800 text-slate-300 border-slate-700'}`}
                                        title="अवाज़ का प्रकार बदलें (महिला / पुरुष)"
                                    >
                                        {voiceGender === 'female' ? '👩 महिला वॉयस' : '👨 पुरुष वॉयस'}
                                    </button>

                                    <button
                                        onClick={() => speakText(chatHistory[chatHistory.length - 1]?.text || 'राम राम सा!')}
                                        className={`px-2 py-1 rounded-lg border transition text-[10px] font-bold flex items-center gap-1 ${isSpeaking ? 'bg-pink-500 text-slate-950 border-pink-400 animate-pulse' : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-pink-400'}`}
                                        title="आवाज़ चालू/दोबारा सुनें"
                                    >
                                        <FaVolumeUp size={12} /> {isSpeaking ? 'बोल रही है...' : 'सुनें'}
                                    </button>

                                    <button onClick={handleReset} className="text-xs text-slate-400 hover:text-white p-1.5 bg-slate-800 rounded-lg border border-slate-700" title="पुनः शुरू करें">
                                        <FaUndo size={12} />
                                    </button>
                                </div>
                            </div>

                            {/* PHONE SCREEN INNER CONTENT */}
                            {chatStep !== 7 || isApplying ? (
                                /* CHATBOT CONVERSATION VIEW (STEPS 0 TO 5) */
                                <div className="flex-1 flex flex-col justify-between p-4 overflow-hidden">
                                    {/* Messages Area */}
                                    <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">

                                        {chatHistory.map((m, i) => (
                                            <div key={i} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[88%] rounded-2xl p-3 text-xs sm:text-sm leading-relaxed ${m.sender === 'user' ? 'bg-emerald-600 text-white rounded-tr-none font-medium shadow' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700 shadow-md'}`}>
                                                    {m.text}
                                                </div>
                                            </div>
                                        ))}
                                        {chatLoading && (
                                            <div className="flex justify-start">
                                                <div className="bg-slate-800 text-slate-400 rounded-2xl p-2.5 text-xs flex items-center gap-2">
                                                    <FaSpinner className="animate-spin text-pink-400" />
                                                    <span>AI विचार कर रहा है...</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* DYNAMIC INTERACTIVE OPTION CHIPS FOR EACH STEP */}

                                    {/* STEP 0: LANGUAGES */}
                                    {chatStep === 0 && (
                                        <div className="py-2 grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                                            {LANGUAGES.map((l) => (
                                                <button
                                                    key={l.code}
                                                    onClick={() => handleStepSubmit(0, l.code, l.label)}
                                                    className="bg-pink-500/20 hover:bg-pink-500 text-pink-300 hover:text-slate-950 border border-pink-500/40 text-[11px] font-bold py-2 px-2 rounded-xl transition text-left truncate"
                                                >
                                                    {l.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* STEP 1: FIRST TIME? YES / NO */}
                                    {chatStep === 1 && (
                                        <div className="py-2 grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => handleStepSubmit(1, 'yes', profile.language === 'en' ? '✅ Yes, First Time' : '✅ हाँ, पहली बार')}
                                                className="bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 text-xs font-bold py-3 px-3 rounded-xl transition"
                                            >
                                                {profile.language === 'en' ? '✅ Yes, First Time' : '✅ हाँ, पहली बार'}
                                            </button>
                                            <button
                                                onClick={() => handleStepSubmit(1, 'no', profile.language === 'en' ? '❌ No, Returning' : '❌ नहीं, पहले आया हूँ')}
                                                className="bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 border border-cyan-500/40 text-xs font-bold py-3 px-3 rounded-xl transition"
                                            >
                                                {profile.language === 'en' ? '❌ No, Returning' : '❌ नहीं, पहले आया हूँ'}
                                            </button>
                                        </div>
                                    )}

                                    {/* STEP 3: OCCUPATIONS */}
                                    {chatStep === 3 && (
                                        <div className="py-2 grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
                                            {OCCUPATIONS.map((o) => (
                                                <button
                                                    key={o.value}
                                                    onClick={() => handleStepSubmit(3, o.value, o.label)}
                                                    className="bg-slate-900 hover:bg-pink-500 text-slate-300 hover:text-slate-950 border border-slate-700 hover:border-pink-500 text-[11px] font-bold py-2 px-3 rounded-xl transition text-left flex items-center justify-between"
                                                >
                                                    <span>{o.label}</span>
                                                    <FaChevronRight size={10} className="opacity-50" />
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* STEP 4: AGE GROUPS */}
                                    {chatStep === 4 && (
                                        <div className="py-2 space-y-1.5">
                                            {AGE_GROUPS.map((a) => (
                                                <button
                                                    key={a.value}
                                                    onClick={() => handleStepSubmit(4, a.value, a.label)}
                                                    className="w-full bg-slate-900 hover:bg-pink-500 text-slate-300 hover:text-slate-950 border border-slate-700 hover:border-pink-500 text-[11px] font-bold py-2.5 px-3 rounded-xl transition text-left flex items-center justify-between"
                                                >
                                                    <span>{a.label}</span>
                                                    <FaChevronRight size={10} className="opacity-50" />
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* STEP 5: ANNUAL INCOME */}
                                    {chatStep === 5 && (
                                        <div className="py-2 space-y-1.5">
                                            {INCOME_RANGES.map((inc) => (
                                                <button
                                                    key={inc.value}
                                                    onClick={() => handleStepSubmit(5, inc.value, inc.label)}
                                                    className="w-full bg-slate-900 hover:bg-pink-500 text-slate-300 hover:text-slate-950 border border-slate-700 hover:border-pink-500 text-[11px] font-bold py-2.5 px-3 rounded-xl transition text-left flex items-center justify-between"
                                                >
                                                    <span>{inc.label}</span>
                                                    <FaChevronRight size={10} className="opacity-50" />
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* STEP 6: STATE, DISTRICT, CATEGORY & LAND */}
                                    {chatStep === 6 && (
                                        <div className="py-2 space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">1. राज्य (State):</label>
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => setProfile({ ...profile, stateType: 'Rajasthan', stateName: 'Rajasthan' })}
                                                        className={`text-[11px] font-bold py-1.5 px-2 rounded-lg border transition ${profile.stateType === 'Rajasthan' ? 'bg-pink-500 text-slate-950 border-pink-500' : 'bg-slate-900 border-slate-700 text-slate-300'}`}
                                                    >
                                                        1. Rajasthan (राजस्थान)
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setProfile({ ...profile, stateType: 'Other', stateName: 'Madhya Pradesh' })}
                                                        className={`text-[11px] font-bold py-1.5 px-2 rounded-lg border transition ${profile.stateType === 'Other' ? 'bg-pink-500 text-slate-950 border-pink-500' : 'bg-slate-900 border-slate-700 text-slate-300'}`}
                                                    >
                                                        2. Other State (अन्य राज्य)
                                                    </button>
                                                </div>
                                            </div>

                                            {profile.stateType === 'Rajasthan' ? (
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase">2. जिला (District):</label>
                                                    <select
                                                        value={profile.district}
                                                        onChange={(e) => setProfile({ ...profile, district: e.target.value })}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-pink-500 focus:outline-none"
                                                    >
                                                        {RAJASTHAN_DISTRICTS.map((d) => (
                                                            <option key={d} value={d}>{d}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            ) : (
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase">2. राज्य का नाम चुनें (Select State):</label>
                                                    <select
                                                        value={profile.stateName}
                                                        onChange={(e) => setProfile({ ...profile, stateName: e.target.value })}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-pink-500 focus:outline-none"
                                                    >
                                                        {OTHER_STATES.map((s) => (
                                                            <option key={s} value={s}>{s}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}

                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">3. सामाजिक श्रेणी (Category):</label>
                                                <select
                                                    value={profile.category}
                                                    onChange={(e) => setProfile({ ...profile, category: e.target.value })}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-pink-500 focus:outline-none"
                                                >
                                                    {CATEGORIES.map((c) => (
                                                        <option key={c.value} value={c.value}>{c.label}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">4. कृषि भूमि हेक्टेयर में (Land in Hectares):</label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={profile.land}
                                                    onChange={(e) => setProfile({ ...profile, land: e.target.value })}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-pink-500 focus:outline-none font-sans"
                                                    placeholder="e.g. 1.5"
                                                />
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleStepSubmit(6, profile.district, `राज्य: ${profile.stateName}, जिला: ${profile.district}, श्रेणी: ${profile.category.toUpperCase()}, भूमि: ${profile.land} हेक्टेयर`)}
                                                className="w-full bg-pink-500 hover:bg-pink-400 text-slate-950 font-black text-xs py-2.5 rounded-xl transition shadow mt-2 flex items-center justify-center gap-1.5"
                                            >
                                                <FaCheck /> {profile.language === 'en' ? 'Next → Save Mobile' : profile.language === 'marwari' ? 'आगे जाओ सा' : 'आगे → मोबाइल नंबर'}
                                            </button>
                                        </div>
                                    )}

                                    {/* Bottom Mic & Text Input Control Bar */}
                                    <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-1.5">
                                        {phoneError && <p className="text-[10px] text-red-400 px-1">{phoneError}</p>}
                                        <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={toggleListening}
                                            className={`h-11 w-11 rounded-xl flex items-center justify-center transition shadow-lg flex-shrink-0 ${isListening ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-500/40 shadow-red-500/50' : 'bg-pink-500 text-slate-950 font-bold hover:bg-pink-400'}`}
                                            title={isListening ? 'माइक बंद करें' : 'बोलकर उत्तर दें (माइक चालू करें)'}
                                        >
                                            {isListening ? <FaStop size={16} /> : <FaMicrophone size={18} />}
                                        </button>

                                        <div className="flex-1 relative">
                                            <input
                                                type="text"
                                                value={chatInput}
                                                onChange={(e) => setChatInput(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleTextOrVoiceSubmit()}
                                                placeholder={
                                                    isListening ? 'आवाज़ सुनी जा रही है...' :
                                                    isApplying ? 'विवरण दर्ज करें या बोलें...' :
                                                    chatStep === 2 ? (profile.language === 'en' ? 'Type your name...' : profile.language === 'marwari' ? 'आपनो नाम लिखो सा...' : 'अपना नाम लिखें...') :
                                                    (chatStep === -1 || chatStep === 61) ? (profile.language === 'en' ? '10-digit mobile number...' : '10 अंक का मोबाइल नंबर...') :
                                                    'बोलें या लिखें...'
                                                }
                                                className={`w-full border rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition ${isListening ? 'bg-red-950/30 border-red-500' : 'bg-slate-900 border-slate-700 focus:border-pink-500'}`}
                                            />
                                            {interimText && (
                                                <span className="absolute left-2 -top-6 bg-amber-500 text-slate-950 text-[9px] font-bold px-1.5 py-0.5 rounded shadow animate-pulse">
                                                    सुना: {interimText}
                                                </span>
                                            )}
                                        </div>

                                        <button onClick={() => handleTextOrVoiceSubmit()} className="bg-slate-800 hover:bg-pink-500 hover:text-slate-950 text-white font-bold p-2.5 rounded-xl text-xs transition border border-slate-700">
                                            <FaPaperPlane size={12} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            ) : (
                                /* RESULTS VIEW: ELIGIBLE SCHEMES LIST (STEP 7) */
                                <div className="flex-1 flex flex-col p-4 overflow-hidden">
                                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                                        <h4 className="font-black text-white text-xs">आपकी योग्य योजनाएं (Eligible Schemes)</h4>
                                        <span className="bg-pink-500/20 text-pink-400 font-extrabold text-[10px] px-2 py-0.5 rounded-full border border-pink-500/30">
                                            {matchedSchemes.length} पाई गईं
                                        </span>
                                    </div>

                                    {matchLoading ? (
                                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                                            <FaSpinner className="animate-spin text-pink-400 text-2xl mb-2" />
                                            <span className="text-xs">डेटाबेस का विश्लेषण हो रहा है...</span>
                                        </div>
                                    ) : matchedSchemes.length === 0 ? (
                                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-center p-4 border border-dashed border-slate-800 rounded-2xl">
                                            <p className="text-xs">कोई योजना मैच नहीं हुई। पुनः प्रश्न पूछें।</p>
                                        </div>
                                    ) : (
                                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                                            {matchedSchemes.map((s, idx) => (
                                                <div
                                                    key={idx}
                                                    className="p-3 rounded-2xl border bg-slate-900 border-slate-800 hover:border-pink-500 transition flex flex-col gap-2 group shadow"
                                                >
                                                    <div className="flex items-center justify-between cursor-pointer" onClick={() => openSchemeModal(s)}>
                                                        <div className="space-y-1 pr-2">
                                                            <span className="text-[9px] font-bold bg-pink-500/20 text-pink-300 px-2 py-0.5 rounded-full">
                                                                100% Eligible
                                                            </span>
                                                            <h5 className="font-bold text-white text-xs line-clamp-1 group-hover:text-pink-400 transition">{s.title}</h5>
                                                            <p className="text-[10px] text-slate-400 line-clamp-1">{s.summary}</p>
                                                        </div>
                                                        <span className="text-[10px] bg-pink-500 text-slate-950 font-bold px-2.5 py-1 rounded-lg flex-shrink-0">
                                                            विवरण →
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-end gap-1.5 border-t border-slate-800/80 pt-2 flex-shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => startApplyWorkflow(s)}
                                                            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs py-1.5 rounded-xl transition shadow flex items-center justify-center gap-1.5 shrink-0"
                                                        >
                                                            ✍️ AI से फॉर्म भरें
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <button
                                        onClick={handleReset}
                                        className="w-full bg-slate-900 hover:bg-slate-800 text-slate-400 text-[11px] font-bold py-2 rounded-xl border border-slate-800 transition mt-3 flex items-center justify-center gap-1.5"
                                    >
                                        <FaUndo size={10} /> पुनः प्रश्न पूछें (Restart Chat)
                                    </button>
                                </div>
                            )}

                        </div>
                    </div>
                )}

                {/* ──────────────────────────────────────────────────────────────
                    OPTION 2: DOCUMENT OCR & ERROR SCANNER
                    ────────────────────────────────────────────────────────────── */}
                {activeOption === 'document_ocr' && (
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
                            <h1 className="text-xl font-black text-white">ऑफ़लाइन फ़ॉर्म एवं दस्तावेज़ जाँच (OCR Error Scanner)</h1>
                            <p className="text-xs text-slate-400">फॉर्म या आधार कार्ड की फोटो अपलोड करें। AI गलतियां जांचकर रिपोर्ट देगा।</p>
                        </div>

                        <div className="grid gap-6 md:grid-cols-12">
                            {/* Upload Area */}
                            <div className="md:col-span-5 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between h-[400px]">
                                <h3 className="font-bold text-white text-sm border-b border-slate-800 pb-2">दस्तावेज़ अपलोड करें</h3>

                                <div className="flex-1 border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-2xl bg-slate-950/40 flex flex-col items-center justify-center p-6 relative overflow-hidden transition">
                                    <input type="file" onChange={handleDocUpload} accept="image/*,application/pdf" className="absolute inset-0 opacity-0 cursor-pointer z-10" />

                                    {ocrLoading ? (
                                        <div className="text-center space-y-2">
                                            <FaSpinner className="animate-spin text-emerald-400 text-3xl mx-auto" />
                                            <p className="text-xs text-slate-300 font-bold">त्रुटियां जांची जा रही हैं...</p>
                                        </div>
                                    ) : docFile ? (
                                        <div className="text-center space-y-1">
                                            <FaCheckCircle className="text-emerald-400 text-3xl mx-auto" />
                                            <p className="text-xs font-bold text-white">{docFile.name}</p>
                                        </div>
                                    ) : (
                                        <div className="text-center space-y-2">
                                            <FaFileUpload className="text-slate-500 text-3xl mx-auto" />
                                            <p className="text-xs text-slate-400">फ़ॉर्म / आधार फोटो यहाँ चुनें</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Report Area */}
                            <div className="md:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between h-[400px]">
                                <h3 className="font-bold text-white text-sm border-b border-slate-800 pb-2">त्रुटि विश्लेषण रिपोर्ट</h3>

                                {ocrAnalysis ? (
                                    <div className="space-y-3 text-xs flex-1 py-2 overflow-y-auto">
                                        <div className="bg-slate-950 p-3 rounded-xl space-y-1">
                                            <p><strong>दस्तावेज़:</strong> {ocrAnalysis.docType}</p>
                                            <p><strong>नाम:</strong> {ocrAnalysis.extractedName}</p>
                                        </div>

                                        <div className="space-y-1.5">
                                            {ocrAnalysis.checks.map((c: any, i: number) => (
                                                <div key={i} className={`p-2 rounded-xl border flex items-center justify-between ${c.pass ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
                                                    <span>{c.check}</span>
                                                    <span className="font-bold">{c.note}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                                        <p className="text-xs">दस्तावेज़ अपलोड करने पर यहाँ परिणाम दिखेगा।</p>
                                    </div>
                                )}

                                {ocrAnalysis && (
                                    <button onClick={() => window.print()} className="bg-emerald-500 text-slate-950 font-bold text-xs py-2.5 rounded-xl transition">
                                        रिपोर्ट प्रिंट करें
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

            </div>
            {/* END MAIN CONTENT AREA */}

            {/* ──────────────────────────────────────────────────────────────────
                SCHEME DETAILS POPUP MODAL (OPENED ON SCHEME CLICK)
                ────────────────────────────────────────────────────────────────── */}
            {modalScheme && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
                    <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl max-w-xl w-full space-y-4 max-h-[90vh] overflow-y-auto relative">

                        {/* Modal Header */}
                        <div className="flex items-start justify-between border-b border-slate-800 pb-3 gap-3">
                            <div>
                                <span className="text-[10px] bg-emerald-500 text-slate-950 font-black px-2.5 py-0.5 rounded-full uppercase">
                                    {modalScheme.schemeType === 'state' ? 'राजस्थान राज्य योजना' : 'केन्द्रीय योजना'}
                                </span>
                                <h2 className="text-lg font-bold text-white mt-1 leading-tight">{modalScheme.title}</h2>
                                <p className="text-[11px] text-slate-400 mt-0.5">{modalScheme.department}</p>
                            </div>

                            <button
                                onClick={() => setModalScheme(null)}
                                className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-xl border border-slate-700 transition flex-shrink-0"
                            >
                                <FaTimes size={16} />
                            </button>
                        </div>

                        {/* Readout Audio Button */}
                        <div className="flex justify-between items-center bg-slate-950 p-3 rounded-2xl border border-slate-800">
                            <span className="text-xs text-slate-300 font-medium">योजना का विवरण बोलकर सुनें</span>
                            <button
                                onClick={() => speakText(`${modalScheme.title}. ${modalScheme.description}. लाभ: ${(modalScheme.benefits || []).slice(0, 2).join(', ')}.`)}
                                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow"
                            >
                                <FaVolumeUp /> सुनें
                            </button>
                        </div>

                        {/* Modal Detail Tabs */}
                        <div className="flex gap-3 border-b border-slate-800 text-xs font-bold">
                            {(['overview', 'eligibility', 'benefits', 'process'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setSelectedDetailTab(tab)}
                                    className={`pb-2 border-b-2 transition ${selectedDetailTab === tab ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'}`}
                                >
                                    {tab === 'overview' ? 'विवरण' : tab === 'eligibility' ? 'पात्रता' : tab === 'benefits' ? 'लाभ' : 'दस्तावेज़ & प्रक्रिया'}
                                </button>
                            ))}
                        </div>

                        {/* Modal Tab Content */}
                        <div className="text-xs text-slate-300 leading-relaxed py-1 min-h-[100px]">
                            {selectedDetailTab === 'overview' && <p>{modalScheme.description}</p>}
                            {selectedDetailTab === 'eligibility' && <p>{modalScheme.eligibility}</p>}
                            {selectedDetailTab === 'benefits' && (
                                <ul className="list-disc pl-4 space-y-1 text-emerald-300">
                                    {(modalScheme.benefits || []).map((b: string, i: number) => <li key={i}>{b}</li>)}
                                </ul>
                            )}
                            {selectedDetailTab === 'process' && (
                                <div className="space-y-2">
                                    <p><strong>दस्तावेज़:</strong> {(modalScheme.requiredDocumentsList || ['आधार कार्ड', 'जन आधार']).join(', ')}</p>
                                    <p><strong>प्रक्रिया:</strong> {modalScheme.applicationProcess || 'ई-मित्र पर जाकर आवेदन करें।'}</p>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer Actions */}
                        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                            <span className="text-[10px] text-slate-500 font-mono">e-Mitra Ready Token</span>
                            <button
                                onClick={() => window.print()}
                                className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl border border-slate-700 transition flex items-center gap-2"
                            >
                                <FaPrint /> e-Mitra पर्ची प्रिंट करें
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* 📄 e-Mitra Application Receipt Modal */}
            {isApplying && applyStep === 4 && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col my-8 print:my-0 print:border-none print:shadow-none print:bg-white">
                        
                        {/* Header */}
                        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between flex-shrink-0 print:hidden">
                            <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-xs font-bold text-slate-300">आवेदन पत्र तैयार है (Application Ready)</span>
                            </div>
                            <button
                                onClick={() => {
                                    setIsApplying(false);
                                    setApplyingScheme(null);
                                    setApplyStep(0);
                                    handleReset();
                                }}
                                className="text-slate-400 hover:text-white transition text-xs font-bold bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700"
                            >
                                बंद करें (Close)
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto flex-1 print:p-0">
                            <div className="bg-white text-slate-950 rounded-2xl p-6 border border-slate-200 shadow-lg font-serif print:border-none print:shadow-none print:p-0" id="printable-receipt">
                                
                                {/* Watermark/Emblem */}
                                <div className="text-center space-y-1 border-b-2 border-slate-950 pb-3">
                                    <div className="text-lg font-black uppercase tracking-wider">Government of Rajasthan</div>
                                    <div className="text-[10px] font-bold text-slate-600 font-sans">Department of Information Technology & Communication</div>
                                    <div className="text-xs font-black text-slate-900 bg-slate-100 py-1 px-3 rounded inline-block mt-1.5 font-sans">E-MITRA CITIZEN ENTITLEMENT RECEIPT</div>
                                </div>

                                {/* Metadata */}
                                <div className="grid grid-cols-2 gap-1.5 text-[9px] font-sans border-b border-slate-200 py-2.5">
                                    <div>
                                        <span className="font-bold">Receipt No:</span> EM-{Math.floor(100000 + Math.random() * 900000)}
                                    </div>
                                    <div className="text-right">
                                        <span className="font-bold">Date:</span> {new Date().toLocaleDateString('en-IN')}
                                    </div>
                                    <div>
                                        <span className="font-bold">Scheme Code:</span> {applyingScheme?.code || 'SCH-9820'}
                                    </div>
                                    <div className="text-right">
                                        <span className="font-bold">Status:</span> <span className="text-emerald-700 font-bold">Generated via Seva Mitra AI</span>
                                    </div>
                                </div>

                                {/* Details Section */}
                                <div className="space-y-4 pt-3 text-[11px] leading-relaxed">
                                    {/* Scheme Details */}
                                    <div>
                                        <div className="font-bold text-[9px] uppercase text-slate-500 tracking-wider font-sans">1. Scheme Applied For</div>
                                        <p className="font-bold text-xs text-slate-950 mt-0.5">{applyingScheme?.title}</p>
                                    </div>

                                    {/* Applicant Demographic details */}
                                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 border-t border-slate-100 pt-2.5">
                                        <div className="col-span-2">
                                            <span className="font-bold text-[9px] uppercase text-slate-500 tracking-wider font-sans block">2. Applicant Profile (Jan Aadhaar Authenticated)</span>
                                        </div>
                                        <div>
                                            <span className="font-semibold text-slate-500 text-[9px]">Applicant Name:</span>
                                            <p className="font-bold text-slate-950">{profile.name || 'Rohit Kumar'}</p>
                                        </div>
                                        <div>
                                            <span className="font-semibold text-slate-500 text-[9px]">District & State:</span>
                                            <p className="font-bold text-slate-950">{profile.district}, {profile.stateName}</p>
                                        </div>
                                        <div>
                                            <span className="font-semibold text-slate-500 text-[9px]">Social Category:</span>
                                            <p className="font-bold text-slate-950 uppercase">{profile.category}</p>
                                        </div>
                                        <div>
                                            <span className="font-semibold text-slate-500 text-[9px]">Land Holdings:</span>
                                            <p className="font-bold text-slate-950">{profile.land} Hectares</p>
                                        </div>
                                    </div>

                                    {/* Input Details */}
                                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 border-t border-slate-100 pt-2.5">
                                        <div className="col-span-2">
                                            <span className="font-bold text-[9px] uppercase text-slate-500 tracking-wider font-sans block">3. Transaction & Disbursement Account Details</span>
                                        </div>
                                        <div>
                                            <span className="font-semibold text-slate-500 text-[9px]">Bank Account Number:</span>
                                            <p className="font-bold text-slate-950 tracking-wider">{applyData.bankAccount}</p>
                                        </div>
                                        <div>
                                            <span className="font-semibold text-slate-500 text-[9px]">IFSC Code:</span>
                                            <p className="font-bold text-slate-950">{applyData.ifsc}</p>
                                        </div>
                                        <div>
                                            <span className="font-semibold text-slate-500 text-[9px]">Applicant Contact Number:</span>
                                            <p className="font-bold text-slate-950">{applyData.phone}</p>
                                        </div>
                                        {applyData.mutationNumber && (
                                            <div>
                                                <span className="font-semibold text-slate-500 text-[9px]">Land Khewat/Mutation No:</span>
                                                <p className="font-bold text-slate-950">{applyData.mutationNumber}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Signatures */}
                                <div className="mt-8 pt-5 border-t border-dashed border-slate-300 grid grid-cols-2 gap-4 text-center text-[9px] font-sans">
                                    <div className="space-y-4">
                                        <div className="h-6" />
                                        <div className="border-t border-slate-400 pt-1 text-slate-500">Applicant Signature</div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="h-6 flex items-center justify-center text-[8px] text-emerald-700 font-bold bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200 inline-block">Digitally Signed via Seva Mitra</div>
                                        <div className="border-t border-slate-400 pt-1 text-slate-500">Nodal Verification Authority</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Print / Action Buttons */}
                        <div className="p-4 bg-slate-950 border-t border-slate-800 flex gap-3 flex-shrink-0 print:hidden">
                            <button
                                onClick={() => window.print()}
                                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs py-2.5 rounded-xl transition shadow flex items-center justify-center gap-1.5"
                            >
                                <FaPrint /> PDF डाउनलोड / प्रिंट करें (Print Form)
                            </button>
                            <button
                                onClick={() => {
                                    setIsApplying(false);
                                    setApplyingScheme(null);
                                    setApplyStep(0);
                                    handleReset();
                                }}
                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-2.5 rounded-xl transition border border-slate-700 flex items-center justify-center gap-1.5"
                            >
                                <FaUndo /> नई योजना खोजें (Restart Chat)
                            </button>
                        </div>

                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{__html: `
                @media print {
                    body * {
                        visibility: hidden !important;
                    }
                    #printable-receipt, #printable-receipt * {
                        visibility: visible !important;
                    }
                    #printable-receipt {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        border: none !important;
                        box-shadow: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        color: #000 !important;
                        background: white !important;
                    }
                }
            `}} />

            {/* Footer removed as requested */}
        </main>
    );
}
