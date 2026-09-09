# WorkTree X — Step 03 Supabase Auth & Session Report

## 1. Baseline
- **Git Branch:** `main`
- **Starting Git HEAD:** `4c68676501ce8b82b17d8b5f8d41826f06b816cd` (`test(security): verify multi-tenant RLS and RPC isolation`)
- **Step 01 Status:** PASS (Schema contract aligned across all frontend repositories, Edge Functions, and database types)
- **Step 02 Status:** PASS (Multi-tenant database RLS & RPC isolation verified with 55/55 authorization tests green, cross-tenant P0/P1 = 0)
- **Step 03 Objective:** Integrate production-grade Supabase Authentication and session management into WorkTree X without altering existing design tokens, UI aesthetics, or responsive behavior, while disabling local offline PBKDF2 credential checks on the production path.

---

## 2. Files Audited
1. `js/access.js`: Legacy authentication, local identity database, PBKDF2 hashing, cooldowns, idle locks, and role management.
2. `js/core.js`: App initialization, local state synchronization, dialog orchestration, and workspace rendering.
3. `index.html`: Entry point, script loading order, and DOM structure.
4. `js/supabase-client.js`: Legacy window client initialization.
5. `src/lib/supabase/client.js`: Production ES module singleton client with publishable key.
6. `src/features/auth/services/auth-service.js`: Domain service for authentication operations.
7. `src/features/auth/components/auth-view.js`: UI component for login, registration, recovery, and email verification.
8. `src/features/auth/index.js`: Public API boundary for auth feature slice.
9. `src/app/app.js`: Application root composition, session bootstrap, and auth state change listeners.
10. `src/app/state.js`: In-memory session and UI store.
11. `css/style.css`: Design system tokens and component styles.
12. `supabase/migrations/20260909000000_worktree_multi_tenant_complete.sql`: Baseline database schema and triggers (`on_auth_user_created`).

---

## 3. Legacy Auth Analysis

| LEGACY FEATURE | CURRENT IMPLEMENTATION | SUPABASE REPLACEMENT | KEEP / REMOVE / ADAPT |
| :--- | :--- | :--- | :--- |
| **PBKDF2 Password Hashing** | Client-side PBKDF2 with SHA-256 and salt in `js/access.js` | Supabase GoTrue server-side bcrypt / argon2 | **REMOVE** from production path; kept behind `__WORKTREE_LEGACY_LOCAL_AUTH__` flag for emergency fallback |
| **Local Account Database** | `ACCOUNTS_V8_KEY` in `localStorage` with hardcoded seed accounts | `auth.users` + `public.profiles` in Supabase Cloud | **REMOVE** from production path; isolated from auth decisions |
| **Identity Verification** | `verifyLogin(u, p)` comparing password hash locally | `supabase.auth.signInWithPassword({ email, password })` | **REMOVE** from production path; replaced by GoTrue API |
| **Role Assignment** | Hardcoded roles (`admin`, `lead`, `member`) selectable in local DB | `public.organization_members.role` (`owner`, `admin`, `manager`, `member`, `viewer`) | **REMOVE** client role selector; role is granted exclusively via organization onboarding / invitation |
| **Session Persistence** | `SESSION_V8_KEY` storing account object without cryptographic signature | Supabase GoTrue managed tokens (`sb-<project-ref>-auth-token`) | **REPLACE** with standard Supabase browser storage session |
| **Login Cooldown / Lockout** | In-memory `attemptCount` and 30s lockout | Supabase GoTrue IP & rate limit protection + UI rate-limit feedback | **ADAPT** to handle HTTP 429 rate limit responses gracefully |
| **Password Reset** | Dialog stating "Vui lòng liên hệ quản trị viên" | `supabase.auth.resetPasswordForEmail()` + SPA recovery view | **REPLACE** with standard email recovery flow |
| **Forced Password Change** | `mustChangePassword` flag in local account | Supabase auth update password flow | **ADAPT** via `supabase.auth.updateUser({ password })` |
| **Idle Lock & Max Session** | 30m idle lock & 12h absolute session timer in `js/access.js` | Supabase JWT expiration (1 hour) with automatic background token refresh (`autoRefreshToken: true`) | **ADAPT** to leverage GoTrue token expiration and refresh cycles |

---

