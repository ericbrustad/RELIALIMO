// Environment Variables
export const SUPABASE_URL = window.ENV?.SUPABASE_URL;
export const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY;

// Supabase Configuration
export const supabaseConfig = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY
};

// Validate environment variables
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase environment variables. Make sure env.js is loaded before config.js');
}

// Get Supabase client (uses REST API - no SDK import needed)
export async function initSupabase() {
  // Import the supabase-client module which uses REST API
  const { default: supabase } = await import('./supabase-client.js');
  return supabase;
}
