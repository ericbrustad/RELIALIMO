# 🔓 Authentication Quick Reference Card

## Access
- **Auth page:** `https://relialimo.netlify.app/auth.html` now shows a short notice and an **Enter Dashboard** button.
- **Main app:** `https://relialimo.netlify.app` loads directly; no credentials are required.

## Key Files
| File | Purpose | Location |
|------|---------|----------|
| `auth.html` | Entry notice and launch button | Root |
| `auth.js` | Clears legacy auth data, redirects to app | Root |
| `auth.css` | Styling for simplified access card | Root |
| `auth-guard.js` | Stubbed guard that always allows access | Root |
| `env.js` | Config | Root |

## Behavior
- Authentication checks are disabled; Supabase is not consulted for login.
- Visiting `auth.html` will clear any stored auth tokens and continue to `index.html`.
- Route protection is effectively bypassed while this mode is active.

## Supabase Usage
Data access through `supabase-client.js` remains available for other modules, but sign-in is not performed.

## Troubleshooting
| Situation | What happens |
|-----------|--------------|
| Attempt to sign in | Not applicable — form removed |
| Auth guard redirect loop | Resolved by disabling guard; direct access allowed |
| Stale login state | `auth.js` clears stored tokens on load |

## File Checklist
- [x] `/auth.html` - Simplified access page
- [x] `/auth.css` - Updated styling
- [x] `/auth.js` - Redirect logic
- [x] `/auth-guard.js` - Guard disabled