## 4. Supabase Auth Architecture
- **Authority:** All identity verification is strictly delegated to Supabase Auth (`auth.users`).
- **Authorization:** PostgreSQL Row Level Security (RLS) policies evaluate `auth.uid()` from the verified JWT.
- **Client Security:** The browser bundle contains **ONLY** the public project URL and the publishable API key (`sb_publishable_...`). The `service_role` secret key is strictly prohibited and absent from client code.
- **Data Flow:**
  ```
  [Browser UI: AuthView]
          │ (Email + Password / Recovery)
          ▼
  [Supabase GoTrue API: https://taupjuaficdzdgbmxmbe.supabase.co/auth/v1]
          │ (JWT access_token + refresh_token)
          ▼
  [Supabase Client Singleton (localStorage standard session)]
          │ (Bearer access_token with auth.uid())
          ▼
  [PostgreSQL Engine (RLS Policies on public.profiles & public.organization_members)]
  ```

---

## 5. Client Configuration
The production Supabase client is configured as a singleton in `src/lib/supabase/client.js`:
```javascript
createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage
  }
});
```
- Client keys are loaded from `window.__SUPABASE_CONFIG__` or fallback configuration.
- Tokens are stored using the standard GoTrue key naming convention (`sb-<ref>-auth-token`).
- Token logging is strictly suppressed.

---

## 6. Login Flow
- **Component:** `src/features/auth/components/auth-view.js` (Method: `renderLoginForm`)
- **Backend Call:** `AuthService.signIn(email, password)` → `supabase.auth.signInWithPassword`
- **UX & Accessibility:**
  - Loading spinner (`.icon-spin`) and disabled button during active submission.
  - Show / Hide password toggle button with SVG icons.
  - Keyboard accessible: Enter key submits the active form.
  - Clear user-facing error messages (e.g., "Email hoặc mật khẩu không chính xác.", "Tài khoản chưa xác nhận email.").
  - Automatic transition to authenticated workspace without endless page reload loops.

---

## 7. Signup Flow
- **Component:** `src/features/auth/components/auth-view.js` (Method: `renderSignupForm`)
- **Fields:**
  - Full Name (`Họ và tên`)
  - Work Email (`Email công việc`)
  - Password (`Mật khẩu`, minimum 8 characters)
  - Confirm Password (`Xác nhận mật khẩu`)
- **Multi-Tenant Protection:** **Zero role selection inputs** exist on the signup form. Roles are determined by organization membership invitations, preventing privilege escalation.
- **Backend Call:** `AuthService.signUp(email, password, { full_name })`
- **Profile Initialization:** Handled automatically by the PostgreSQL trigger `public.handle_new_user()` attached to `auth.users`, populating `public.profiles` with `display_name` and `email`.

---

## 8. Email Verification
- **Project Configuration:** The Supabase project has `mailer_autoconfirm: false`.
- **Handling:**
  - When a user signs up, GoTrue returns a user object without a session.
  - `AuthView` detects `!session` and renders the dedicated Email Confirmation Notice:
    *"Tài khoản của bạn đã được tạo thành công! Vui lòng kiểm tra hộp thư đến để nhấp vào liên kết xác nhận trước khi đăng nhập."*
  - Attempted login by an unconfirmed user is rejected by GoTrue with HTTP 400 (`email_not_confirmed`). The UI explicitly prompts the user to verify their email.

---

## 9. Password Recovery
- **Request Flow:** User clicks "Quên mật khẩu?" → enters email → `AuthService.resetPassword(email)` → `supabase.auth.resetPasswordForEmail(email, { redirectTo })`.
- **UI State:** Shows confirmation message: *"Nếu địa chỉ email tồn tại trên hệ thống, một liên kết khôi phục đã được gửi."*
- **Callback Handling:** When the user arrives via the recovery URL (`#type=recovery&access_token=...`), `src/app/app.js` catches the `PASSWORD_RECOVERY` event on `onAuthStateChange` and renders the New Password form.
- **Update Flow:** Submitting the new password executes `AuthService.updatePassword(newPassword)` → `supabase.auth.updateUser({ password })`.

---

## 10. Session Bootstrap
On application boot (`src/app/app.js`):
1. Initializes `AuthService`.
2. Evaluates `AuthService.getSession()`.
3. If **no session**: mounts `AuthView` to `#authContainer` and hides protected app shell.
4. If **session exists**:
   - Queries `public.profiles` for current `auth.uid()`.
   - Queries `public.organization_members` for organizations associated with `auth.uid()`.
   - Bootstraps user profile into `window.__worktree_supabase_user` and `window.__worktree_supabase_orgs`.
   - Mounts the authenticated application shell.
5. Registers `onAuthStateChange` listener to handle real-time session events.

---

## 11. Session Restoration
- On page reload (`F5`), GoTrue reads the stored refresh token from `localStorage`.
- Validates and refreshes the session seamlessly in the background without exposing flash-of-unauthenticated-content.
- If the token is invalid or revoked, the session is cleared and the login screen is displayed.

