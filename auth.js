// Authentication Module
import { supabase } from './supabase-client.js';

// DOM Elements - will be initialized on DOMContentLoaded
let signInForm;
let emailInput;
let passwordInput;
let errorMessage;
let successMessage;
let loadingOverlay;
let demoBtns;

// Demo credentials (for testing)
const DEMO_ACCOUNTS = {
  admin: {
    email: 'admin@relialimo.demo',
    password: 'G0dD@mnNutj08!'
  },
  dispatcher: {
    email: 'dispatcher@relialimo.demo',
    password: 'DemoDispatcher123!'
  },
  driver: {
    email: 'driver@relialimo.demo',
    password: 'DemoDriver123!'
  }
};

// ===================================
// INITIALIZATION
// ===================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🔐 Auth page loaded');
  console.log('📄 Document title:', document.title);
  console.log('📍 Current URL:', window.location.href);
  
  // Initialize DOM elements with fallback searches
  signInForm = document.getElementById('signInForm') || document.querySelector('form[id*="signIn"]') || document.querySelector('form.auth-form');
  emailInput = document.getElementById('email') || document.querySelector('input[type="email"]');
  passwordInput = document.getElementById('password') || document.querySelector('input[type="password"]');
  errorMessage = document.getElementById('errorMessage') || document.querySelector('.error-message');
  successMessage = document.getElementById('successMessage') || document.querySelector('.success-message');
  loadingOverlay = document.getElementById('loadingOverlay') || document.querySelector('.loading-overlay');
  demoBtns = document.querySelectorAll('.demo-btn') || [];
  
  // Debug logging
  console.log('✅ signInForm:', signInForm ? 'found' : 'NOT FOUND');
  console.log('✅ emailInput:', emailInput ? 'found' : 'NOT FOUND');
  console.log('✅ passwordInput:', passwordInput ? 'found' : 'NOT FOUND');
  console.log('✅ errorMessage:', errorMessage ? 'found' : 'NOT FOUND');
  console.log('✅ successMessage:', successMessage ? 'found' : 'NOT FOUND');
  console.log('✅ loadingOverlay:', loadingOverlay ? 'found' : 'NOT FOUND');
  console.log('✅ demoBtns count:', demoBtns.length);
  
  // Check if already signed in
  const session = await getSession();
  if (session) {
    console.log('✅ User already signed in, redirecting...');
    redirectToDashboard();
    return;
  }

  setupEventListeners();
});

// ===================================
// EVENT LISTENERS
// ===================================

function setupEventListeners() {
  console.log('🔐 Setting up auth event listeners...');
  
  // Check if we're actually on the auth page
  if (!signInForm && !demoBtns?.length) {
    console.log('ℹ️ Auth elements not found on this page - may not be auth.html, skipping listener setup');
    return;
  }
  
  // Sign in form submission
  if (signInForm) {
    try {
      signInForm.addEventListener('submit', handleSignIn);
      console.log('✅ Sign in form listener attached');
    } catch (e) {
      console.warn('⚠️ Could not attach sign in form listener:', e);
    }
  } else {
    console.log('ℹ️ Sign in form not found on this page');
  }

  // Demo account buttons
  if (demoBtns && demoBtns.length > 0) {
    try {
      demoBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const role = btn.dataset.role;
          handleDemoSignIn(role);
        });
      });
      console.log('✅ Demo buttons listeners attached:', demoBtns.length);
    } catch (e) {
      console.warn('⚠️ Could not attach demo button listeners:', e);
    }
  } else {
    console.log('ℹ️ No demo buttons found on this page');
  }
}

// ===================================
// SIGN IN HANDLER
// ===================================

