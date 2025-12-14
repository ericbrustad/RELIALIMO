// Authentication Guard (disabled)
// Pages are now accessible without Supabase authentication

export class AuthGuard {
  static async checkAuth() {
    console.log('🔓 Authentication checks are disabled; allowing access.');
    return true;
  }

  static async protectPage() {
    return this.checkAuth();
  }

  static setupAuthListener(callback) {
    if (typeof callback === 'function') {
      callback('AUTH_DISABLED', null);
    }
  }
}

// Allow immediate page access
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await AuthGuard.protectPage();
  } catch (error) {
    console.error('❌ Failed to initialize auth guard:', error);
  }
});

export default AuthGuard;
