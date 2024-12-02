document.addEventListener('DOMContentLoaded', function() {
    const googleLoginButton = document.getElementById('googleLoginButton');
    const loginMessage = document.getElementById('loginMessage');

    function updateLoginMessage(message, isError = false) {
        loginMessage.textContent = message;
        loginMessage.style.color = isError ? 'red' : '#2f7283';
    }

    function checkAuthentication() {
        fetch('/api/checkAuth', { credentials: 'include' })
          .then(response => {
            if (!response.ok) {
              console.error('Failed to fetch /api/checkAuth:', response.status, response.statusText);
              throw new Error('Authentication check failed');
            }
            return response.json();
          })
          .then(data => {
            if (data.authenticated) {
              updateLoginMessage('Already authenticated. Redirecting to dashboard...');
              setTimeout(() => {
                window.location.href = '/dashboard.html';
              }, 1000);
            } else {
              updateLoginMessage('Please log in.');
            }
          })
          .catch(error => {
            console.error('Error checking authentication:', error);
            updateLoginMessage('Unable to check authentication status. Please try again.', true);
          });
      }

    googleLoginButton.addEventListener('click', () => {
        updateLoginMessage('Redirecting to Google login...');
        window.location.href = '/auth/google';
    });

    // Check for error message in URL
    const urlParams = new URLSearchParams(window.location.search);
    const errorMessage = urlParams.get('error');
    if (errorMessage) {
        updateLoginMessage(decodeURIComponent(errorMessage), true);
    } else {
        // Only check authentication if there's no error message
        checkAuthentication();
    }
});