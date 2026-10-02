# COMPANYCODE — AUTHENTICATION / LOGIN TRACE
## Forensic Analysis — Phase 1 Only — No Code Modification

---

## 1. LOGIN FLOW COMPLETE TRACE

### 1.1 Frontend Login Screen
**File**: `frontend/src/context/AuthContext.tsx`
**Function**: `login(email, password, preferredRole)`
**Line**: 220-245

```
1. Frontend calls fetch(`${apiBase}/auth/login`, { method: 'POST', ... })
2. Request body: { email, password, role: toBackendRole(preferredRole) }
3. On success:
   - Stores token in localStorage as 'authToken'
   - Stores user in localStorage as 'user'
   - Updates React state (user, role)
   - Dispatches 'auth-session-changed' event
```

### 1.2 Backend Login Route
**File**: `backend/src/routes/auth.ts`
**Function**: `router.post('/login', ...)`
**Line**: 281-317

```
1. Receives { email, password, role }
2. Normalizes email: trim().toLowerCase()
3. Normalizes role via normalizeRole()
4. Queries MongoDB: User.findOne({ email, role: normalizedRole })
5. If user not found → 401 { error: 'Invalid credentials' }
6. If user.verified === false → 403 { error: 'Please verify your email before signing in' }
7. Compares password: bcrypt.compare(password, user.password)
8. If invalid → 401 { error: 'Invalid credentials' }
9. Updates user.lastLogin = new Date()
10. Saves user
11. Creates JWT: jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' })
12. Returns { message: 'Login successful', token, user: safeUser(user) }
```

### 1.3 Authentication Middleware
**File**: `backend/src/middleware/auth.ts`
**Function**: `authenticate(req, res, next)`
**Line**: 26-50

```
1. Extracts token from Authorization header: "Bearer <token>"
2. Verifies JWT: jwt.verify(token, JWT_SECRET)
3. Queries MongoDB: User.findById(payload.userId).select('-password')
4. If user not found → 401 { error: 'Unauthorized' }
5. Attaches req.user = { userId, role }
6. Calls next()
```

### 1.4 Profile Request
**File**: `backend/src/routes/auth.ts`
**Function**: `router.get('/me', authenticate, ...)`
**Line**: 319-334

```
1. Requires valid JWT (authenticate middleware)
2. Queries: User.findById(req.user.userId).select('-password')
3. Returns { success: true, data: user }
```

### 1.5 Frontend Session Restore
**File**: `frontend/src/context/AuthContext.tsx`
**Function**: `restoreSession()`
**Line**: 66-130

```
1. Reads localStorage: 'user' and 'authToken'
2. If both exist, sets React state immediately
3. Background validation: fetch('/api/auth/me', { headers: { Authorization: ... } })
4. If 401 → clears localStorage, logs out
5. If 200 → updates user from fresh data
6. If 5xx/network error → keeps existing session
```

---

## 2. EXACT DATABASE MODEL USED FOR LOGIN

**Model**: `User` (`backend/src/models/User.ts`)
**Collection**: `users`
**Fields Used for Login**:
- `email` — required, lowercase, trimmed
- `password` — required, bcrypt hashed
- `role` — required, enum: ['farmer', 'vendor', 'admin']
- `verified` — must be true
- `isActive` — checked implicitly (not explicitly in login, but in card login)

---

## 3. PASSWORD/TOKEN VALIDATION

### 3.1 Password Hashing
- **Algorithm**: bcrypt
- **Rounds**: 10
- **Comparison**: `bcrypt.compare(password, user.password)`

### 3.2 JWT Configuration
- **Secret**: `process.env.JWT_SECRET`
- **Expiry**: `30d` (30 days)
- **Payload**: `{ userId: user._id }`
- **Algorithm**: Default (HS256)

### 3.3 Token Storage (Frontend)
- **Location**: `localStorage`
- **Key**: `authToken`
- **Usage**: `Authorization: Bearer <token>` header

---

