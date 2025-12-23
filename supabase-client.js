// Supabase Client - REST API (Buildless Compatible)
// Pure fetch-based REST API client - no SDK dependency

import { getSupabaseCredentials } from './supabase-config.js';

// Get credentials from environment or window.ENV
export const { url: supabaseUrl, anonKey: supabaseAnonKey } = getSupabaseCredentials();

// Demo fallback credentials for offline auth
const OFFLINE_DEMO_ACCOUNTS = {
  'admin@relialimo.demo': {
    password: 'G0dD@mnNutj08!',
    role: 'admin'
  },
  'dispatcher@relialimo.demo': {
    password: 'DemoDispatcher123!',
    role: 'dispatcher'
  },
  'driver@relialimo.demo': {
    password: 'DemoDriver123!',
    role: 'driver'
  }
};

// Validate credentials
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials');
  throw new Error('Supabase configuration missing');
}

console.log('✅ Supabase REST API client initialized');

const SESSION_STORAGE_KEY = 'supabase_session';

function loadStoredSession() {
  try {
    const session = localStorage.getItem(SESSION_STORAGE_KEY);
    return session ? JSON.parse(session) : null;
  } catch (error) {
    console.error('❌ Failed to parse stored session:', error);
    return null;
  }
}

function persistSession(session) {
  if (!session) return;
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

  if (session.access_token) {
    localStorage.setItem('supabase_access_token', session.access_token);
  }

  notifySessionChange();
}

function notifySessionChange() {
  const session = loadStoredSession();
  window.dispatchEvent(new CustomEvent('supabase-session-change', { detail: session }));
}

function isOffline() {
  return typeof navigator !== 'undefined' && navigator?.onLine === false;
}

function isNetworkError(error) {
  return (
    error?.code === 'ENETUNREACH' ||
    error?.message?.includes('ENETUNREACH') ||
    error?.message?.includes('fetch failed') ||
    error?.message?.includes('Failed to fetch')
  );
}

function buildOfflineSession(email, role) {
  const session = {
    access_token: `offline-${Date.now()}`,
    user: {
      id: `offline-${role}-${Date.now()}`,
      email,
      role,
      is_demo: true
    }
  };

  persistSession(session);

  return {
    success: true,
    user: session.user,
    session,
    access_token: session.access_token
  };
}

// Mock Supabase client for buildless environment
// This is a minimal mock that allows imports to work without throwing errors
export const supabase = {
  url: supabaseUrl,
  key: supabaseAnonKey,
  auth: {
    getUser: async () => {
      const session = loadStoredSession();
      return { data: { user: session?.user || null }, error: null };
    },
    getSession: async () => {
      const session = loadStoredSession();
      return { data: { session: session || null }, error: null };
    },
    signInWithPassword: async ({ email, password }) => {
      const result = await signInWithEmail(email, password);

      if (!result.success) {
        return { data: null, error: { message: result.error || 'Sign in failed' } };
      }

      const session = result.session || {
        access_token: result.access_token,
        user: result.user
      };

      persistSession(session);

      return {
        data: {
          session,
          user: result.user
        },
        error: null
      };
    },
    signOut: async () => {
      const result = await signOut();
      return { error: result.success ? null : { message: result.error || 'Sign out failed' } };
    },
    onAuthStateChange: (callback) => {
      console.log('ℹ️ Auth state listener registered');

      const handler = (event) => {
        const session = event?.detail ?? loadStoredSession();
        const eventName = session ? 'SIGNED_IN' : 'SIGNED_OUT';
        callback?.(eventName, session);
      };

      // Fire once with the current state
      handler({ detail: loadStoredSession() });

      window.addEventListener('storage', handler);
      window.addEventListener('supabase-session-change', handler);

      return () => {
        window.removeEventListener('storage', handler);
        window.removeEventListener('supabase-session-change', handler);
      };
    }
  },
  from: (table) => new PostgrestQuery(table)
};

class PostgrestQuery {
  constructor(table) {
    this.table = table;
    this.method = 'GET';
    this.filters = [];
    this.orderBy = null;
    this.selectColumns = null;
    this.body = undefined;
    this.returnRepresentation = false;
    this.expectSingle = false;
    this._limit = null;
  }

  select(columns = '*') {
    this.selectColumns = columns;
    if (this.method === 'POST' || this.method === 'PATCH' || this.method === 'DELETE') {
      this.returnRepresentation = true;
    } else {
      this.method = 'GET';
    }
    return this;
  }

  insert(rows) {
    this.method = 'POST';
    this.body = rows;
    return this;
  }

  update(values) {
    this.method = 'PATCH';
    this.body = values;
    return this;
  }

