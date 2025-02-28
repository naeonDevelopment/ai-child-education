// Login page functionality

document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  
  if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      // Hide any previous error messages
      loginError.style.display = 'none';
      
      // Get form values
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      
      try {
        // Attempt to sign in
        const { success, message } = await window.auth.signIn(email, password);
        
        if (success) {
          // Redirect to dashboard on success
          window.location.href = '/chat.html';
        } else {
          // Show error message
          loginError.textContent = message || 'Invalid email or password';
          loginError.style.display = 'block';
        }
      } catch (error) {
        console.error('Login error:', error);
        loginError.textContent = 'An unexpected error occurred';
        loginError.style.display = 'block';
      }
    });
  }
  
  // Check if user is already logged in
  const currentUser = window.auth?.getCurrentUser();
  if (currentUser) {
    // Redirect already logged in users
    window.location.href = '/chat.html';
  }
});