## 4. REGISTRATION FLOW

### 4.1 Email OTP Registration
**File**: `backend/src/routes/auth.ts`

```
1. POST /api/auth/register/request-otp
   - Generates 6-digit OTP: crypto.randomInt(100000, 999999)
   - Stores in memory Map (emailOtpStore)
   - Sends via email (SMTP) or returns devOtp
   - TTL: 10 minutes
   - Max attempts: 5

2. POST /api/auth/register/verify-otp
   - Validates OTP from emailOtpStore
   - Marks as verified in memory

3. POST /api/auth/register
   - Requires verified email (unless Google auth)
   - Creates User with bcrypt-hashed password
   - Returns JWT + user
```

### 4.2 Google OAuth Registration
**File**: `backend/src/routes/auth.ts`
**Function**: `router.get('/google/callback', ...)`
**Line**: 357-426

```
1. Frontend redirects to /api/auth/google?role=farmer
2. Backend redirects to Google OAuth
3. Google callback with code
4. Backend exchanges code for access_token
5. Fetches user info from Google
6. Finds or creates User
7. Returns JWT via redirect to frontend
```

### 4.3 Kisan Card Registration
**File**: `backend/src/routes/cardLogin.ts`

```
1. POST /api/auth/card/request-otp
   - Validates card number + mobile against AgroudAnKisanCard + User
   - Sends SMS OTP via MSG91
   - Returns devOtp if SMS not delivered

2. POST /api/auth/card/verify-otp
   - Validates OTP
   - Returns same JWT format as email login
```

---

## 5. CAN LOGIN CURRENTLY SUCCEED WITHOUT REAL DATABASE MATCH?

### 5.1 Email/Password Login
**Answer**: NO
- Login queries MongoDB: `User.findOne({ email, role: normalizedRole })`
- If user not found → 401 { error: 'Invalid credentials' }
- Password is verified with bcrypt
- No hardcoded users, no mock users, no fallback users
- No development bypass for login endpoint

### 5.2 Kisan Card Login
**Answer**: NO (with one caveat)
- Queries `AgroudAnKisanCard.findOne({ cardNumber, cardStatus: 'active' })`
- Then queries `User.findById(card.userId)`
- Validates user.verified === true and user.isActive === true
- Validates mobile number match
- No hardcoded cards

### 5.3 Google OAuth
**Answer**: Creates real user if not exists
- If Google user not found, creates new User with random password
- This is intentional behavior, not a bypass

### 5.4 OTP Registration
**Answer**: NO bypass
- OTP is validated against in-memory store
- Email must exist in store (generated by request-otp)
- No hardcoded OTPs

---

## 6. HARDCODED / MOCK / FALLBACK FINDINGS

### 6.1 NO hardcoded login credentials found
### 6.2 NO mock users found
### 6.3 NO fallback users found
### 6.4 NO test credentials found
### 6.5 NO default user found

### 6.6 Development Convenience: OTP devOtp
- **File**: `backend/src/routes/auth.ts:108-109`
- **Behavior**: If SMTP is not configured, `sendOtpEmail` returns `{ delivered: false, devOtp: code }`
- **Impact**: OTP is exposed in API response when email delivery fails
- **File**: `backend/src/routes/cardLogin.ts:100`
- **Behavior**: Same pattern for card login SMS OTP

### 6.7 Bootstrap Admin
- **File**: `backend/src/utils/bootstrapAdmin.ts`
- **Purpose**: Creates default admin user if none exists
- **Exact behavior**: Not read in detail, but used at startup (`ensureBootstrapAdmin()`)

### 6.8 Admin Credentials
- **File**: `backend/.env.example:13-15`
```env
ADMIN_EMAILS=admin@yourdomain.com
ADMIN_PASSWORDS=YourSecurePassword
ADMIN_NAMES=Super Admin
```
- These are example values, not hardcoded in source

---

## 7. AUTH TOKEN FLOW

