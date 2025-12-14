# RELIA🐂LIMO™ Quick Start

## 🚀 5-Minute Setup
1. Deploy the site (Netlify ready).
2. Configure Supabase URL and keys in `env.js` (or Netlify environment variables).
3. Publish the updated files.
4. Verify direct access by opening **https://relialimo.netlify.app** — no sign-in is required.

## 📁 Key Files
- **`/auth.html`** – Informational access page with **Enter Dashboard** button.
- **`/auth.js`** – Clears legacy auth state and redirects to `index.html`.
- **`/auth-guard.js`** – Stubbed guard that always allows access.
- **`/user-menu.js` / `user-menu.css`** – UI-only user menu styling and script.
- **`/env.js`** – Supabase credentials for data access.
- **`/supabase-client.js`** – Supabase client for queries.

## 🔓 Access
- Authentication prompts have been removed. Users land directly on the dashboard.
- Visiting `/auth.html` simply clears any stored tokens and offers a single **Enter Dashboard** button.

## ✅ What's Working Now
- Direct navigation to all pages (no login flow).
- Supabase connectivity for data queries via `supabase-client.js`.
- User menu UI renders without requiring a session.

## 🧪 Testing Checklist
- [ ] Load `https://relialimo.netlify.app` and confirm the dashboard appears without login.
- [ ] Visit `https://relialimo.netlify.app/auth.html` and click **Enter Dashboard** to reach the app.
- [ ] Run a data query from the browser console using `supabase-client.js` to confirm connectivity.

Example query:
```javascript
const { supabase } = await import('./supabase-client.js');
const { data, error } = await supabase.from('drivers').select('*');
console.log({ data, error });
```

## 🆘 Troubleshooting
- **Redirect loops:** Resolved — auth guard is disabled and allows access.
- **Stale login state:** `auth.js` clears stored auth tokens on load.
- **Supabase errors:** Verify `SUPABASE_URL` and keys in `env.js` or your hosting environment.

## 📚 More Documentation
- **Database Setup**: `/SQL_SETUP_GUIDE.md`
- **Netlify Deploy**: `/NETLIFY_SETUP.md`
- **Authentication**: `/AUTH_SETUP.md` (updated for login removal)
- **API Service**: `/api-service.js` (with JSDoc comments)
