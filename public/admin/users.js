
const API = 'http://localhost:4000/api/admin';

const userList = document.getElementById('userList');
const message = document.getElementById('message');
const search = document.getElementById('search');
const refreshButton = document.getElementById('refreshButton');

let allUsers = [];

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
    throw new Error(data.message || 'তথ্য লোড করা যায়নি।');
  }

  return data;
}

function renderUsers(list) {
  userList.replaceChildren();

  if (!list.length) {
    userList.textContent = 'কোনো ব্যবহারকারী পাওয়া যায়নি।';
    return;
  }

  list.forEach(user => {
    const card = document.createElement('article');
    card.className = 'user';

    const title = document.createElement('h3');
    title.textContent = user.name || 'নাম দেওয়া নেই';

    const email = document.createElement('p');
    email.textContent = `ইমেইল: ${user.email || 'নেই'}`;

    const id = document.createElement('p');
    id.textContent = `User ID: ${user.id}`;

    const balance = document.createElement('p');
    balance.textContent = `Wallet: ৳${user.wallet_balance ?? 0}`;

    const status = document.createElement('p');
    status.textContent = `অ্যাকাউন্ট: ${user.status}`;

    const profileButton = document.createElement('button');
    profileButton.type = 'button';
    profileButton.className = 'profile';
    profileButton.textContent = 'পূর্ণ প্রোফাইল দেখুন';

    profileButton.addEventListener('click', () => {
      window.location.href = `user-profile.html?id=${encodeURIComponent(user.id)}`;
    });

    card.append(title, email, id, balance, status, profileButton);
    userList.appendChild(card);
  });
}

async function loadUsers() {
  message.textContent = 'ব্যবহারকারীদের তালিকা লোড হচ্ছে...';

  try {
    const data = await apiRequest('/users');

    allUsers = data.users || [];
    renderUsers(allUsers);

    message.textContent = `মোট ব্যবহারকারী: ${allUsers.length}`;
    message.style.color = '#087b54';

  } catch (error) {
    message.textContent = error.message;
    message.style.color = '#dc2626';
  }
}

search.addEventListener('input', () => {
  const term = search.value.trim().toLowerCase();

  const filtered = allUsers.filter(user =>
    String(user.id).includes(term) ||
    (user.name || '').toLowerCase().includes(term) ||
    (user.email || '').toLowerCase().includes(term)
  );

  renderUsers(filtered);
});

refreshButton.addEventListener('click', loadUsers);

if (!getToken()) {
  logout();
} else {
  loadUsers();
}