---

## 12. Logout
- Triggered by user action or calling `window.supabaseSignOut()`.
- Executes `await AuthService.signOut()`.
- Clears in-memory session variables: `window.__worktree_supabase_user = null`, `window.__worktree_supabase_orgs = []`.
- Closes any open modals, dialogs, or drawers.
- Tears down authenticated app shell and renders `AuthView`.

---

## 13. Profiles
- Table: `public.profiles` (Primary Key: `id REFERENCES auth.users(id)`).
- RLS Policy: Authenticated users can view their own profile (`id = auth.uid()`) and profiles of users in shared organizations.
- Trigger: `on_auth_user_created` automatically creates a profile row upon signup with `display_name = coalesce(raw_user_meta_data->>'full_name', email)`.

---

## 14. Organization Membership Bootstrap
- On session establishment, queries `public.organization_members` joined with `public.organizations`.
- **0 Organizations:** App displays workspace state *"Chưa có workspace"*.
- **1 Organization:** Sets `activeOrganizationId` to the associated organization.
- **>1 Organizations:** Prepares membership list for Step 04 Workspace Selector.
- **Tenant Protection:** RLS ensures the user cannot view or query organization memberships belonging to organizations they do not belong to.

---

## 15. Security Verification

An automated verification suite (`scratch/test_step03_auth.js`) was executed directly against the remote Supabase database:

```
================================================================
WORKTREE X — STEP 03 AUTHENTICATION & SECURITY TEST SUITE
================================================================
--- TEST A: NO SESSION PROTECTION ---
  [PASS] Test 1: Anonymous query to organization_members correctly blocked or filtered (HTTP 401/403/200)
  [PASS] Test 2: Protected tenant data is inaccessible to unauthenticated callers (0 records leaked)

--- TEST F: UNCONFIRMED EMAIL HANDLING & PROFILE AUTO-CREATION ---
  [PASS] Test 3: Database trigger on_auth_user_created created profile with full_name
  [PASS] Test 4: Unconfirmed user login rejected with HTTP 400
  [PASS] Test 5: Error response indicates email not confirmed

--- TEST C: WRONG PASSWORD REJECTION ---
  [PASS] Test 6: Wrong password rejected with HTTP 400
  [PASS] Test 7: Error indicates invalid login credentials

--- TEST B: VALID LOGIN & SESSION CREATION ---
  [PASS] Test 8: Valid login returns HTTP 200
  [PASS] Test 9: Valid JWT access_token issued
  [PASS] Test 10: Valid refresh_token issued
  [PASS] Test 11: User ID in session matches registered user
  [PASS] Test 12: User email in session matches

--- TEST E: SESSION RESTORATION VIA REFRESH TOKEN ---
  [PASS] Test 13: Session refresh returns HTTP 200
  [PASS] Test 14: New access_token issued on refresh
  [PASS] Test 15: User identity preserved after token refresh

--- TEST G: AUTHENTICATED USER RLS RESTRICTION ---
  [PASS] Test 16: Query to organization_members under user JWT succeeds (HTTP 200)
  [PASS] Test 17: Response is array
  [PASS] Test 18: User with 0 memberships sees 0 rows under RLS (no cross-tenant leak)

--- TEST J: PASSWORD RESET REQUEST (NO SECRETS IN LOG) ---
  [PASS] Test 19: Password recovery endpoint reachable (HTTP 200 or 429 rate-limited)
  [PASS] Test 20: Recovery response exposes no raw tokens to client

--- TEST D: LOGOUT & SESSION TERMINATION ---
  [PASS] Test 21: Sign out returns HTTP 200 or 204

--- TEST H: CLIENT ZERO-SECRETS SCAN ---
  [PASS] Test 22: All frontend files contain ZERO secret keys (only Publishable Key allowed)

--- TEST I: SIGNUP ROLE SELECTOR GUARD ---
  [PASS] Test 23: Signup form contains strictly NO role selection inputs

--- CLEANUP TEST USERS ---
  [PASS] Test 24: Test accounts cleanly deleted from database

================================================================
FINAL RESULT: 24 / 24 ASSERTIONS PASSED
STEP 03 SECURITY STATUS: PASS
================================================================
```

---

