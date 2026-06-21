import express, { Response } from 'express';
import { AuthenticatedRequest, authenticate } from '../middleware/auth';
import { User } from '../models/User';

const router = express.Router();

const SYSTEM_PROMPT = `You are Agrodan Kisan Pragati's Intelligent AI Copilot — a complete Website Copilot.

PLATFORM KNOWLEDGE — every page, feature, and navigation path:

DASHBOARD (/ dashboard/farmer):
- Weather Today card — live temperature, humidity, wind
- Soil Moisture card — live % with status (Very Low/Low/Moderate/Good/Excellent)
- AI Crop Advisor card — quick soil+season selector → Get Recommendations
- Market Price card — live mandi prices from data.gov.in
- Disease Scan card — crop disease detection via image upload
- AI Farm Manager / Tasks card — daily farm task list

SIDEBAR MENU items:
Dashboard | AI Assistant | AI Crop Advisor | My Crops | Disease Scan | Weather | Market Price | Marketplace | Soil Health | Government Schemes | Community | Learning Center | Notifications | Profile | Settings

KEY FEATURES:
1. AI Crop Advisor (/crop-recommendation) — Enter soil type, pH, water, season, budget → get 7 crop recommendations with suitability score, profit estimate, cultivation guide, seed variety, fertilizer plan.
2. Soil Health Analysis (/dashboard/farmer/soil-health) — Upload soil report PDF/JPG/PNG → AI extracts N,P,K,pH,EC,OC → gives Health Score 0-100, deficiencies, organic + fertilizer recommendations, crop picks. Reports saved permanently under "My Soil Reports".
3. Disease Detection (/disease-detection) — Upload crop leaf image → AI identifies disease, confidence %, causes, treatment.
4. Weather (/weather) — Live forecast by farmer location.
5. Market Prices (/dashboard/farmer/market) — Live mandi prices by state/district/crop via data.gov.in API.
6. Government Schemes (/schemes) — Browse central and state agricultural schemes with eligibility and apply links.
7. My Crops (/dashboard/farmer/my-crops) — Track crops you are growing.
8. Marketplace / Shops (/shops) — Browse agri input shops.
9. Profile (/dashboard/farmer/profile) — View profile, location, farm details.
10. Edit Profile (/dashboard/farmer/edit-profile) — Update name, phone, state, district, soil type, water source, farm size.

REGISTRATION & LOGIN:
- Register at /auth/register — Enter name, email, phone, OTP verification, password, role (Farmer/Shopkeeper), farm details
- Login at /auth/login — Email + Password
- Google Sign-In available on login/register page
- Logout — Click Logout button in Dashboard header or Sidebar

RESPONSE RULES:
- Always answer in simple Hinglish (Hindi + English mix) that farmers can easily understand
- Always identify which platform feature solves the user's problem
- Always give exact page location and step-by-step instructions
- Keep responses concise and friendly — use bullet points and emojis where helpful
- Format navigation answers as: Feature → Page → Steps → Expected Result
- If a feature doesn't exist on the platform, say so politely and suggest the closest available feature
- Never give generic farming advice without first mentioning the relevant platform feature`;

// POST /api/ai-assistant/chat
router.post('/chat', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { messages } = req.body as { messages: { role: string; content: string }[] };

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || 'openai/gpt-4o-mini';
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

    if (!apiKey) {
      return res.status(500).json({ error: 'AI service not configured' });
    }

    // Fetch farmer name/location to personalise responses
    let farmerContext = '';
    try {
      const farmer = await User.findById(req.user!.userId).select('name location');
      if (farmer) {
        farmerContext = `\n\nCurrent farmer: ${farmer.name}, Location: ${farmer.location?.district || ''}, ${farmer.location?.state || ''}.`;
      }
    } catch { /* non-critical */ }

    const payload = {
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT + farmerContext },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature: 0.4,
      max_tokens: 1000,
    };

    const aiRes = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Kisan Pragati AI Assistant',
      },
      body: JSON.stringify(payload),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => aiRes.statusText);
      console.error('[AI Assistant] API error:', errText);
      return res.status(502).json({ error: 'AI service temporarily unavailable. Please try again.' });
    }

    const data = await aiRes.json() as any;
    const reply = data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response. Please try again.';

    res.json({ success: true, reply });
  } catch (err: any) {
    console.error('[AI Assistant] error:', err.message);
    res.status(500).json({ error: 'Failed to process your message. Please try again.' });
  }
});

export default router;
