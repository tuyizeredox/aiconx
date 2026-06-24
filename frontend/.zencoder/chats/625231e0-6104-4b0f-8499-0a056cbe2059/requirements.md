# Product Requirements Document (PRD): Authentication Pages Update

## 1. Overview
Update the authentication pages (Login, Register, Forgot Password, Reset Password) to ensure a consistent, modern, and high-performance user experience while maintaining all existing authentication features (Password, Google, 2FA, Biometrics).

## 2. Target Pages
- `src/pages/Login.jsx`
- `src/pages/Register.jsx`
- `src/pages/ForgotPassword.jsx`
- `src/pages/ResetPassword.jsx`

## 3. Key Requirements

### 3.1. UI/UX Consistency
- **Design Language**: Ensure all pages follow the same "Premium Social Commerce" aesthetic (backdrop-blur, indigo/slate color scheme, rounded-2.5rem containers, framer-motion animations).
- **Error Handling**: Standardize error reporting using a combination of inline messages (for critical form errors) and `sonner` toasts (for general feedback).
- **Loading States**: Maintain consistent use of `Loader2` (lucide-react) and disabled button states during API calls.
- **Button Labels**: Standardize call-to-action buttons (e.g., "Sign In", "Create Account") if appropriate, or keep thematic labels ("Enter Workspace", "Establish Identity") if preferred for brand voice.

### 3.2. Functional Improvements
- **Biometric Login UX**: In `Login.jsx`, improve the error message and flow when the user attempts biometric login without an identifier. Ensure it's clear that an email/username is required to locate the passkey.
- **Validation**: Ensure client-side validation matches backend `zod` schemas (e.g., username regex `^[a-zA-Z0-9_]+$`, password min length 6).
- **Password Visibility**: Ensure all password fields have the toggle visibility feature.
- **Form Persistence**: Ensure "Remember Me" functionality is correctly wired and preserved across sessions.

### 3.3. Security & Maintenance
- **Data Integrity**: Ensure no changes break existing authentication flows (JWT handling, session initialization).
- **API Clients**: Continue using `authAPI` from `@/api/apiClient`.
- **Environment Variables**: Ensure `GOOGLE_CLIENT_ID` and other env vars are correctly utilized.

## 4. Proposed Changes

### Login Page
- Refine 2FA OTP input transition.
- Ensure Biometric button is only enabled/visible if the browser supports it (WebAuthn check).

### Register Page
- Add validation feedback for username (lowercase only, no special chars except `_`).
- Ensure the "Establish Identity" flow correctly sets up the user session and redirects.

### Password Recovery Flow
- Ensure `ForgotPassword.jsx` and `ResetPassword.jsx` use the same layout as Login/Register.
- Add a "resend" option or clear success messaging for email recovery.

## 5. Verification Plan
- **Manual Testing**: Test every auth flow:
    - Standard Login (Email/Password)
    - Google Login
    - 2FA Challenge (if enabled for user)
    - Biometric Login (if registered)
    - Account Registration
    - Password Reset Flow
- **Automated Checks**: Run `npm run lint` and `npm run typecheck` to ensure no regressions.