## 16. Desktop QA
- **Resolution:** `>= 901px` (Verified at 1536x730 and 1280x800).
- **Layout:** Two-column grid with `.auth-story` hero column on the left and `.auth-card` on the right.
- **Design System Tokens:** Strictly uses `var(--bg)`, `var(--surface)`, `var(--primary)`, `var(--text)`, `var(--muted)`, `var(--line)`.
- **Sidebar Integration:** Desktop navigation respects 278px expanded and 76px collapsed states upon entering the authenticated workspace.
- **Dark Mode:** Verified crisp contrast with dark theme tokens (`--bg: #111622`, `--surface: #1a2131`, `--text: #e6eaf3`).

---

## 17. Mobile QA
- **Resolution:** `<= 900px` (Verified at 390x844 iPhone viewport).
- **Single Column Layout:** `.auth-story` collapses cleanly; `.auth-card` centers with fluid margins.
- **Touch Targets:**
  - Input field heights: `50px` (exceeds 44px minimum touch target and prevents iOS Safari auto-zoom).
  - Submit button: `52px`.
  - Links / tab buttons: `>= 44px`.
- **Horizontal Overflow:** Verified `scrollWidth <= clientWidth` (`hasHorizontalOverflow: false`). Zero horizontal scrollbars.

---

## 18. Build & Tests
- **Bundle Command:** `npm run bundle`
- **Bundle Status:** PASS (`WorkTree.html bundled successfully!`).
- **Security Test Suite:** PASS (24 / 24 assertions passed).

---

## 19. Files Modified
1. `src/features/auth/services/auth-service.js`: Expanded auth methods, profile loading, and organization membership querying.
2. `src/features/auth/components/auth-view.js`: Implemented comprehensive auth UI (login, signup, recovery, email confirmation).
3. `src/features/auth/index.js`: Re-exported `AuthService` and `AuthView`.
4. `src/app/app.js`: Session orchestration, bootstrap logic, and auth state change subscriptions.
5. `js/access.js`: Disabled local PBKDF2 credential checking on production path; wired to Supabase authenticated user.
6. `css/style.css`: Integrated auth styles with standard design system tokens and loading spinner animations.
7. `WorkTree.html`: Production distribution bundle generated via `npm run bundle`.

---

## 20. Legacy Code Remaining
- `js/access.js`:
  - `LOCAL_ACCOUNTS_SEED`, `computeHashPBKDF2`, `verifyLogin`: Isolated behind `window.__WORKTREE_LEGACY_LOCAL_AUTH__` flag. Disabled on production path.
  - `isAdmin`, `isLead`, `canEditTask`: Retained as UI permission bridges, reading from `window.__worktree_supabase_user.role`.
- `js/core.js`: Local task storage logic retained for offline drafting until Step 05 Cloud Migration.

---

## 21. Known Issues
- Supabase GoTrue Auth enforces a 60-second rate limit on password recovery and confirmation emails per IP/account. Rapid successive recovery requests return HTTP 429.
- Project-level email confirmation is active (`mailer_autoconfirm: false`). Users must confirm their email before logging in unless confirmed directly via database admin.

---

## 22. Exit Criteria
- [x] Supabase Auth is the sole authoritative authentication provider on the production path.
- [x] Login with email/password verified against GoTrue.
- [x] Signup verified with automatic profile trigger.
- [x] Logout terminates session and clears in-memory state.
- [x] Session restoration verified via refresh tokens.
- [x] Auth state listener active (`SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`, `PASSWORD_RECOVERY`).
- [x] Wrong credentials rejected with HTTP 400.
- [x] Password reset request flow implemented.
- [x] Email verification requirement handled cleanly in UI.
- [x] Unauthenticated calls cannot access protected tenant records.
- [x] Zero secret keys present in client bundle.
- [x] Zero role selector inputs on signup form.
- [x] `organization_members` query strictly enforces RLS.
- [x] Step 02 multi-tenant database isolation unaffected.
- [x] Desktop UI verified.
- [x] Mobile UI verified (390px viewport, touch targets >= 44px, no overflow).
- [x] `npm run bundle` PASS.

---

## 23. Recommendation for Step 04
- Implement the **Organization / Workspace Onboarding & Switcher** flow:
  1. For users with 0 organizations: present "Khởi tạo công ty / Workspace mới" dialog calling `create_organization_with_owner()`.
  2. For users with >1 organizations: present organization switcher dropdown in desktop topbar and mobile drawer.
  3. Store `activeOrganizationId` in memory / UI state and ensure all subsequent queries scope to that tenant ID.

---

STEP 03 STATUS: PASS  
SUPABASE AUTH ACTIVE: YES  
LOCAL PASSWORD AUTH DISABLED ON PRODUCTION PATH: YES  
SESSION RESTORE VERIFIED: YES  
READY FOR STEP 04 WORKSPACE ONBOARDING: YES  
