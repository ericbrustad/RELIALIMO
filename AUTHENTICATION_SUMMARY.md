# 🔓 Authentication Access Summary

## Current State
- **Sign-in removed:** The previous email/password form and demo-account buttons have been retired.
- **Direct entry:** `auth.html` now shows an informational notice with a single **Enter Dashboard** button.
- **No Supabase session requirement:** `auth.js` only clears legacy auth storage and forwards visitors to `index.html`.
- **Auth guard disabled:** `auth-guard.js` no longer blocks access based on Supabase sessions.

## Key Files
```
/auth.html              - Entry notice with "Enter Dashboard" button
/auth.css               - Styling for the simplified access card
/auth.js                - Clears old auth data and redirects to the app
/auth-guard.js          - Stubbed guard that always allows access
/user-menu.js           - UI-only user menu (no login needed)
/user-menu.css          - Styling for the user menu
/supabase-client.js     - Supabase connection (unused for login)
```

## Access Flow
```
Visitor opens any page
    ↓
(auth-guard.js allows access immediately)
    ↓
If visiting auth.html → click Enter Dashboard (or wait for auto-redirect)
    ↓
index.html loads with no authentication prompts
```

## Notes
- Credentials are no longer requested in this environment.
- Legacy auth tokens are cleared on page load to avoid stale state.
- Supabase credentials remain available for data access, but authentication is bypassed.
