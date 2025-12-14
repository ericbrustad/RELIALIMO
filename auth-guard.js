// Authentication Guard
// Protects pages that require authentication

import { supabase } from './supabase-client.js';

export class AuthGuard {
  static async checkAuth() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.log('⚠️ No active session, redirecting to auth...');
        window.location.href = 'auth.html';
        return false;
      }

      console.log('✅ User authenticated:', session.user.email);
      return true;

    } catch (error) {
      console.error('❌ Auth check error:', error);
      window.location.href = 'auth.html';
      return false;
    }
  }

  static async protectPage() {
    const isAuthenticated = await this.checkAuth();
    if (!isAuthenticated) {
      // Hide content while redirecting
      document.body.style.opacity = '0';
      document.body.style.pointerEvents = 'none';
    }
    return isAuthenticated;
  }

  static setupAuthListener(callback) {
    supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔐 Auth state changed:', event);
      
      if (callback) {
        callback(event, session);
      }

      // If session lost, redirect to auth
      if (!session && event === 'SIGNED_OUT') {
        console.log('⚠️ Session lost, redirecting...');
        setTimeout(() => {
          window.location.href = 'auth.html';
        }, 500);
      }
    });
  }
}

// Call on page load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🔐 Auth guard enabled - protecting page');
  try {
    await AuthGuard.protectPage();
    AuthGuard.setupAuthListener();
  } catch (error) {
    console.error('❌ Failed to initialize auth guard:', error);
  }
});

export default AuthGuard;
