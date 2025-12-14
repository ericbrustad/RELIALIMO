# RELIA🐂LIMO™ - Authentication Setup Guide (Login Removed)

## Overview
Authentication prompts have been disabled in this environment. The legacy email/password form and demo buttons have been replaced with a simple entry notice so users can reach the dashboard without credentials.

## Files
- **`/auth.html`** – Entry notice with an **Enter Dashboard** button.
- **`/auth.css`** – Styling for the simplified access card.
- **`/auth.js`** – Clears stored auth state and redirects to `index.html`.
- **`/auth-guard.js`** – Stubbed guard that always allows access.
- **`/user-menu.js`** – UI-only user menu (no auth required).

## Setup
1. Ensure your pages still include `auth-guard.js` and `user-menu.js` so the UI loads consistently.
2. Deploy the updated `auth.html` if you want to provide a direct link for users; it no longer accepts credentials.
3. Supabase configuration in `env.js` remains available for data access, but no sign-in calls are made during navigation.

## Current Flow
```
Page load → auth-guard.js allows access → (optional) auth.html shows notice → index.html
```

## Notes
- No credentials are requested anywhere in the app.
- Stored auth tokens from older builds are cleared when `auth.js` loads to prevent stale state.
- If you re-enable authentication later, restore sign-in logic before turning the guard back on.
