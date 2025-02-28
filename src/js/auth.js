// Authentication functions for the AI education platform
// Uses Supabase Auth directly in the browser

// Initialize Supabase client
const supabase = window.supabase.createClient(
  window.appConfig.supabase.url,
  window.appConfig.supabase.publicKey
);

// User state
let currentUser = null;

// Initialize auth state
async function initAuth() {
  // Check if user is already logged in
  const { data, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('Error checking authentication status:', error.message);
    return;
  }
  
  if (data.session) {
    currentUser = data.session.user;
    updateUIForAuthenticatedUser();
  }
  
  // Set up auth state change listener
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      currentUser = session.user;
      updateUIForAuthenticatedUser();
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      updateUIForUnauthenticatedUser();
    }
  });
}

// Sign in with email and password
async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) {
    return { success: false, message: error.message };
  }
  
  currentUser = data.user;
  return { success: true, user: data.user };
}

// Sign up with email and password
async function signUp(email, password, metadata = {}) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata
    }
  });
  
  if (error) {
    return { success: false, message: error.message };
  }
  
  return { 
    success: true, 
    user: data.user,
    message: 'Please check your email for a confirmation link.'
  };
}

// Sign out
async function signOut() {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    console.error('Error signing out:', error.message);
    return false;
  }
  
  currentUser = null;
  return true;
}

// Reset password
async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reset-password.html',
  });
  
  if (error) {
    return { success: false, message: error.message };
  }
  
  return { 
    success: true,
    message: 'Please check your email for a password reset link.'
  };
}

// Update user profile
async function updateProfile(userData) {
  const { data, error } = await supabase.auth.updateUser({
    data: userData
  });
  
  if (error) {
    return { success: false, message: error.message };
  }
  
  currentUser = data.user;
  return { success: true, user: data.user };
}

// Get current user
function getCurrentUser() {
  return currentUser;
}

// Update UI for authenticated user
function updateUIForAuthenticatedUser() {
  // Find navigation auth container across pages
  const navAuthContainer = document.getElementById('nav-auth-container');
  if (navAuthContainer) {
    navAuthContainer.innerHTML = `
      <a href="/dashboard.html" class="text-gray-700 hover:text-primary-600">Dashboard</a>
      <button id="logout-button" class="btn btn-primary">Log out</button>
    `;
    
    // Add logout event listener
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
      logoutButton.addEventListener('click', async () => {
        await signOut();
        window.location.href = '/';
      });
    }
  }
}

// Update UI for unauthenticated user
function updateUIForUnauthenticatedUser() {
  // Find navigation auth container across pages
  const navAuthContainer = document.getElementById('nav-auth-container');
  if (navAuthContainer) {
    navAuthContainer.innerHTML = `
      <a href="/login.html" class="text-gray-700 hover:text-primary-600">Log in</a>
      <a href="/register.html" class="btn btn-primary">Sign up</a>
    `;
  }
}

// Initialize auth when the DOM is loaded
document.addEventListener('DOMContentLoaded', initAuth);

// Export auth functions globally
window.auth = {
  signIn,
  signUp,
  signOut,
  resetPassword,
  updateProfile,
  getCurrentUser
};
