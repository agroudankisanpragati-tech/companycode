/**
 * AI Eligibility Intelligence Engine
 * Hybrid Rule-Based + Scoring System with Explainability
 */

class EligibilityEngine {
  /**
   * Evaluate citizen eligibility for a scheme
   * Returns score, reasons, confidence, and priority
   */
  evaluate(citizen, scheme) {
    const profile = citizen.profile || {};
    const rules = scheme.eligibility || {};
    const checks = [];
    let totalWeight = 0;
    let earnedWeight = 0;

    // Age Check
    if (rules.minAge || rules.maxAge) {
      const weight = 15;
      totalWeight += weight;
      const age = profile.age;
      const minOk = !rules.minAge || age >= rules.minAge;
      const maxOk = !rules.maxAge || age <= rules.maxAge;
      if (minOk && maxOk) {
        earnedWeight += weight;
        checks.push({ rule: 'age', passed: true, message: `आयु ${age} वर्ष - पात्र`, messageEn: `Age ${age} years - eligible` });
      } else {
        checks.push({
          rule: 'age', passed: false,
          message: `आयु ${age} वर्ष - आवश्यक ${rules.minAge || 0}-${rules.maxAge || '∞'} वर्ष`,
          messageEn: `Age ${age} - required ${rules.minAge || 0}-${rules.maxAge || '∞'}`,
        });
      }
    }

    // Gender Check
    if (rules.gender && rules.gender.length > 0 && !rules.gender.includes('all')) {
      const weight = 20;
      totalWeight += weight;
      if (rules.gender.includes(profile.gender)) {
        earnedWeight += weight;
        checks.push({ rule: 'gender', passed: true, message: 'लिंग - पात्र', messageEn: 'Gender - eligible' });
      } else {
        checks.push({ rule: 'gender', passed: false, message: `यह योजना ${rules.gender.join('/')} के लिए है`, messageEn: `Scheme for ${rules.gender.join('/')} only` });
      }
    }

    // Category Check
    if (rules.categories && rules.categories.length > 0 && !rules.categories.includes('all')) {
      const weight = 20;
      totalWeight += weight;
      if (rules.categories.includes(profile.category)) {
        earnedWeight += weight;
        checks.push({ rule: 'category', passed: true, message: `श्रेणी ${profile.category?.toUpperCase()} - पात्र`, messageEn: `Category ${profile.category?.toUpperCase()} - eligible` });
      } else {
        checks.push({ rule: 'category', passed: false, message: `श्रेणी ${profile.category} - इस योजना के लिए पात्र नहीं`, messageEn: `Category ${profile.category} not eligible` });
      }
    }

    // Income Check
    if (rules.maxAnnualIncome) {
      const weight = 20;
      totalWeight += weight;
      if (!profile.annualIncome || profile.annualIncome <= rules.maxAnnualIncome) {
        earnedWeight += weight;
        checks.push({ rule: 'income', passed: true, message: `वार्षिक आय ₹${profile.annualIncome?.toLocaleString('en-IN') || 'N/A'} - पात्र`, messageEn: `Annual income eligible` });
      } else {
        checks.push({ rule: 'income', passed: false, message: `वार्षिक आय ₹${profile.annualIncome?.toLocaleString('en-IN')} - सीमा ₹${rules.maxAnnualIncome?.toLocaleString('en-IN')} से अधिक`, messageEn: `Income exceeds limit` });
      }
    }

    // Occupation Check
    if (rules.occupations && rules.occupations.length > 0) {
      const weight = 10;
      totalWeight += weight;
      if (rules.occupations.includes(profile.occupation)) {
        earnedWeight += weight;
        checks.push({ rule: 'occupation', passed: true, message: `व्यवसाय - पात्र`, messageEn: 'Occupation - eligible' });
      } else {
        checks.push({ rule: 'occupation', passed: false, message: `व्यवसाय ${profile.occupation} - पात्र नहीं`, messageEn: `Occupation not eligible` });
      }
    }

    // Special Conditions
    const specialChecks = [
      { rule: 'mustBeDisabled', profileKey: 'isDisabled', weight: 15, labelHi: 'दिव्यांग', labelEn: 'Disability' },
      { rule: 'mustBeStudent', profileKey: 'isStudent', weight: 10, labelHi: 'छात्र', labelEn: 'Student' },
      { rule: 'mustBeBPL', profileKey: 'isBPL', weight: 15, labelHi: 'BPL', labelEn: 'BPL' },
      { rule: 'mustBeWidow', profileKey: 'isWidow', weight: 15, labelHi: 'विधवा', labelEn: 'Widow' },
      { rule: 'mustBeFarmer', profileKey: null, weight: 10, labelHi: 'किसान', labelEn: 'Farmer' },
    ];

    specialChecks.forEach(({ rule, profileKey, weight, labelHi, labelEn }) => {
      if (rules[rule]) {
        totalWeight += weight;
        const val = profileKey ? profile[profileKey] : profile.occupation === 'farmer';
        if (val) {
          earnedWeight += weight;
          checks.push({ rule, passed: true, message: `${labelHi} - पात्र`, messageEn: `${labelEn} - eligible` });
        } else {
          checks.push({ rule, passed: false, message: `${labelHi} होना आवश्यक है`, messageEn: `Must be ${labelEn}` });
        }
      }
    });

    // District Check
    if (rules.districts && rules.districts.length > 0) {
      const weight = 5;
      totalWeight += weight;
      if (rules.districts.includes(profile.district)) {
        earnedWeight += weight;
        checks.push({ rule: 'district', passed: true, message: `जिला ${profile.district} - पात्र`, messageEn: `District eligible` });
      } else {
        checks.push({ rule: 'district', passed: false, message: `जिला ${profile.district} इस योजना में शामिल नहीं`, messageEn: `District not covered` });
      }
    }

    const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 75;
    const failedChecks = checks.filter(c => !c.passed);
    const passedChecks = checks.filter(c => c.passed);
    const isEligible = failedChecks.length === 0 && score >= 60;
    const confidence = this._calculateConfidence(checks, totalWeight);
    const priority = this._calculatePriority(score, scheme);

    return {
      schemeId: scheme._id,
      schemeName: scheme.name,
      schemeNameHindi: scheme.nameHindi,
      isEligible,
      score,
      confidence,
      priority,
      passedChecks,
      failedChecks,
      allChecks: checks,
      summary: this._generateSummary(isEligible, score, failedChecks, scheme),
      recommendation: this._generateRecommendation(isEligible, score, failedChecks),
    };
  }

