---
id: website-account-access
domain: website
language: en
status: draft-verified-from-repository
source: frontend/src/app/auth and screenshots
---

# Signing in and creating an account

## Sign in

### Email and password

1. Open Login and choose the correct account role if prompted.
2. Enter the account email and password. The page has a password-visibility control and a remember-email option.
3. Submit the form. On success, the site opens the account's dashboard.

Google sign-in is also offered on the login page.

### Farmer Kisan Card and mobile OTP

1. Choose the Kisan Card login option.
2. Enter the AgroudAn Kisan Card number and the associated mobile number.
3. Request an OTP and wait for the delivery or on-screen status message.
4. Enter the OTP and submit it to continue.

Shopkeeper access uses the role selection in the account flow; available methods can differ by role.

If sign-in fails, read the message shown on the page and check the account details or OTP. OTP delivery depends on the configured authentication service. Do not share an OTP or password in chat. The development interface may display a local OTP when delivery is not configured; that is a development behavior, not a production delivery guarantee.

## Create an account

1. Choose Get Started / Register and select the relevant account role.
2. Follow the registration form and complete its email-verification step.
3. Complete the role-specific onboarding shown by the site.
4. Follow the on-screen confirmation to continue.

Exact fields and steps can change; follow the current form. Do not enter someone else's personal details.

## If a page is unavailable

The screenshot set does not show a complete successful registration or every authentication result. Exact recovery steps for account lockouts, expired OTPs, or provider outages are UNKNOWN / REQUIRES SOURCE; use the message on screen or the site's Contact page.