```
Login/Register
    ↓
JWT created: jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' })
    ↓
Frontend stores: localStorage.setItem('authToken', token)
    ↓
Every API request: Authorization: Bearer <token>
    ↓
Backend middleware: authenticate()
    ↓
jwt.verify(token, JWT_SECRET) → { userId }
    ↓
User.findById(userId).select('-password')
    ↓
req.user = { userId, role }
    ↓
Controller handler
```

---

## 8. AUTHORIZATION HEADER ISSUES

### 8.1 Frontend
- All authenticated requests use: `Authorization: Bearer ${token}`
- Token retrieved from `localStorage.getItem('authToken')`
- If token missing → request still sent without Authorization header
- Backend returns 401 for protected routes

### 8.2 Backend CORS
**File**: `backend/src/index.ts:82-98`
- CORS configured with specific origins
- `credentials: true` allows cookies/Authorization headers
- Origins include: `FRONTEND_URL`, `ADMIN_URL`, `http://localhost:3000`, `http://localhost:3001`

### 8.3 Android Issue
- WebView running from `file://` or `http://localhost` may not send proper Origin header
- CORS may block requests if Origin is not in allowed list
- `credentials: true` requires explicit Origin, not `*`

---

## 9. SESSION MANAGEMENT

### 9.1 Client-Side
- **Storage**: `localStorage`
- **Keys**: `authToken`, `user`
- **Restore**: On app load, reads from localStorage
- **Validation**: Background call to `/api/auth/me`
- **Invalidation**: 401 response clears localStorage

### 9.2 Server-Side
- **Stateless**: JWT only, no server-side session store
- **Expiry**: 30 days
- **No refresh token mechanism**
- **No logout endpoint** (token simply deleted from localStorage)

---

## 10. ROLE SYSTEM

### 10.1 Roles
- `farmer` — Default role
- `vendor` — Shopkeeper/vendor (alias: `shopkeeper`)
- `admin` — Administrator

### 10.2 Role Normalization
```typescript
// Frontend
const normalizeRole = (role) => role === 'shopkeeper' || role === 'vendor' ? 'shopkeeper' : 'farmer';

// Backend
const normalizeRole = (role) => role === 'shopkeeper' || role === 'vendor' ? 'vendor' : 'farmer';
```

### 10.3 Role in Login
- Frontend sends `role` in login body
- Backend normalizes and queries by `{ email, role }`
- This means a user registered as `farmer` CANNOT login as `vendor` with same email
- Role is fixed at registration

---

## 11. GOOGLE OAUTH CONFIGURATION

**File**: `backend/src/routes/auth.ts:336-426`
**Environment Variables**:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `BACKEND_URL` (fallback for redirect URI)

**Flow**:
1. Frontend redirects to `/api/auth/google?role=farmer`
2. Backend builds Google OAuth URL
3. User authenticates with Google
4. Google redirects to `/api/auth/google/callback?code=...`
5. Backend exchanges code for tokens
6. Fetches user profile
7. Finds or creates User
8. Redirects to frontend with JWT

---

## 12. SECURITY OBSERVATIONS

### 12.1 Concerns
1. **JWT Secret**: If `JWT_SECRET` is weak/default, tokens can be forged
2. **No refresh tokens**: 30-day JWT with no rotation
3. **No rate limiting on login** (only on OTP endpoints)
4. **OTP in memory only**: Server restart clears all pending OTPs
5. **devOtp exposure**: OTP returned in API response when SMTP/SMS fails
6. **No password complexity enforcement**
7. **No 2FA/MFA**
8. **localStorage XSS risk**: Token stored in localStorage, vulnerable to XSS

### 12.2 Positive
1. **bcrypt hashing**: Passwords are properly hashed
2. **JWT verification**: Token signature verified on every request
3. **Password not returned**: `select('-password')` in queries
4. **Verified email required**: Local registration requires OTP verification
5. **CORS configured**: Origins restricted in production

---

*Report generated: 2026-08-26*
*Scope: Read-only forensic analysis — no code modified*
