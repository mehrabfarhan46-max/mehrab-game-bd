const API_URL = 'http://localhost:4000/api';

const loginForm = document.getElementById('loginForm');
const message = document.getElementById('message');
const loginButton = document.getElementById('loginButton');

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  message.textContent = '';
  loginButton.disabled = true;
  loginButton.textContent = 'Logging in...';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Login failed.');
    }

    // Store the token for this browser session only.
    sessionStorage.setItem('adminToken', data.token);
    sessionStorage.setItem(
      'adminProfile',
      JSON.stringify(data.admin)
    );

    message.style.color = '#55e6a5';
    message.textContent = 'Login successful!';

    window.location.href = 'dashboard.html';

  } catch (error) {
    message.style.color = '#ff9c9c';
    message.textContent =
      error.message === 'Failed to fetch'
        ? 'Server is unavailable. Please try again later.'
        : error.message;

  } finally {
    loginButton.disabled = false;
    loginButton.textContent = 'Login';
  }
});