  /**
   * Batch evaluate citizen against multiple schemes
   */
  evaluateAll(citizen, schemes) {
    const results = schemes.map(scheme => this.evaluate(citizen, scheme));
    return results
      .sort((a, b) => b.score - a.score)
      .map((r, idx) => ({ ...r, rank: idx + 1 }));
  }

  _calculateConfidence(checks, totalWeight) {
    if (totalWeight === 0) return 'medium';
    const coverage = checks.length / Math.max(checks.length, 5);
    if (coverage >= 0.8) return 'high';
    if (coverage >= 0.5) return 'medium';
    return 'low';
  }

  _calculatePriority(score, scheme) {
    if (score >= 90) return 'critical';
    if (score >= 75) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }

  _generateSummary(isEligible, score, failedChecks, scheme) {
    if (isEligible) {
      return {
        hi: `आप "${scheme.nameHindi}" योजना के लिए ${score}% पात्र हैं। अभी आवेदन करें!`,
        en: `You are ${score}% eligible for "${scheme.name}". Apply now!`,
      };
    }
    const reasons = failedChecks.slice(0, 2).map(c => c.message).join(', ');
    return {
      hi: `आप इस योजना के लिए पूरी तरह पात्र नहीं हैं। कारण: ${reasons}`,
      en: `Not fully eligible. Reasons: ${failedChecks.slice(0, 2).map(c => c.messageEn).join(', ')}`,
    };
  }

  _generateRecommendation(isEligible, score, failedChecks) {
    if (isEligible) return { hi: 'तुरंत आवेदन करें', en: 'Apply immediately', action: 'apply' };
    if (score >= 60) return { hi: 'कुछ दस्तावेज़ अपडेट करें और पुनः प्रयास करें', en: 'Update documents and retry', action: 'update_profile' };
    return { hi: 'अन्य योजनाएं देखें', en: 'Explore other schemes', action: 'explore' };
  }
}

module.exports = new EligibilityEngine();
