
const API = 'http://localhost:4000/api/admin';

const users = document.getElementById('users');
const orders = document.getElementById('orders');
const tournaments = document.getElementById('tournaments');
const packages = document.getElementById('packages');
const message = document.getElementById('message');
const adminProfile = document.getElementById('adminProfile');
const refreshButton = document.getElementById('refreshButton');
const logoutButton = document.getElementById('logoutButton');

function getToken() {
  return sessionStorage.getItem('adminToken');
}

function logout() {
  sessionStorage.removeItem('adminToken');
  sessionStorage.removeItem('adminProfile');
  window.location.href = 'login.html';
}

async function apiRequest(path) {
  const response = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${getToken()}`
    }
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    logout();
    throw new Error('Admin login required.');
  }

  if (!response.ok) {
    throw new Error(data.message || 'Could not load dashboard.');
  }

  return data;
}

async function loadDashboard() {
  message.textContent = 'Loading dashboard...';

  try {
    const [dashboardData, profileData, diamondData, likesData] =
      await Promise.all([
        apiRequest('/dashboard'),
        apiRequest('/me'),
        apiRequest('/packages'),
        apiRequest('/likes')
      ]);

    const stats = dashboardData.stats || dashboardData;

    users.textContent = stats.users ?? 0;
    orders.textContent = stats.orders ?? 0;
    tournaments.textContent = stats.tournaments ?? 0;

    const diamondCount = (diamondData.packages || []).length;
    const likesCount = (likesData.likes || []).length;

    packages.textContent = diamondCount + likesCount;

    const profile = profileData.admin || profileData;

    adminProfile.textContent =
      `Logged in as: ${profile.name || profile.email || 'Admin'}`;

    message.textContent = 'Dashboard updated.';
    message.style.color = '#087b54';

  } catch (error) {
    message.textContent = error.message;
    message.style.color = '#dc2626';
  }
}

refreshButton.addEventListener('click', loadDashboard);
logoutButton.addEventListener('click', logout);

if (!getToken()) {
  logout();
} else {
  loadDashboard();
}
