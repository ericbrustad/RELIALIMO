// Authentication removed: direct access to app

// Clear any persisted auth artifacts from previous builds
function clearStoredAuth() {
  try {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_role');
  } catch (error) {
    console.warn('Could not clear stored auth state:', error);
  }
}

function redirectToDashboard() {
  window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', () => {
  clearStoredAuth();

  const enterButton = document.getElementById('enterApp');
  if (enterButton) {
    enterButton.addEventListener('click', (event) => {
      event.preventDefault();
      redirectToDashboard();
    });
  } else {
    redirectToDashboard();
  }
});

export { clearStoredAuth, redirectToDashboard };
export default { clearStoredAuth, redirectToDashboard };
