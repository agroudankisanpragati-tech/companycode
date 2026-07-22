require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Scheme = require('../models/Scheme');
const Citizen = require('../models/Citizen');

const SCHEMES = [
  {
    schemeId: 'RJ-PM-KISAN-001',
    name: 'PM Kisan Samman Nidhi',
    nameHindi: 'प्रधानमंत्री किसान सम्मान निधि',
    description: 'Financial support of Rs 6000 per year to small and marginal farmers',
    descriptionHindi: 'छोटे और सीमांत किसानों को प्रति वर्ष ₹6000 की वित्तीय सहायता',
    category: 'agriculture',
    level: 'central',
    department: 'Agriculture Department',
    departmentHindi: 'कृषि विभाग',
    benefits: { type: 'financial', amount: 6000, description: 'Rs 6000 per year in 3 installments', descriptionHindi: '₹6000 प्रति वर्ष 3 किस्तों में' },
    eligibility: { minAge: 18, gender: ['all'], categories: ['all'], mustBeFarmer: true, maxLandOwnership: 2 },
    documents: [
      { name: 'Aadhaar Card', nameHindi: 'आधार कार्ड', mandatory: true },
      { name: 'Land Records', nameHindi: 'भूमि रिकॉर्ड', mandatory: true },
      { name: 'Bank Passbook', nameHindi: 'बैंक पासबुक', mandatory: true },
    ],
    applicationProcess: { mode: ['online', 'emitra'], officialLink: 'https://pmkisan.gov.in', eMitraServiceCode: 'E-MITRA-001' },
    tags: ['farmer', 'kisan', 'agriculture', 'किसान', 'खेती'],
    aiMetadata: { keywords: ['farmer', 'kisan', 'agriculture', 'land', 'crop'], popularityScore: 95 },
  },
  {
    schemeId: 'RJ-PALANHAR-002',
    name: 'Palanhar Yojana',
    nameHindi: 'पालनहार योजना',
    description: 'Financial assistance for orphan children and children of widows',
    descriptionHindi: 'अनाथ बच्चों और विधवाओं के बच्चों के लिए वित्तीय सहायता',
    category: 'social_security',
    level: 'state',
    department: 'Social Justice & Empowerment',
    departmentHindi: 'सामाजिक न्याय एवं अधिकारिता विभाग',
    benefits: { type: 'financial', amount: 1500, description: 'Rs 1500 per month per child', descriptionHindi: 'प्रति बच्चा ₹1500 प्रति माह' },
    eligibility: { maxAge: 18, gender: ['all'], categories: ['all'], mustBeBPL: false },
    documents: [
      { name: 'Birth Certificate', nameHindi: 'जन्म प्रमाण पत्र', mandatory: true },
      { name: 'Jan Aadhaar', nameHindi: 'जन आधार', mandatory: true },
      { name: 'BPL Card', nameHindi: 'BPL कार्ड', mandatory: false },
    ],
    applicationProcess: { mode: ['online', 'emitra', 'offline'], officialLink: 'https://sje.rajasthan.gov.in' },
    tags: ['orphan', 'widow', 'child', 'पालनहार', 'बच्चे'],
    aiMetadata: { keywords: ['orphan', 'widow', 'child welfare', 'palanhar'], popularityScore: 88 },
  },
  {
    schemeId: 'RJ-MUKHYAMANTRI-CHIRANJEEVI-003',
    name: 'Mukhyamantri Chiranjeevi Swasthya Bima Yojana',
    nameHindi: 'मुख्यमंत्री चिरंजीवी स्वास्थ्य बीमा योजना',
    description: 'Free health insurance up to Rs 25 lakh per family per year',
    descriptionHindi: 'प्रति परिवार प्रति वर्ष ₹25 लाख तक मुफ्त स्वास्थ्य बीमा',
    category: 'health',
    level: 'state',
    department: 'Health Department',
    departmentHindi: 'स्वास्थ्य विभाग',
    benefits: { type: 'service', amount: 2500000, description: 'Free treatment up to Rs 25 lakh', descriptionHindi: '₹25 लाख तक मुफ्त इलाज' },
    eligibility: { gender: ['all'], categories: ['all'] },
    documents: [
      { name: 'Jan Aadhaar Card', nameHindi: 'जन आधार कार्ड', mandatory: true },
      { name: 'Aadhaar Card', nameHindi: 'आधार कार्ड', mandatory: true },
    ],
    applicationProcess: { mode: ['online', 'emitra'], officialLink: 'https://chiranjeevi.rajasthan.gov.in', eMitraServiceCode: 'E-MITRA-003' },
    tags: ['health', 'insurance', 'chiranjeevi', 'चिरंजीवी', 'स्वास्थ्य'],
    aiMetadata: { keywords: ['health', 'insurance', 'hospital', 'treatment', 'medical'], popularityScore: 98 },
  },
  {
    schemeId: 'RJ-INDIRA-GANDHI-SCHOLARSHIP-004',
    name: 'Indira Gandhi Scholarship for Single Girl Child',
    nameHindi: 'इंदिरा गांधी एकल बालिका छात्रवृत्ति',
    description: 'Scholarship for single girl child pursuing higher education',
    descriptionHindi: 'उच्च शिक्षा प्राप्त करने वाली एकल बालिका के लिए छात्रवृत्ति',
    category: 'education',
    level: 'central',
    department: 'Education Department',
    departmentHindi: 'शिक्षा विभाग',
    benefits: { type: 'scholarship', amount: 36200, description: 'Rs 36200 per year', descriptionHindi: '₹36200 प्रति वर्ष' },
    eligibility: { minAge: 18, maxAge: 30, gender: ['female'], categories: ['all'], mustBeStudent: true },
    documents: [
      { name: 'Aadhaar Card', nameHindi: 'आधार कार्ड', mandatory: true },
      { name: 'Marksheet', nameHindi: 'अंकतालिका', mandatory: true },
      { name: 'Affidavit (Single Girl Child)', nameHindi: 'शपथ पत्र (एकल बालिका)', mandatory: true },
    ],
    applicationProcess: { mode: ['online'], officialLink: 'https://scholarships.gov.in' },
    tags: ['scholarship', 'girl', 'education', 'छात्रवृत्ति', 'बालिका'],
    aiMetadata: { keywords: ['scholarship', 'girl', 'education', 'single child', 'higher education'], popularityScore: 82 },
  },
  {
    schemeId: 'RJ-AAWAS-YOJANA-005',
    name: 'Pradhan Mantri Awas Yojana - Gramin',
    nameHindi: 'प्रधानमंत्री आवास योजना - ग्रामीण',
    description: 'Housing for all - financial assistance for construction of pucca house',
    descriptionHindi: 'सभी के लिए आवास - पक्के मकान के निर्माण के लिए वित्तीय सहायता',
    category: 'housing',
    level: 'central',
    department: 'Rural Development',
    departmentHindi: 'ग्रामीण विकास विभाग',
    benefits: { type: 'financial', amount: 130000, description: 'Rs 1.30 lakh for house construction', descriptionHindi: 'मकान निर्माण के लिए ₹1.30 लाख' },
    eligibility: { gender: ['all'], categories: ['sc', 'st', 'obc', 'ews'], mustBeBPL: true },
    documents: [
      { name: 'Jan Aadhaar', nameHindi: 'जन आधार', mandatory: true },
      { name: 'BPL Certificate', nameHindi: 'BPL प्रमाण पत्र', mandatory: true },
      { name: 'Land Documents', nameHindi: 'भूमि दस्तावेज़', mandatory: true },
    ],
    applicationProcess: { mode: ['online', 'emitra', 'offline'], officialLink: 'https://pmayg.nic.in' },
    tags: ['housing', 'awas', 'house', 'आवास', 'मकान'],
    aiMetadata: { keywords: ['house', 'housing', 'construction', 'BPL', 'rural'], popularityScore: 90 },
  },
  {
    schemeId: 'RJ-VRIDHA-PENSION-006',
    name: 'Rajasthan Old Age Pension Scheme',
    nameHindi: 'राजस्थान वृद्धावस्था पेंशन योजना',
    description: 'Monthly pension for elderly citizens above 55 years',
    descriptionHindi: '55 वर्ष से अधिक आयु के वृद्ध नागरिकों के लिए मासिक पेंशन',
    category: 'elderly',
    level: 'state',
    department: 'Social Justice & Empowerment',
    departmentHindi: 'सामाजिक न्याय एवं अधिकारिता विभाग',
    benefits: { type: 'financial', amount: 1000, description: 'Rs 750-1500 per month', descriptionHindi: '₹750-1500 प्रति माह' },
    eligibility: { minAge: 55, gender: ['all'], categories: ['all'], maxAnnualIncome: 48000 },
    documents: [
      { name: 'Age Proof', nameHindi: 'आयु प्रमाण', mandatory: true },
      { name: 'Income Certificate', nameHindi: 'आय प्रमाण पत्र', mandatory: true },
      { name: 'Jan Aadhaar', nameHindi: 'जन आधार', mandatory: true },
    ],
    applicationProcess: { mode: ['online', 'emitra', 'offline'], officialLink: 'https://ssp.rajasthan.gov.in' },
    tags: ['pension', 'elderly', 'old age', 'पेंशन', 'वृद्ध'],
    aiMetadata: { keywords: ['pension', 'elderly', 'old age', 'senior citizen'], popularityScore: 85 },
  },
  {
    schemeId: 'RJ-DIVYANG-PENSION-007',
    name: 'Disability Pension Scheme',
    nameHindi: 'दिव्यांग पेंशन योजना',
    description: 'Monthly pension for persons with disabilities',
    descriptionHindi: 'दिव्यांग व्यक्तियों के लिए मासिक पेंशन',
    category: 'disability',
    level: 'state',
    department: 'Social Justice & Empowerment',
    departmentHindi: 'सामाजिक न्याय एवं अधिकारिता विभाग',
    benefits: { type: 'financial', amount: 1000, description: 'Rs 750-1500 per month', descriptionHindi: '₹750-1500 प्रति माह' },
    eligibility: { minAge: 18, gender: ['all'], categories: ['all'], mustBeDisabled: true, maxAnnualIncome: 60000 },
    documents: [
      { name: 'Disability Certificate', nameHindi: 'दिव्यांगता प्रमाण पत्र', mandatory: true },
      { name: 'Aadhaar Card', nameHindi: 'आधार कार्ड', mandatory: true },
      { name: 'Income Certificate', nameHindi: 'आय प्रमाण पत्र', mandatory: true },
    ],
    applicationProcess: { mode: ['online', 'emitra', 'offline'], officialLink: 'https://ssp.rajasthan.gov.in' },
    tags: ['disability', 'divyang', 'pension', 'दिव्यांग', 'विकलांग'],
    aiMetadata: { keywords: ['disability', 'divyang', 'handicapped', 'pension'], popularityScore: 78 },
  },
  {
    schemeId: 'RJ-VIDHWA-PENSION-008',
    name: 'Widow Pension Scheme',
    nameHindi: 'विधवा पेंशन योजना',
    description: 'Monthly pension for widows',
    descriptionHindi: 'विधवा महिलाओं के लिए मासिक पेंशन',
    category: 'women',
    level: 'state',
    department: 'Social Justice & Empowerment',
    departmentHindi: 'सामाजिक न्याय एवं अधिकारिता विभाग',
    benefits: { type: 'financial', amount: 1500, description: 'Rs 1500 per month', descriptionHindi: '₹1500 प्रति माह' },
    eligibility: { minAge: 18, gender: ['female'], categories: ['all'], mustBeWidow: true, maxAnnualIncome: 48000 },
    documents: [
      { name: 'Death Certificate of Husband', nameHindi: 'पति का मृत्यु प्रमाण पत्र', mandatory: true },
      { name: 'Aadhaar Card', nameHindi: 'आधार कार्ड', mandatory: true },
      { name: 'Income Certificate', nameHindi: 'आय प्रमाण पत्र', mandatory: true },
    ],
    applicationProcess: { mode: ['online', 'emitra', 'offline'], officialLink: 'https://ssp.rajasthan.gov.in' },
    tags: ['widow', 'vidhwa', 'pension', 'women', 'विधवा'],
    aiMetadata: { keywords: ['widow', 'vidhwa', 'women', 'pension'], popularityScore: 80 },
  },
  {
    schemeId: 'RJ-BETI-BACHAO-009',
    name: 'Beti Bachao Beti Padhao',
    nameHindi: 'बेटी बचाओ बेटी पढ़ाओ',
    description: 'Scheme for welfare and education of girl child',
    descriptionHindi: 'बालिका के कल्याण और शिक्षा के लिए योजना',
    category: 'women',
    level: 'central',
    department: 'Women & Child Development',
    departmentHindi: 'महिला एवं बाल विकास विभाग',
    benefits: { type: 'service', description: 'Education support, awareness programs', descriptionHindi: 'शिक्षा सहायता, जागरूकता कार्यक्रम' },
    eligibility: { gender: ['female'], categories: ['all'] },
    documents: [
      { name: 'Birth Certificate', nameHindi: 'जन्म प्रमाण पत्र', mandatory: true },
      { name: 'Aadhaar Card', nameHindi: 'आधार कार्ड', mandatory: true },
    ],
    applicationProcess: { mode: ['online', 'offline'], officialLink: 'https://wcd.nic.in' },
    tags: ['girl', 'education', 'beti', 'बेटी', 'महिला'],
    aiMetadata: { keywords: ['girl child', 'education', 'beti bachao', 'women empowerment'], popularityScore: 75 },
  },
  {
    schemeId: 'RJ-MUKHYAMANTRI-ROJGAR-010',
    name: 'Mukhyamantri Yuva Sambal Yojana',
    nameHindi: 'मुख्यमंत्री युवा संबल योजना',
    description: 'Unemployment allowance for educated youth',
    descriptionHindi: 'शिक्षित युवाओं के लिए बेरोजगारी भत्ता',
    category: 'employment',
    level: 'state',
    department: 'Employment Department',
    departmentHindi: 'रोजगार विभाग',
    benefits: { type: 'financial', amount: 4000, description: 'Rs 3000-4500 per month', descriptionHindi: '₹3000-4500 प्रति माह' },
    eligibility: { minAge: 21, maxAge: 35, gender: ['all'], categories: ['all'], education: 'graduate', maxAnnualIncome: 200000 },
    documents: [
      { name: 'Degree Certificate', nameHindi: 'डिग्री प्रमाण पत्र', mandatory: true },
      { name: 'Aadhaar Card', nameHindi: 'आधार कार्ड', mandatory: true },
      { name: 'Employment Registration', nameHindi: 'रोजगार पंजीकरण', mandatory: true },
    ],
    applicationProcess: { mode: ['online'], officialLink: 'https://employment.rajasthan.gov.in' },
    tags: ['employment', 'youth', 'unemployment', 'रोजगार', 'युवा'],
    aiMetadata: { keywords: ['employment', 'youth', 'unemployment allowance', 'job'], popularityScore: 87 },
  },
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    await Scheme.deleteMany({});
    await Citizen.deleteMany({ role: { $in: ['admin'] } });

    await Scheme.insertMany(SCHEMES);
    console.log(`✅ Seeded ${SCHEMES.length} schemes`);

    const adminPassword = await bcrypt.hash('Admin@123', 12);
    await Citizen.create({
      name: 'Admin User',
      phone: '9999999999',
      email: 'admin@rajasthan.gov.in',
      password: adminPassword,
      role: 'admin',
      isActive: true,
    });
    console.log('✅ Admin user created: phone=9999999999, password=Admin@123');

    const testPassword = await bcrypt.hash('Test@123', 12);
    await Citizen.create({
      name: 'Ramesh Kumar',
      phone: '9876543210',
      email: 'ramesh@example.com',
      password: testPassword,
      role: 'citizen',
      profile: {
        age: 45, gender: 'male', category: 'obc', annualIncome: 80000,
        occupation: 'farmer', education: 'secondary', district: 'Jaipur',
        isBPL: false, landOwnership: 1.5, familySize: 5,
      },
      profileCompleteness: 85,
    });
    console.log('✅ Test citizen created: phone=9876543210, password=Test@123');

    console.log('\n🎉 Database seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
};

seedDB();
