"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const User_1 = require("../models/User");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
const emailOtpStore = new Map();
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const safeUser = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    verified: user.verified,
});
const normalizeRole = (role) => {
    return role === 'shopkeeper' || role === 'vendor' ? 'vendor' : 'farmer';
};
const buildLocation = (location) => {
    if (location && typeof location === 'object') {
        const typedLocation = location;
        return {
            state: String(typedLocation.state || typedLocation.location || 'Unknown'),
            district: String(typedLocation.district || 'Unknown'),
            coordinates: {
                latitude: Number(typedLocation?.coordinates?.latitude ?? 0),
                longitude: Number(typedLocation?.coordinates?.longitude ?? 0),
            },
        };
    }
    if (typeof location === 'string' && location.trim()) {
        return {
            state: location.trim(),
            district: 'Unknown',
            coordinates: { latitude: 0, longitude: 0 },
        };
    }
    return {
        state: 'Unknown',
        district: 'Unknown',
        coordinates: { latitude: 0, longitude: 0 },
    };
};
const getOtpRecord = (email) => {
    const record = emailOtpStore.get(email);
    if (!record) {
        return null;
    }
    if (record.expiresAt < Date.now()) {
        emailOtpStore.delete(email);
        return null;
    }
    return record;
};
const hasVerifiedEmail = (email) => {
    const record = getOtpRecord(email);
    return !!record?.verifiedAt;
};
const getEmailTransport = () => {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) {
        return null;
    }
    return nodemailer_1.default.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
    });
};
const sendOtpEmail = async (email, code) => {
    const transport = getEmailTransport();
    if (!transport) {
        console.log(`[auth] OTP for ${email}: ${code}`);
        return { delivered: false, devOtp: code };
    }
    await transport.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: 'Your Kisan Unnati verification code',
        text: `Your verification code is ${code}. It expires in 10 minutes.`,
        html: `<p>Your verification code is <strong>${code}</strong>.</p><p>This code expires in 10 minutes.</p>`,
    });
    return { delivered: true };
};
router.post('/register/request-otp', async (req, res) => {
    try {
        let { email } = req.body;
        if (typeof email !== 'string' || !email.trim()) {
            return res.status(400).json({ error: 'Email is required' });
        }
        email = email.trim().toLowerCase();
        const existingUser = await User_1.User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        const code = crypto_1.default.randomInt(100000, 999999).toString();
        emailOtpStore.set(email, {
            code,
            expiresAt: Date.now() + OTP_TTL_MS,
            attempts: 0,
        });
        const delivery = await sendOtpEmail(email, code);
        res.json({
            message: 'OTP sent successfully',
            delivered: delivery.delivered,
            devOtp: delivery.devOtp,
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});
router.post('/register/verify-otp', async (req, res) => {
    try {
        let { email, otp } = req.body;
        if (typeof email !== 'string' || !email.trim()) {
            return res.status(400).json({ error: 'Email is required' });
        }
        if (typeof otp !== 'string' || !otp.trim()) {
            return res.status(400).json({ error: 'OTP is required' });
        }
        email = email.trim().toLowerCase();
        otp = otp.trim();
        const record = getOtpRecord(email);
        if (!record) {
            return res.status(400).json({ error: 'OTP expired. Please request a new code.' });
        }
        if (record.attempts >= OTP_MAX_ATTEMPTS) {
            emailOtpStore.delete(email);
            return res.status(429).json({ error: 'Too many OTP attempts. Please request a new code.' });
        }
        record.attempts += 1;
        if (record.code !== otp) {
            emailOtpStore.set(email, record);
            return res.status(400).json({ error: 'Invalid OTP' });
        }
        record.verifiedAt = Date.now();
        emailOtpStore.set(email, record);
        res.json({
            message: 'Email verified successfully',
            verified: true,
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to verify OTP' });
    }
});
router.post('/register', async (req, res) => {
    try {
        let { name, email, password, role, companyName, shopName, businessType, googleId, authProvider, phone, farmSize, location, soilType, waterSource, } = req.body;
        if (typeof email === 'string')
            email = email.trim().toLowerCase();
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }
        const normalizedRole = normalizeRole(role);
        const isGoogleAuth = authProvider === 'google';
        if (normalizedRole === 'vendor' && !companyName && !shopName) {
            return res.status(400).json({ error: 'Shop name is required for shopkeeper registration' });
        }
        if (!isGoogleAuth && !hasVerifiedEmail(email)) {
            return res.status(400).json({ error: 'Please verify your email with OTP before registering' });
        }
        const existingUser = await User_1.User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const user = new User_1.User({
            name,
            email,
            phone: phone || '',
            password: hashedPassword,
            farmSize: Number.isFinite(Number(farmSize)) ? Number(farmSize) : 0,
            companyName: companyName || shopName || '',
            businessType,
            location: buildLocation(location),
            soilType,
            waterSource,
            googleId,
            authProvider: isGoogleAuth ? 'google' : 'local',
            role: normalizedRole,
            verified: true,
        });
        await user.save();
        emailOtpStore.delete(email);
        const token = jsonwebtoken_1.default.sign({ userId: user._id }, process.env.JWT_SECRET || 'secret', {
            expiresIn: '30d',
        });
        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: safeUser(user),
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Registration failed' });
    }
});
router.post('/login', async (req, res) => {
    try {
        let { email, password } = req.body;
        if (typeof email === 'string')
            email = email.trim().toLowerCase();
        const user = await User_1.User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        if (!user.verified) {
            return res.status(403).json({ error: 'Please verify your email before signing in' });
        }
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        user.lastLogin = new Date();
        await user.save();
        const token = jsonwebtoken_1.default.sign({ userId: user._id }, process.env.JWT_SECRET || 'secret', {
            expiresIn: '30d',
        });
        res.json({
            message: 'Login successful',
            token,
            user: safeUser(user),
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});
router.get('/me', auth_1.authenticate, async (req, res) => {
    try {
        const user = await User_1.User.findById(req.user?.userId).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            success: true,
            data: user,
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch current user' });
    }
});
router.get('/google', (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/google/callback`;
    const role = req.query.role || 'farmer';
    const state = Buffer.from(JSON.stringify({ role })).toString('base64');
    const params = new URLSearchParams({
        client_id: clientId || '',
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'consent',
        state,
    });
    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    res.redirect(url);
});
router.get('/google/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        const parsedState = state ? JSON.parse(Buffer.from(state, 'base64').toString()) : { role: 'farmer' };
        const role = parsedState.role || 'farmer';
        const tokenRes = await axios_1.default.post('https://oauth2.googleapis.com/token', new URLSearchParams({
            code: code,
            client_id: process.env.GOOGLE_CLIENT_ID || '',
            client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
            redirect_uri: process.env.GOOGLE_REDIRECT_URI || `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/google/callback`,
            grant_type: 'authorization_code',
        }).toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        const userInfoRes = await axios_1.default.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
        });
        const profile = userInfoRes.data;
        const email = (profile.email || '').toLowerCase();
        let user = await User_1.User.findOne({ email });
        if (!user) {
            user = new User_1.User({
                name: profile.name || profile.email,
                email,
                phone: profile.phone_number || '',
                password: await bcryptjs_1.default.hash(crypto_1.default.randomBytes(18).toString('hex'), 10),
                farmSize: 0,
                location: {
                    state: 'Unknown',
                    district: 'Unknown',
                    coordinates: { latitude: 0, longitude: 0 },
                },
                role: role === 'shopkeeper' ? 'vendor' : 'farmer',
                verified: true,
                authProvider: 'google',
                googleId: profile.sub || profile.id,
            });
            await user.save();
        }
        else {
            if (!user.googleId) {
                user.googleId = profile.sub || profile.id;
            }
            user.verified = true;
            user.authProvider = 'google';
            user.role = role === 'shopkeeper' ? 'vendor' : 'farmer';
            user.lastLogin = new Date();
            await user.save();
        }
        const token = jsonwebtoken_1.default.sign({ userId: user._id }, process.env.JWT_SECRET || 'secret', {
            expiresIn: '30d',
        });
        const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
        const redirectRole = role === 'shopkeeper' ? 'shopkeeper' : 'farmer';
        const redirectUrl = `${frontend}/auth/oauth-redirect?token=${token}&role=${redirectRole}`;
        res.redirect(redirectUrl);
    }
    catch (err) {
        console.error('Google callback error', err);
        res.status(500).send('Google sign-in failed');
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map