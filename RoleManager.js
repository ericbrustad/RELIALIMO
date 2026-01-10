/**
 * Role-Based Access Control System
 * Only ericbrustad@gmail.com has superadmin access
 * All other users have limited access to their own data only
 */

class RoleManager {
  static SUPERADMIN_EMAIL = 'ericbrustad@gmail.com';
  
  /**
   * Check if current user is the superadmin
   */
  static isSuperAdmin() {
    try {
      const sessionRaw = localStorage.getItem('supabase_session');
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw);
        const user = session?.user;
        return user?.email === this.SUPERADMIN_EMAIL;
      }
    } catch (e) {
      console.warn('Error checking superadmin status:', e);
    }
    return false;
  }
  
  /**
   * Get current user role
   */
  static getUserRole() {
    try {
      const sessionRaw = localStorage.getItem('supabase_session');
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw);
        const user = session?.user;
        
        if (user?.email === this.SUPERADMIN_EMAIL) {
          return 'superadmin';
        }
        
        if (user?.email) {
          return 'user';
        }
      }
    } catch (e) {
      console.warn('Error getting user role:', e);
    }
    return null;
  }
  
  /**
   * Get current user email
   */
  static getUserEmail() {
    try {
      const sessionRaw = localStorage.getItem('supabase_session');
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw);
        return session?.user?.email || null;
      }
    } catch (e) {
      console.warn('Error getting user email:', e);
    }
    return null;
  }
  
  /**
   * Check if user can access admin features
   */
  static canAccessAdmin() {
    return this.isSuperAdmin();
  }
  
  /**
   * Check if user can edit all data (superadmin only)
   */
  static canEditAllData() {
    return this.isSuperAdmin();
  }
  
  /**
   * Check if user can only see their own data
   */
  static canOnlySeeOwnData() {
    const role = this.getUserRole();
    return role === 'user';
  }
  
  /**
   * Apply data filtering based on user role
   */
  static filterDataForUser(data, userEmailField = 'user_email') {
    if (this.isSuperAdmin()) {
      // Superadmin sees all data
      return data;
    }
    
    const userEmail = this.getUserEmail();
    if (!userEmail) {
      return []; // No access if not logged in
    }
    
    // Regular users only see their own data
    return Array.isArray(data) 
      ? data.filter(item => item[userEmailField] === userEmail)
      : (data[userEmailField] === userEmail ? data : null);
  }
  
  /**
   * Show/hide UI elements based on role
   */
  static applyRoleBasedUI() {
    const isSuperAdmin = this.isSuperAdmin();
    
    // Hide admin-only elements for regular users
    const adminElements = document.querySelectorAll('[data-admin-only]');
    adminElements.forEach(el => {
      el.style.display = isSuperAdmin ? '' : 'none';
    });
    
    // Show user-only elements for regular users
    const userElements = document.querySelectorAll('[data-user-only]');
    userElements.forEach(el => {
      el.style.display = isSuperAdmin ? 'none' : '';
    });
    
    // Add role class to body for CSS targeting
    document.body.classList.remove('role-superadmin', 'role-user');
    if (isSuperAdmin) {
      document.body.classList.add('role-superadmin');
    } else if (this.getUserEmail()) {
      document.body.classList.add('role-user');
    }
  }
}

// Auto-apply role-based UI when loaded
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    RoleManager.applyRoleBasedUI();
  });
  
  // Re-apply when storage changes (login/logout)
  window.addEventListener('storage', (e) => {
    if (e.key === 'supabase_session') {
      setTimeout(() => RoleManager.applyRoleBasedUI(), 100);
    }
  });
}

// Global access
window.RoleManager = RoleManager;