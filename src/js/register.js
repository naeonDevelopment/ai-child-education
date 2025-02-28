// Registration page functionality

document.addEventListener('DOMContentLoaded', function() {
  const registerForm = document.getElementById('register-form');
  const registerError = document.getElementById('register-error');
  const registerSuccess = document.getElementById('register-success');
  
  if (registerForm) {
    registerForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      // Hide any previous messages
      registerError.style.display = 'none';
      registerSuccess.style.display = 'none';
      
      // Get form values
      const firstName = document.getElementById('first-name').value;
      const lastName = document.getElementById('last-name').value;
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirm-password').value;
      const termsAccepted = document.getElementById('terms').checked;
      
      // Validate form
      if (!termsAccepted) {
        registerError.textContent = 'You must accept the terms of service';
        registerError.style.display = 'block';
        return;
      }
      
      if (password !== confirmPassword) {
        registerError.textContent = 'Passwords do not match';
        registerError.style.display = 'block';
        return;
      }
      
      // Validate password strength
      if (!isPasswordStrong(password)) {
        registerError.textContent = 'Password must be at least 8 characters with a number, uppercase, and lowercase letter';
        registerError.style.display = 'block';
        return;
      }
      
      try {
        // Attempt to sign up
        const { success, message } = await window.auth.signUp(email, password, {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`
        });
        
        if (success) {
          // Show success message
          registerSuccess.style.display = 'block';
          registerForm.reset();
          
          // Optional: redirect after a delay
          setTimeout(() => {
            window.location.href = '/login.html';
          }, 3000);
        } else {
          // Show error message
          registerError.textContent = message || 'Registration failed';
          registerError.style.display = 'block';
        }
      } catch (error) {
        console.error('Registration error:', error);
        registerError.textContent = 'An unexpected error occurred';
        registerError.style.display = 'block';
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

// Password strength validation
function isPasswordStrong(password) {
  // At least 8 characters, one uppercase, one lowercase, one number
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return regex.test(password);
}