  delete() {
    this.method = 'DELETE';
    return this;
  }

  eq(column, value) {
    this.filters.push({ op: 'eq', column, value });
    return this;
  }

  order(column, options = {}) {
    const dir = options.ascending === false ? 'desc' : 'asc';
    this.orderBy = { column, dir };
    return this;
  }

  single() {
    this.expectSingle = true;
    return this;
  }

  limit(n) {
    this._limit = typeof n === 'number' ? Math.max(0, Math.floor(n)) : null;
    return this;
  }

  async execute() {
    const token = localStorage.getItem('supabase_access_token') || supabaseAnonKey;

    const url = new URL(`${supabaseUrl}/rest/v1/${this.table}`);

    if (this.selectColumns) {
      url.searchParams.set('select', this.selectColumns);
    }

    if (this.orderBy?.column) {
      url.searchParams.set('order', `${this.orderBy.column}.${this.orderBy.dir}`);
    }

    if (this._limit != null) {
      url.searchParams.set('limit', String(this._limit));
    }

    this.filters.forEach(f => {
      url.searchParams.append(f.column, `${f.op}.${f.value}`);
    });

    const headers = {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`
    };

    if (this.expectSingle) {
      headers.Accept = 'application/vnd.pgrst.object+json';
    }

    if (this.returnRepresentation) {
      headers.Prefer = 'return=representation';
    }

    const hasBody = this.method === 'POST' || this.method === 'PATCH';
    if (hasBody) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url.toString(), {
      method: this.method,
      headers,
      body: hasBody ? JSON.stringify(this.body ?? {}) : undefined
    });

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json') || contentType.includes('+json');

    const payload = response.status === 204
      ? null
      : (isJson ? await response.json().catch(() => null) : await response.text().catch(() => null));

    if (!response.ok) {
      const message = (payload && typeof payload === 'object' && (payload.message || payload.error_description || payload.error))
        ? (payload.message || payload.error_description || payload.error)
        : `Supabase request failed (${response.status})`;

      return {
        data: null,
        error: {
          status: response.status,
          message,
          details: payload
        }
      };
    }

    return { data: payload, error: null };
  }

  then(onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected);
  }

  catch(onRejected) {
    return this.execute().catch(onRejected);
  }

  finally(onFinally) {
    return this.execute().finally(onFinally);
  }
}

// Test connection via simple REST request
export async function testSupabaseConnection() {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });
    
    if (response.ok) {
      console.log('✅ Supabase REST API connected successfully');
      return true;
    } else {
      console.error('❌ Supabase REST API connection failed:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Connection test error:', error);
    return false;
  }
}

// Get current user from localStorage (session-based auth)
export async function getCurrentUser() {
  try {
    const session = loadStoredSession();
    return session?.user || null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Get current session from localStorage
export async function getCurrentSession() {
  try {
    return loadStoredSession();
  } catch (error) {
    console.error('Error getting current session:', error);
    return null;
  }
}

// Sign in with email/password via REST API
export async function signInWithEmail(email, password) {
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password
      })
    });
    
    const data = await response.json();
    
    if (!response.ok || data.error) {
      console.error('❌ Sign in error:', data.error || data.error_description);
      return { success: false, error: data.error || 'Sign in failed' };
    }
    
    // Store session
    persistSession(data);

    console.log('✅ Signed in:', email);
    return {
      success: true,
      user: data.user,
      session: data,
      access_token: data.access_token
    };
  } catch (error) {
    console.error('❌ Sign in exception:', error);

    const lowerEmail = email?.toLowerCase();
    const offlineAccount = OFFLINE_DEMO_ACCOUNTS[lowerEmail];

    const canUseOfflineDemo =
      offlineAccount &&
      offlineAccount.password === password &&
      (isOffline() || isNetworkError(error));

    if (canUseOfflineDemo) {
      console.warn('⚠️ Network unavailable, using offline demo session');
      return buildOfflineSession(lowerEmail, offlineAccount.role);
    }

    const errorMessage = isOffline() || isNetworkError(error)
      ? 'Network unavailable. Please check your connection and try again.'
      : error.message;

    return { success: false, error: errorMessage };
  }
}

// Sign out
export async function signOut() {
  try {
    // Clear session from localStorage
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem('supabase_access_token');

    notifySessionChange();
    
    console.log('✅ Signed out');
    return { success: true };
  } catch (error) {
    console.error('❌ Sign out exception:', error);
    return { success: false, error: error.message };
  }
}

// Get stored auth token
export function getAuthToken() {
  return localStorage.getItem('supabase_access_token');
}

// Set auth token
export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('supabase_access_token', token);
  } else {
    localStorage.removeItem('supabase_access_token');
  }
}

export default supabase;
