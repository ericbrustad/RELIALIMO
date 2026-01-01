import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getSupabaseCredentials, getSupabaseAuthUrl } from './supabase-config.js';

const { anonKey: SUPABASE_ANON_KEY } = getSupabaseCredentials();
const SUPABASE_URL = getSupabaseAuthUrl();

// Create Supabase client with proper auth configuration
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// --- AUTH LOGIC ---

// Function to handle redirection
const handleAuth = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const isAuthPage = window.location.pathname.endsWith('/auth.html');

  if (!session && !isAuthPage) {
    console.log('AuthGuard: No session, redirecting to login.');
    window.location.replace('/auth.html');
  } else if (session && isAuthPage) {
    console.log('AuthGuard: Session found on auth page, redirecting to app.');
    window.location.replace('/');
  } else {
    console.log('AuthGuard: Auth check passed.');
  }
};

// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  console.log(`AuthGuard: Auth state changed. Event: ${event}`);
  const isAuthPage = window.location.pathname.endsWith('/auth.html');

  if (event === 'SIGNED_OUT') {
    if (!isAuthPage) {
      window.location.replace('/auth.html');
    }
  } else if (event === 'SIGNED_IN' && isAuthPage) {
    window.location.replace('/');
  }
  
  // Sync session to localStorage for other parts of the app
  if (session) {
    localStorage.setItem('supabase_session', JSON.stringify(session));
    if (session.access_token) {
      localStorage.setItem('supabase_access_token', session.access_token);
    }
  } else {
    localStorage.removeItem('supabase_session');
    localStorage.removeItem('supabase_access_token');
  }
});

// Initial auth check on page load
handleAuth();

export { supabase };

