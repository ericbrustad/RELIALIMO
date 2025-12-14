# 🔐 Authentication Quick Reference Card

## Sign-In Page
**URL:** `https://relialimo.com/auth.html`

### Demo Accounts (One-Click Sign In)
```
👨‍💼 Admin          📋 Dispatcher      🚗 Driver
admin@...         dispatcher@...     driver@...
Newhouse2025!     DemoDispatcher123! DemoDriver123!
admin@...         dispatcher@...     driver@...
Newhouse2025!    DemoDispatcher123! DemoDriver123!
```
Just click the colored button!

## Main App
**URL:** `https://relialimo.com`
- Shows user menu in header
- Protected by auth-guard.js
- Auto-redirects if not signed in

## Key Files

| File | Purpose | Location |
|------|---------|----------|
| `auth.html` | Sign-in page | Root |
| `auth.js` | Sign-in logic | Root |
| `user-menu.js` | User menu | Root |
| `auth-guard.js` | Route protection | Root |
| `env.js` | Config | Root |

## JavaScript Commands

### Check If Signed In
```javascript
import { getCurrentUser } from './auth.js'
const user = await getCurrentUser()
console.log(user) // null if not signed in
```

### Get User Session
```javascript
import { getSession } from './auth.js'
const session = await getSession()
console.log(session?.user?.email)
```

### Sign Out Programmatically
```javascript
import { signOut } from './auth.js'
await signOut() // Clears session
```

### Connect to Supabase
```javascript
import { supabase } from './supabase-client.js'
const { data, error } = await supabase
  .from('reservations')
  .select('*')
console.log(data)
```

## Configuration

### Environment Variables
**Location:** `/env.js` or Netlify dashboard
```javascript
window.ENV = {
  SUPABASE_URL: "https://siumiadylwcrkaqsfwkj.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi..." 
}
```

### Supabase Auth URLs
**Supabase Dashboard** → Settings → Authentication
```
Site URL: https://relialimo.com
Redirect: https://relialimo.com
```

## UI Structure

```
Header
├─ Logo & Navigation
└─ User Menu (top right)
   ├─ Avatar + Email
   ├─ Dropdown Menu
   │  ├─ My Profile
   │  ├─ Settings
   │  ├─ Help
   │  └─ Sign Out
   └─ Auto-initializes from user-menu.js

Auth Page (/auth.html)
├─ Logo
├─ Sign In Form
│  ├─ Email input
│  ├─ Password input
│  ├─ Remember me
│  └─ Sign In button
└─ Demo Accounts
   ├─ Admin
   ├─ Dispatcher
   └─ Driver
```

## Common Tasks

### Add User to Organization
```javascript
const { supabase } = await import('./supabase-client.js')

const { data } = await supabase
  .from('organization_members')
  .insert([{
    organization_id: 'org-uuid',
    user_id: 'user-uuid',
    role: 'dispatcher'
  }])
```

### Create Customer
```javascript
const { data } = await supabase
  .from('accounts')
  .insert([{
    organization_id: 'org-uuid',
    email: 'customer@example.com',
    first_name: 'John',
    last_name: 'Doe'
  }])
```

### Create Driver
```javascript
const { data } = await supabase
  .from('drivers')
  .insert([{
    organization_id: 'org-uuid',
    first_name: 'Jane',
    last_name: 'Driver',
    email: 'jane@example.com'
  }])
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Sign in doesn't work | Check email/password, ensure user exists |
| User menu doesn't show | Sign in again, check browser console |
| Can't access app | Go to `/auth.html`, sign in |
| Demo buttons don't work | Click demo button (creates account on first try) |
| Environment vars not working | Redeploy on Netlify, clear browser cache |
| CORS error | Check Supabase auth URLs are configured |

## File Checklist

- [ ] `/auth.html` - Sign-in page
- [ ] `/auth.css` - Sign-in styles
- [ ] `/auth.js` - Auth logic
- [ ] `/auth-guard.js` - Route protection
- [ ] `/user-menu.js` - User menu
- [ ] `/user-menu.css` - Menu styles
- [ ] `/env.js` - Environment vars
- [ ] `/supabase-client.js` - Supabase connection
- [ ] `/index.html` - Updated with scripts

## Documentation Files

- 📖 `QUICK_START.md` - 5-min setup
- 📖 `AUTH_SETUP.md` - Detailed auth guide
- 📖 `NETLIFY_SETUP.md` - Deployment
- 📖 `SQL_SETUP_GUIDE.md` - Database
- 📖 `AUTHENTICATION_SUMMARY.md` - Full overview

## Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/auth.html` | Sign-in page |
| `/index.html` | Main app (protected) |
| `https://siumiadylwcrkaqsfwkj.supabase.co` | API |

## Roles

| Role | Permissions | Button |
|------|-------------|--------|
| admin | Full system | 👨‍💼 |
| dispatcher | Manage trips | 📋 |
| driver | Accept trips | 🚗 |
| member | View only | 👤 |

## Browser Console

Open DevTools (F12) to:
- See auth logs (✅ success, ❌ errors)
- Run API test: `await import('./supabase-client.js').then(m => m.testSupabaseConnection())`
- Check current user: `await import('./auth.js').then(m => m.getCurrentUser())`
- View network requests to Supabase

## Security Checklist

- ✅ Never share SUPABASE_SERVICE_ROLE_KEY
- ✅ Keep SUPABASE_ANON_KEY in env vars only
- ✅ RLS policies protect database
- ✅ Sessions stored in browser memory
- ✅ HTTPS in production (automatic)
- ✅ CORS configured correctly
- ✅ Demo accounts for testing only

## That's It!

You have a fully functional authentication system. 

**To use:**
1. Go to `https://relialimo.netlify.com`
2. Click a demo button
3. You're signed in! 🎉

Enjoy! 🚀
