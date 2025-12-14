import { createClient } from 'npm:@supabase/supabase-js@2';

const DEFAULT_SUPABASE_URL = 'https://siumiadylwcrkaqsfwkj.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdW1pYWR5bHdjcmthcXNmd2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NjMzMTMsImV4cCI6MjA4MTIzOTMxM30.sSZBsXyOOmIp2eve_SpiUGeIwx3BMoxvY4c7bvE2kKw';

const supabaseUrl = process.env?.SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = process.env?.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase configuration is missing. Ensure SUPABASE_URL and SUPABASE_ANON_KEY are set.');
}

export const supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey);
