import { GovtScheme } from '../models/GovtScheme';
import { logger } from './logger';

export async function ensureSeededSchemes(force = false) {
    try {
        const count = await GovtScheme.countDocuments();
        if (count > 0 && !force) {
            return;
        }

        if (force) {
            await GovtScheme.deleteMany({});
            logger.info('Cleared existing schemes for fresh re-seeding...');
        }

        logger.info('Seeding 10 Real Government Schemes for Rajasthan & Central India...');

        const schemes = [
            {
                title: 'Rajasthan Crop Fencing Subsidy (राजस्थान फसल तारबंदी योजना)',
                slug: 'rajasthan-crop-fencing-subsidy',
                summary: 'किसानों को आवारा पशुओं से फसल सुरक्षा हेतु खेत के चारों ओर तारबंदी के लिए ५०% सब्सिडी दी जाती है।',
                description: 'इस योजना के अंतर्गत लघु एवं सीमांत किसानों को खेत की तारबंदी (fencing) के लिए ४०,००० रुपये या लागत का ५०% (जो भी कम हो) की आर्थिक सहायता दी जाती है। यह योजना नीलगाय और आवारा पशुओं से फसल की सुरक्षा करती है। आवेदन करने के लिए किसान के पास न्यूनतम ०.५ हेक्टेयर कृषि योग्य भूमि होनी चाहिए।',
                department: 'कृषि विभाग, राजस्थान सरकार',
                audience: 'राजस्थान के लघु एवं सीमांत किसान',
                benefits: [
                    'अधिकतम ४०,००० रुपये की सब्सिडी',
                    'तारबंदी की कुल लागत का ५०% वित्तीय अनुदान',
                    'फसलों की आवारा पशुओं से १००% सुरक्षा'
                ],
                eligibility: 'राजस्थान का मूल निवासी, न्यूनतम ०.५ हेक्टेयर कृषि भूमि, सालाना पारिवारिक आय ५ लाख से कम।',
                requiredDocuments: ['Aadhaar Card', 'Jan Aadhaar Card', 'Jamabandi (Land Record)', 'Bank Passbook'],
                requiredDocumentsList: ['आधार कार्ड', 'जन आधार कार्ड', 'जमाबंदी की नक़ल (६ महीने से पुरानी न हो)', 'बैंक पासबुक की कॉपी', 'खसरा गिरदावरी रिपोर्ट'],
                estimatedProcessingDays: 30,
                popularityScore: 95,
                eligibilityRules: {
                    minAge: 18,
                    maxAge: 80,
                    maxIncome: 500000,
                    genders: ['male', 'female', 'trans', 'any'],
                    occupations: ['farmer'],
                    categories: ['sc', 'st', 'obc', 'general', 'ews', 'any'],
                    states: ['Rajasthan']
                },
                schemeType: 'state' as const,
                state: 'Rajasthan',
                status: 'published' as const,
                source: 'admin' as const,
                publishedAt: new Date()
            },
            {
                title: 'Rajasthan Mahila Nidhi Loan (राजस्थान महिला निधि योजना)',
                slug: 'rajasthan-mahila-nidhi-loan',
                summary: 'महिला स्वयं सहायता समूहों (SHG) की सदस्यों को उद्यमिता और व्यवसाय शुरू करने हेतु तत्काल ऋण सहायता।',
                description: 'राजस्थान महिला निधि योजना राजीविका के माध्यम से स्वयं सहायता समूहों की महिलाओं को उनकी सामाजिक और आर्थिक उन्नति के लिए स्थापित की गई है। इसके अंतर्गत ४०,००० रुपये तक का ऋण ४८ घंटे के भीतर और बड़ी ऋण राशि १५ दिनों के भीतर सीधे महिला के बैंक खाते में ट्रांसफर की जाती है।',
                department: 'ग्रामीण विकास एवं पंचायती राज विभाग, राजस्थान सरकार',
                audience: 'महिलाएं, उद्यमी एवं स्वयं सहायता समूह (SHG) सदस्य',
                benefits: [
                    '४०,००० रुपये तक का तत्काल ऋण ४८ घंटे में स्वीकृत',
                    'बिना किसी गारंटी के आसान ऋण सुविधा',
                    'कम ब्याज दर और ४ साल तक की आसान किस्तों में भुगतान'
                ],
                eligibility: 'राजस्थान की महिला निवासी, स्वयं सहायता समूह (SHG) की सदस्य अथवा स्वरोजगार महिला, सालाना आय ५ लाख से कम।',
                requiredDocuments: ['Jan Aadhaar Card', 'Aadhaar Card', 'Bank Account Details'],
                requiredDocumentsList: ['जन आधार कार्ड', 'आधार कार्ड', 'बैंक पासबुक की कॉपी'],
                estimatedProcessingDays: 2,
                popularityScore: 92,
                eligibilityRules: {
                    minAge: 18,
                    maxAge: 65,
                    maxIncome: 500000,
                    genders: ['female'],
                    occupations: ['self-employed', 'unemployed', 'housewife', 'farmer', 'any'],
                    categories: ['sc', 'st', 'obc', 'general', 'ews', 'any'],
                    states: ['Rajasthan']
                },
                schemeType: 'state' as const,
                state: 'Rajasthan',
                status: 'published' as const,
                source: 'admin' as const,
                publishedAt: new Date()
            },
            {
                title: 'Rajiv Gandhi Krishak Sathi Sahayata (राजीव गांधी कृषक साथी सहायता योजना)',
                slug: 'rajiv-gandhi-krishak-sathi-sahayata',
                summary: 'कृषि कार्य या मजदूरी के दौरान दुर्घटना होने पर २ लाख रुपये तक की वित्तीय सहायता।',
                description: 'इस योजना के तहत कृषि या मंडी कार्य करते समय किसी दुर्घटना (जैसे अंग-भंग होना, सांप काटने या मृत्यु) की स्थिति में किसानों, खेतिहर मजदूरों और श्रमिकों को वित्तीय सुरक्षा प्रदान की जाती है। मृत्यु होने की स्थिति में आश्रितों को २ लाख रुपये तक की सहायता दी जाती है।',
                department: 'राजस्थान कृषि विपणन बोर्ड',
                audience: 'किसान एवं खेतिहर मजदूर',
                benefits: [
                    'दुर्घटना में मृत्यु होने पर आश्रितों को २ लाख रुपये की सहायता',
                    'अंग-भंग होने या गंभीर चोट पर ५,००० से ५०,००० रुपये की सहायता',
                    'अस्पताल के खर्चों की प्रतिपूर्ति'
                ],
                eligibility: 'आयु १५ से ७५ वर्ष के बीच, राजस्थान का निवासी, कृषि कार्य या मजदूरी के दौरान दुर्घटना।',
                requiredDocuments: ['Aadhaar Card', 'Jan Aadhaar Card', 'Medical Certificate'],
                requiredDocumentsList: ['आधार कार्ड', 'जन आधार कार्ड', 'मेडिकल रिपोर्ट या चोट का प्रमाण पत्र'],
                estimatedProcessingDays: 15,
                popularityScore: 88,
                eligibilityRules: {
                    minAge: 15,
                    maxAge: 75,
                    maxIncome: 500000,
                    genders: ['male', 'female', 'trans', 'any'],
                    occupations: ['farmer', 'agricultural-laborer'],
                    categories: ['sc', 'st', 'obc', 'general', 'ews', 'any'],
                    states: ['Rajasthan']
                },
                schemeType: 'state' as const,
                state: 'Rajasthan',
                status: 'published' as const,
                source: 'admin' as const,
                publishedAt: new Date()
            },
            {
                title: 'PM Kisan Samman Nidhi (पीएम किसान सम्मान निधि)',
                slug: 'pm-kisan-samman-nidhi',
                summary: 'सभी भूमिधारक किसान परिवारों को प्रति वर्ष ६,००० रुपये की प्रत्यक्ष आय सहायता।',
                description: 'प्रधान मंत्री किसान सम्मान निधि योजना के तहत सभी भूमिधारक किसान परिवारों को कृषि इनपुट की खरीद के लिए ६,००० रुपये की राशि २,००० रुपये की तीन समान किश्तों में सीधे लाभार्थियों के बैंक खातों में स्थानांतरित की जाती है।',
                department: 'कृषि एवं किसान कल्याण मंत्रालय, भारत सरकार',
                audience: 'सभी भूमिधारक किसान परिवार',
                benefits: [
                    'प्रति वर्ष ६,००० रुपये की प्रत्यक्ष वित्तीय सहायता',
                    '२,००० रुपये की तीन किश्तों में सीधे बैंक खाते में भुगतान'
                ],
                eligibility: 'कृषि योग्य भूमि रखने वाले किसान परिवार।',
                requiredDocuments: ['Aadhaar Card', 'Jamabandi', 'Bank Passbook'],
                requiredDocumentsList: ['आधार कार्ड', 'बैंक पासबुक', 'जमाबंदी दस्तावेज़'],
                estimatedProcessingDays: 45,
                popularityScore: 97,
                eligibilityRules: {
                    minAge: 18,
                    maxAge: 99,
                    maxIncome: 999999,
                    genders: ['male', 'female', 'trans', 'any'],
                    occupations: ['farmer'],
                    categories: ['sc', 'st', 'obc', 'general', 'ews', 'any'],
                    states: ['any']
                },
                schemeType: 'central' as const,
                state: '',
                status: 'published' as const,
                source: 'admin' as const,
                publishedAt: new Date()
            },
            {
                title: 'Mukhyamantri Anupriti Coaching Scheme (मुख्यमंत्री अनुप्रति कोचिंग योजना)',
                slug: 'mukhyamantri-anupriti-coaching-scheme',
                summary: 'प्रतिभावान छात्रों को प्रतियोगी परीक्षाओं की तैयारी हेतु मुफ़्त कोचिंग एवं आवास भत्ता।',
                description: 'राजस्थान सरकार द्वारा विभिन्न प्रतियोगी परीक्षाओं (UPSC, RPSC, REET, NEET, IIT-JEE, CA) की तैयारी के लिए मेधावी विद्यार्थियों को प्रतिष्ठित कोचिंग संस्थानों में नि:शुल्क कोचिंग तथा आवास/भोजन हेतु ४०,००० रुपये वार्षिक भत्ता प्रदान किया जाता है।',
                department: 'सामाजिक न्याय एवं अधिकारिता विभाग, राजस्थान',
                audience: 'राजस्थान के मेधावी छात्र एवं विद्यार्थी',
                benefits: [
                    'प्रतिष्ठित संस्थानों में नि:शुल्क कोचिंग',
                    'आवास एवं भोजन हेतु ४०,००० रुपये वार्षिक भत्ता'
                ],
                eligibility: 'राजस्थान का मूल निवासी, छात्र श्रेणी, १०वीं/१२वीं में अच्छे अंक, पारिवारिक वार्षिक आय ८ लाख से कम।',
                requiredDocuments: ['Aadhaar Card', 'Jan Aadhaar Card', 'Marksheet', 'Income Certificate'],
                requiredDocumentsList: ['आधार कार्ड', 'जन आधार कार्ड', '१०वीं/१२वीं अंकतालिका', 'आय प्रमाण पत्र'],
                estimatedProcessingDays: 20,
                popularityScore: 94,
                eligibilityRules: {
                    minAge: 15,
                    maxAge: 30,
                    maxIncome: 800000,
                    genders: ['male', 'female', 'trans', 'any'],
                    occupations: ['student'],
                    categories: ['sc', 'st', 'obc', 'general', 'ews', 'any'],
                    states: ['Rajasthan']
                },
                schemeType: 'state' as const,
                state: 'Rajasthan',
                status: 'published' as const,
                source: 'admin' as const,
                publishedAt: new Date()
            },
            {
                title: 'Mukhyamantri Yuva Sambal Yojana (मुख्यमंत्री युवा संबल योजना)',
                slug: 'mukhyamantri-yuva-sambal-yojana',
                summary: 'शिक्षित बेरोजगार युवाओं को प्रति माह ४,५०० रुपये तक का बेरोजगारी भत्ता।',
                description: 'राजस्थान के स्नातक पास बेरोजगार युवाओं को संबल प्रदान करने हेतु पुरुषों को ४,००० रुपये तथा महिलाओं, दिव्यांगों व ट्रांसजेंडर को ४,५०० रुपये प्रति माह का बेरोजगारी भत्ता दिया जाता है। इसके साथ राजकीय विभागों में इंटरनशिप का अवसर मिलता है।',
                department: 'कौशल, नियोजन एवं उद्यमिता विभाग, राजस्थान',
                audience: 'राजस्थान के स्नातक उत्तीर्ण बेरोजगार युवा',
                benefits: [
                    'महिलाओं/दिव्यांगों को ४,५०० रुपये प्रति माह',
                    'पुरुषों को ४,००० रुपये प्रति माह',
                    'अधिकतम २ वर्ष तक भत्ता'
                ],
                eligibility: 'राजस्थान का मूल निवासी, स्नातक (Graduate) उत्तीर्ण, आयु २१ से ३५ वर्ष, सालाना आय २ लाख से कम, बेरोजगार।',
                requiredDocuments: ['Jan Aadhaar Card', 'Graduation Degree', 'Unemployment Declaration'],
                requiredDocumentsList: ['जन आधार कार्ड', 'स्नातक डिग्री मार्कशीट', 'बेरोजगारी स्व-घोषणा पत्र'],
                estimatedProcessingDays: 30,
                popularityScore: 91,
                eligibilityRules: {
                    minAge: 21,
                    maxAge: 35,
                    maxIncome: 200000,
                    genders: ['male', 'female', 'trans', 'any'],
                    occupations: ['unemployed', 'student'],
                    categories: ['sc', 'st', 'obc', 'general', 'ews', 'any'],
                    states: ['Rajasthan']
                },
                schemeType: 'state' as const,
                state: 'Rajasthan',
                status: 'published' as const,
                source: 'admin' as const,
                publishedAt: new Date()
            },
            {
                title: 'PM Vishwakarma Yojana (पीएम विश्वकर्मा योजना)',
                slug: 'pm-vishwakarma-yojana',
                summary: 'पारंपरिक कारीगरों और हस्तशिल्पियों को ३ लाख रुपये तक का ब्याजमुक्त ऋण और टूलकिट।',
                description: 'प्रधान मंत्री विश्वकर्मा योजना के अंतर्गत १८ पारंपरिक व्यवसायों (जैसे सुतार, लोहार, दर्जी, कुम्हार, राजमिस्त्री आदि) से जुड़े कारीगरों को बिना किसी गारंटी के ५% ब्याज दर पर ३ लाख रुपये तक का ऋण और १५,००० रुपये का टूलकिट वाउचर दिया जाता है।',
                department: 'सूक्ष्म, लघु और मध्यम उद्यम मंत्रालय, भारत सरकार',
                audience: 'पारंपरिक कारीगर, हस्तशिल्पी एवं श्रमिक',
                benefits: [
                    '१५,००० रुपये का नि:शुल्क टूलकिट वाउचर',
                    '३ लाख रुपये तक का आसान ऋण (५% ब्याज)',
                    'प्रतिदिन ५०० रुपये वजीफे के साथ मुफ़्त ट्रेनिंग'
                ],
                eligibility: 'आयु १८ वर्ष से अधिक, १८ पारंपरिक विश्वकर्मा व्यवसायों में से किसी एक में कार्यरत कारीगर।',
                requiredDocuments: ['Aadhaar Card', 'Bank Passbook', 'Skill Certificate'],
                requiredDocumentsList: ['आधार कार्ड', 'बैंक पासबुक', 'कारीगर व्यवसाय प्रमाण'],
                estimatedProcessingDays: 15,
                popularityScore: 93,
                eligibilityRules: {
                    minAge: 18,
                    maxAge: 70,
                    maxIncome: 500000,
                    genders: ['male', 'female', 'trans', 'any'],
                    occupations: ['artisan', 'self-employed', 'agricultural-laborer'],
                    categories: ['sc', 'st', 'obc', 'general', 'ews', 'any'],
                    states: ['any']
                },
                schemeType: 'central' as const,
                state: '',
                status: 'published' as const,
                source: 'admin' as const,
                publishedAt: new Date()
            },
            {
                title: 'PM SVANidhi Scheme (पीएम स्वनिधि योजना)',
                slug: 'pm-svanidhi-scheme',
                summary: 'रेहड़ी-पटरी वालों और छोटे विक्रेताओं को ५०,००० रुपये तक का बिना गारंटी कार्यशील पूंजी ऋण।',
                description: 'प्रधानमंत्री स्ट्रीट वेंडर्स आत्मनिर्भर निधि योजना के तहत सड़क विक्रेताओं, रेहड़ी-पटरी वालों और छोटे व्यापार शुरू करने वाले व्यक्तियों को पहली बार १०,००० रुपये, दूसरी बार २०,००० रुपये तथा तीसरी बार ५०,००० रुपये का बिना गारंटी ऋण दिया जाता है।',
                department: 'आवास और शहरी कार्य मंत्रालय, भारत सरकार',
                audience: 'छोटे व्यापारी, रेहड़ी-पटरी विक्रेता एवं स्वरोजगार',
                benefits: [
                    '५०,००० रुपये तक का बिना गारंटी ऋण',
                    'समय पर भुगतान पर ७% की ब्याज सब्सिडी',
                    'डिजिटल लेनदेन पर कैशबैक प्रोत्साहन'
                ],
                eligibility: 'शहरी/ग्रामीण क्षेत्र के रेहड़ी-पटरी विक्रेता या छोटे व्यवसायी, आयु १८ से ६५ वर्ष।',
                requiredDocuments: ['Aadhaar Card', 'Vending Certificate', 'Bank Passbook'],
                requiredDocumentsList: ['आधार कार्ड', 'बैंक पासबुक', 'विक्रेता पहचान पत्र या स्थानीय अनुशंसा पत्र'],
                estimatedProcessingDays: 7,
                popularityScore: 89,
                eligibilityRules: {
                    minAge: 18,
                    maxAge: 65,
                    maxIncome: 500000,
                    genders: ['male', 'female', 'trans', 'any'],
                    occupations: ['self-employed', 'artisan', 'unemployed'],
                    categories: ['sc', 'st', 'obc', 'general', 'ews', 'any'],
                    states: ['any']
                },
                schemeType: 'central' as const,
                state: '',
                status: 'published' as const,
                source: 'admin' as const,
                publishedAt: new Date()
            },
            {
                title: 'Indira Gandhi Urban Employment Guarantee (इंदिरा गांधी शहरी रोजगार गारंटी)',
                slug: 'indira-gandhi-urban-employment-guarantee',
                summary: 'शहरी क्षेत्रों के परिवारों को प्रति वर्ष १२५ दिन के रोजगार की गारंटी।',
                description: 'राजस्थान के शहरी निकायों में रहने वाले परिवारों को प्रति वर्ष १२५ दिन का गारंटीकृत मजदूरी रोजगार प्रदान किया जाता है। मनरेगा की तर्ज पर शुरू की गई इस योजना से अकुशल और कुशल श्रमिकों को अपने ही शहर में रोजगार मिलता है।',
                department: 'स्वायत्त शासन विभाग, राजस्थान सरकार',
                audience: 'राजस्थान के शहरी श्रमिक, मजदूर एवं परिवार',
                benefits: [
                    'प्रति वर्ष १२५ दिन का गारंटीकृत रोजगार',
                    'पाक्षिक सीधी मजदूरी बैंक खाते में जमा',
                    'अपने ही शहर में कार्य का अवसर'
                ],
                eligibility: 'राजस्थान के नगरीय निकाय क्षेत्र का निवासी, आयु १८ से ६० वर्ष, जन-आधार कार्ड धारक।',
                requiredDocuments: ['Jan Aadhaar Card', 'Bank Passbook'],
                requiredDocumentsList: ['जन आधार कार्ड', 'बैंक पासबुक की प्रति'],
                estimatedProcessingDays: 7,
                popularityScore: 87,
                eligibilityRules: {
                    minAge: 18,
                    maxAge: 60,
                    maxIncome: 300000,
                    genders: ['male', 'female', 'trans', 'any'],
                    occupations: ['agricultural-laborer', 'unemployed', 'housewife'],
                    categories: ['sc', 'st', 'obc', 'general', 'ews', 'any'],
                    states: ['Rajasthan']
                },
                schemeType: 'state' as const,
                state: 'Rajasthan',
                status: 'published' as const,
                source: 'admin' as const,
                publishedAt: new Date()
            },
            {
                title: 'PM Kusum Solar Agriculture Pump Subsidy (पीएम कुसुम सोलर पंप योजना)',
                slug: 'pm-kusum-solar-agriculture-pump-subsidy',
                summary: 'किसानों को सोलर सिंचाई पंप लगाने हेतु ६०% तक की भारी सब्सिडी।',
                description: 'पीएम कुसुम योजना के तहत किसानों को अपने खेतों में सौर ऊर्जा संचालित सिंचाई पंप लगाने हेतु केंद्र और राज्य सरकार द्वारा ६०% सब्सिडी तथा ३०% बैंक ऋण प्रदान किया जाता है। किसान केवल १०% लागत देकर सोलर पंप स्थापित कर सकते हैं और बची हुई बिजली ग्रिड को बेचकर अतिरिक्त आय भी कमा सकते हैं।',
                department: 'नवीन एवं नवीकरणीय ऊर्जा मंत्रालय / राजस्थान ऊर्जा विभाग',
                audience: 'राजस्थान व भारत के किसान',
                benefits: [
                    'कुल लागत पर ६०% सब्सिडी अनुदान',
                    'दिन के समय निर्बाध सिंचाई की सुविधा',
                    'अतिरिक्त बिजली बेचकर सालाना कमाई'
                ],
                eligibility: 'राजस्थान/भारत का कृषक, सिंचाई हेतु कृषि भूमि का स्वामित्व, बिजली कनेक्शन रहित या डीजल पंप उपयोगकर्ता।',
                requiredDocuments: ['Aadhaar Card', 'Jan Aadhaar Card', 'Jamabandi', 'Electricity Bill NOC'],
                requiredDocumentsList: ['आधार कार्ड', 'जन आधार कार्ड', 'जमाबंदी/भूमि दस्तावेज़', 'बैंक पासबुक'],
                estimatedProcessingDays: 45,
                popularityScore: 96,
                eligibilityRules: {
                    minAge: 18,
                    maxAge: 80,
                    maxIncome: 800000,
                    genders: ['male', 'female', 'trans', 'any'],
                    occupations: ['farmer'],
                    categories: ['sc', 'st', 'obc', 'general', 'ews', 'any'],
                    states: ['any']
                },
                schemeType: 'central' as const,
                state: '',
                status: 'published' as const,
                source: 'admin' as const,
                publishedAt: new Date()
            }
        ];

        await GovtScheme.insertMany(schemes);
        logger.info(`Successfully seeded ${schemes.length} real government schemes.`);
    } catch (err: any) {
        logger.error('Failed to seed schemes:', err);
    }
}
