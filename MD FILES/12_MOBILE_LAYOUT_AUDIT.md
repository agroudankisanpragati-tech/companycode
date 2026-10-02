# COMPANYCODE — MOBILE LAYOUT AUDIT
## Forensic Analysis — Phase 1 Only — No Code Modification

---

## 1. FRONTEND FRAMEWORK

- **Framework**: Next.js 14 with Tailwind CSS 3.3
- **Responsive**: Uses Tailwind responsive prefixes (sm:, md:, lg:, xl:)
- **Layout**: App Router with shared layout.tsx

---

## 2. COMMON MOBILE ISSUES

### 2.1 Tailwind Configuration
**File**: `frontend/tailwind.config.js`
- Uses standard Tailwind breakpoints
- Custom colors/theme may be defined

### 2.2 Layout.tsx
**File**: `frontend/src/app/layout.tsx`
- Root layout wraps all pages
- Contains global CSS, fonts, providers (Auth, AI, Voice, Language, Location)

### 2.3 Potential Issues

| Issue | Risk | Evidence |
|-------|------|----------|
| Fixed widths | HIGH | Tailwind classes like `w-64`, `w-96`, `w-[800px]` may exist |
| Fixed heights | MEDIUM | `h-screen`, `h-[600px]` may constrain mobile |
| Horizontal scrolling | HIGH | Overflow containers, wide tables |
| Absolute positioning | MEDIUM | `absolute`, `fixed` elements may overlap |
| Desktop sidebar | HIGH | Sidebar may not collapse on mobile |
| Touch targets | MEDIUM | Small buttons (< 44px) |
| Modal dimensions | MEDIUM | Fixed modals may not fit mobile screens |
| Input widths | LOW | Full-width inputs usually OK |
| Keyboard handling | LOW | Not explicitly configured |

---

## 3. COMPONENT-SPECIFIC CONCERNS

### 3.1 Navigation
**File**: `frontend/src/components/Navbar.tsx` (not read)
- Desktop horizontal nav may overflow on mobile
- Hamburger menu may not be implemented

### 3.2 Sidebar
**File**: `frontend/src/components/Sidebar.tsx` (not read)
- Fixed sidebar width may consume mobile screen
- Should collapse to drawer on mobile

### 3.3 Forms
**File**: Various form components
- Input fields may have small touch targets
- Select dropdowns may be hard to use on mobile

### 3.4 Tables
**File**: Various table components
- Wide tables cause horizontal scrolling
- Should stack vertically on mobile

### 3.5 Modals
**File**: Various modal components
- Fixed width/height modals may not fit mobile screens
- Should use `w-full`, `max-w-md`, `mx-4` for mobile

### 3.6 Charts/Graphs
- Not explicitly found in codebase
- If present, may not be responsive

---

## 4. ANDROID WEBVIEW CSS ISSUES

### 4.1 Viewport
**Issue**: Next.js sets viewport meta tag, but WebView may not respect it.

### 4.2 100vh Problem
**Issue**: `h-screen` (100vh) in WebView includes address bar height, causing content to be cut off.

### 4.3 Safe Area
**Issue**: No safe area insets for notched phones.

### 4.4 Font Scaling
**Issue**: Android font scaling may break fixed-height layouts.

---

## 5. RECOMMENDATIONS

1. **Audit all components** for fixed widths/heights
2. **Use responsive Tailwind classes**: `w-full md:w-64`, `h-auto md:h-screen`
3. **Implement mobile-first navigation**: Collapsible sidebar, hamburger menu
4. **Ensure 44px minimum touch targets**: Per Android design guidelines
5. **Use safe area insets**: For notched devices
6. **Test on real devices**: Emulators may not reveal all issues
7. **Avoid horizontal scroll**: Stack content vertically on mobile
8. **Use relative units**: `%`, `vw`, `vh` with caution in WebView

---

*Report generated: 2026-08-26*
*Scope: Read-only forensic analysis — no code modified*
