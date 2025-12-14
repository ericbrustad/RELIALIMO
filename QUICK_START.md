# RELIA🐂LIMO™ - Quick Start Guide

## 🚀 Get Running in 5 Minutes

### Step 1: Database Setup (5 min)
1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run `/supabase-schema.sql` 
3. Run `/supabase-setup.sql`
4. ✅ Done! Your database is ready

**See**: `/SQL_SETUP_GUIDE.md` for details

---

### Step 2: Netlify Deployment (2 min)
1. Your app is already deployed at: **https://relialimo.netlify.app**
2. Go to **Netlify Dashboard** → **Site settings** → **Build & deploy** → **Environment**
3. Add environment variables:
   ```
   VITE_SUPABASE_URL=https://siumiadylwcrkaqsfwkj.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
4. **Trigger a redeploy** (click "Trigger deploy")
5. ✅ Done! Your app has Supabase access

**See**: `/NETLIFY_SETUP.md` for details

---

### Step 3: Supabase Auth URLs (2 min)
1. Go to **Supabase Dashboard** → **Settings** → **Authentication**
2. Set **Site URL**: `https://relialimo.netlify.app`
3. Add **Redirect URLs**:
   ```
   https://relialimo.netlify.app
   https://relialimo.netlify.app/auth/callback
   ```
4. ✅ Done! Auth is configured

---

### Step 4: Test Authentication (1 min)
1. Go to **https://relialimo.netlify.app/auth.html**
2. Click a **Demo Account** button (Admin, Dispatcher, or Driver)
3. You should be signed in and see the user menu! ✅

**If it doesn't work:**
- Check browser console (F12) for errors
- Verify environment variables are set in Netlify
- Verify Supabase credentials in `/env.js`

---

## 📁 Key Files

### Authentication
- **`/auth.html`** - Sign-in page
- **`/auth.js`** - Sign-in logic
- **`/auth-guard.js`** - Protects routes

### User Interface
- **`/user-menu.js`** - User menu component
- **`/user-menu.css`** - User menu styles

### Configuration
- **`/env.js`** - Supabase credentials
- **`/config.js`** - Config management
- **`/supabase-client.js`** - Supabase client

---

## 🔐 Demo Accounts

Sign in with these accounts (on `/auth.html`):

| Role | Email | Password | Access |
|------|-------|----------|--------|
| Admin | admin@relialimo.demo | G0dD@mnNutj08! | Full system |
| Dispatcher | dispatcher@relialimo.demo | DemoDispatcher123! | Reservations |
| Driver | driver@relialimo.demo | DemoDriver123! | Assignments |

Just click the colored buttons on the sign-in page!

---

## 🎯 What's Working Now

✅ **Authentication**
- Sign in/sign out
- Session management
- User menu with profile
- Role-based access

✅ **Database**
- Drivers management
- Reservations system
- Route stops
- Assignments
- Events log

✅ **UI/UX**
- Professional sign-in page
- User menu in header
- Protected routes
- Responsive design

---

## 📋 Next Steps

### 1. Create Your Organization
```javascript
// From browser console or your app:
const { supabase } = await import('./supabase-client.js');
const { data } = await supabase
  .from('organizations')
  .insert([{ name: 'My Company' }])
  .select();
console.log(data);
```

### 2. Add Users to Organization
```javascript
// Add yourself as admin
const { data } = await supabase
  .from('organization_members')
  .insert([{
    organization_id: 'ORG_ID',
    user_id: 'YOUR_USER_ID',
    role: 'admin'
  }]);
```

### 3. Create Customers
```javascript
// Add a customer account
const { data } = await supabase
  .from('accounts')
  .insert([{
    organization_id: 'ORG_ID',
    email: 'customer@example.com',
    first_name: 'John',
    last_name: 'Doe'
  }]);
```

### 4. Create Drivers
```javascript
// Add a driver
const { data } = await supabase
  .from('drivers')
  .insert([{
    organization_id: 'ORG_ID',
    first_name: 'Jane',
    last_name: 'Driver',
    email: 'driver@example.com'
  }]);
```

### 5. Build Reservation Features
See `/my-office.js` for integration examples

---

## 🧪 Testing Checklist

- [ ] Visit https://relialimo.netlify.app
- [ ] See auth page (or redirect because not signed in)
- [ ] Click Demo Admin button
- [ ] Sign in succeeds
- [ ] User menu appears in header
- [ ] Can see email and role
- [ ] Click menu → Sign out works
- [ ] Redirects back to auth.html
- [ ] Database queries work in console

---

## 💡 Useful Commands

### Check Supabase Connection
```javascript
import { testSupabaseConnection } from './supabase-client.js'
await testSupabaseConnection()
// Should log: ✅ Supabase connected successfully
```

### Get Current User
```javascript
import { getCurrentUser } from './auth.js'
const user = await getCurrentUser()
console.log(user)
```

### Get Current Session
```javascript
import { getSession } from './auth.js'
const session = await getSession()
console.log(session)
```

### Query Drivers
```javascript
const { supabase } = await import('./supabase-client.js')
const { data } = await supabase.from('drivers').select('*')
console.log(data)
```

---

## 🆘 Troubleshooting

### "Can't sign in with demo accounts"
1. Make sure you're on `/auth.html`
2. Click the demo button (don't fill the form)
3. Account will be created if it doesn't exist
4. Check Supabase email confirmation settings

### "User menu doesn't appear"
1. Check if `user-menu.js` is loaded
2. Check browser console (F12) for errors
3. Make sure you're signed in
4. Try refreshing the page

### "Environment variables not working"
1. Verify they're added to Netlify (not just in `.env`)
2. Redeploy your site (Netlify > Deploy)
3. Clear browser cache
4. Check `/env.js` for local fallbacks

### "Supabase connection fails"
1. Check internet connection
2. Verify Supabase URL in `/env.js`
3. Check browser console for CORS errors
4. Verify CORS is configured in Supabase

---

## 📚 Full Documentation

- **Database Setup**: `/SQL_SETUP_GUIDE.md`
- **Netlify Deploy**: `/NETLIFY_SETUP.md`
- **Authentication**: `/AUTH_SETUP.md`
- **API Service**: `/api-service.js` (with JSDoc comments)

---

## 🎉 You're All Set!

Your RELIA🐂LIMO™ app is now:
- ✅ Deployed on Netlify
- ✅ Connected to Supabase
- ✅ Have authentication working
- ✅ Protected routes in place
- ✅ User menu integrated

**Next**: Start building features! 🚀

---

## 📞 Support

If you encounter issues:
1. Check the relevant guide file
2. Review browser console errors
3. Check Supabase dashboard logs
4. Verify all files are created
5. Confirm environment variables are set

**Everything is documented - you've got this! 💪**