async function handleSignIn(e) {
  e.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  // Clear previous messages
  clearMessages();

  // Validate
  if (!email || !password) {
    showError('Please enter both email and password');
    return;
  }

  // Show loading
  showLoading(true);

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('❌ Sign in error:', error);
      
      // Handle specific error messages
      if (error.message.includes('Invalid login credentials')) {
        showError('Invalid email or password');
      } else if (error.message.includes('Email not confirmed')) {
        showError('Please verify your email address');
      } else {
        showError(error.message || 'Sign in failed');
      }
      
      showLoading(false);
      return;
    }

    console.log('✅ Signed in successfully:', email);
    showSuccess('Sign in successful! Redirecting...');

    // Store session info
    if (data.session) {
      localStorage.setItem('auth_token', data.session.access_token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
    }

    // Redirect after short delay
    setTimeout(() => {
      redirectToDashboard();
    }, 800);

  } catch (error) {
    console.error('❌ Sign in exception:', error);
    showError('An unexpected error occurred');
    showLoading(false);
  }
}

// ===================================
// DEMO SIGN IN
// ===================================

async function handleDemoSignIn(role) {
  const credentials = DEMO_ACCOUNTS[role];
  
  if (!credentials) {
    showError('Invalid demo account');
    return;
  }

  console.log(`🎭 Demo sign in as ${role}...`);

  // Auto-fill form
  emailInput.value = credentials.email;
  passwordInput.value = credentials.password;

  // Show loading
  showLoading(true);

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password
    });

    if (error) {
      console.error('❌ Demo sign in error:', error);
      
      // For demo, create account if it doesn't exist
      if (error.message.includes('Invalid login credentials')) {
        console.log('📝 Demo account not found, creating...');
        await createDemoAccount(role, credentials);
        // Try signing in again
        setTimeout(() => handleDemoSignIn(role), 1000);
        return;
      }
      
      showError(`Demo sign in failed: ${error.message}`);
      showLoading(false);
      return;
    }

    console.log(`✅ Demo sign in successful as ${role}`);
    showSuccess(`Signed in as ${role}! Redirecting...`);

    // Store session
    if (data.session) {
      localStorage.setItem('auth_token', data.session.access_token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
      localStorage.setItem('auth_role', role);
    }

    // Redirect
    setTimeout(() => {
      redirectToDashboard();
    }, 800);

  } catch (error) {
    console.error('❌ Demo sign in exception:', error);
    showError('Demo sign in failed');
    showLoading(false);
  }
}

// ===================================
// CREATE DEMO ACCOUNT
// ===================================

async function createDemoAccount(role, credentials) {
  try {
    console.log(`🆕 Creating demo account for ${role}...`);

    const { data, error } = await supabase.auth.signUp({
      email: credentials.email,
      password: credentials.password,
      options: {
        data: {
          role: role,
          is_demo: true
        }
      }
    });

    if (error) {
      console.error('❌ Demo account creation error:', error);
      return;
    }

    console.log(`✅ Demo account created for ${role}`);
    return data;

  } catch (error) {
    console.error('❌ Demo account creation exception:', error);
  }
}

// ===================================
// SESSION MANAGEMENT
// ===================================

export async function getSession() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  } catch (error) {
    console.error('❌ Get session error:', error);
    return null;
  }
}

export async function getCurrentUser() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    console.error('❌ Get user error:', error);
    return null;
  }
}

export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('❌ Sign out error:', error);
      return false;
    }

    // Clear local storage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_role');

    console.log('✅ Signed out successfully');
    return true;

  } catch (error) {
    console.error('❌ Sign out exception:', error);
    return false;
  }
}

// ===================================
// UI HELPERS
// ===================================

function showLoading(show) {
  if (show) {
    loadingOverlay.style.display = 'flex';
    signInForm.style.opacity = '0.5';
    signInForm.style.pointerEvents = 'none';
  } else {
    loadingOverlay.style.display = 'none';
    signInForm.style.opacity = '1';
    signInForm.style.pointerEvents = 'auto';
  }
}

function showError(message) {
  errorMessage.textContent = '❌ ' + message;
  errorMessage.style.display = 'block';
  errorMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showSuccess(message) {
  successMessage.textContent = '✅ ' + message;
  successMessage.style.display = 'block';
  successMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearMessages() {
  errorMessage.style.display = 'none';
  successMessage.style.display = 'none';
}

// ===================================
// REDIRECT
// ===================================

function redirectToDashboard() {
  // Redirect to main app
  window.location.href = 'index.html';
}

export default {
  getSession,
  getCurrentUser,
  signOut,
  handleSignIn
};
