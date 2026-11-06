const API = 'http://localhost:4000/api/admin';

const message = document.getElementById('message');

function getToken() {
  return sessionStorage.getItem('adminToken');
}

function logout() {
  sessionStorage.removeItem('adminToken');
  sessionStorage.removeItem('adminProfile');
  window.location.href = 'login.html';
}

document.getElementById('backButton').addEventListener('click', () => {
  window.location.href = 'users.html';
});

function showValue(containerId, label, value) {
  const item = document.createElement('div');
  item.className = 'item';

  const small = document.createElement('small');
  small.textContent = label;

  const strong = document.createElement('strong');
  strong.textContent = value ?? 'তথ্য নেই';

  item.append(small, strong);
  document.getElementById(containerId).appendChild(item);
}

function showRecords(containerId, records, fields) {
  const container = document.getElementById(containerId);
  container.replaceChildren();

  if (!Array.isArray(records) || records.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'এখনো কোনো তথ্য নেই।';
    container.appendChild(empty);
    return;
  }

  records.forEach(record => {
    const row = document.createElement('div');
    row.className = 'record';

    fields.forEach(([label, key, formatter]) => {
      const line = document.createElement('p');
      let value = record[key];

      if (formatter) value = formatter(value);

      line.textContent = `${label}: ${
        value === null || value === undefined || value === ''
          ? 'তথ্য নেই'
          : value
      }`;

      row.appendChild(line);
    });

    container.appendChild(row);
  });
}

function formatDate(value) {
  if (!value) return 'তথ্য নেই';

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString('bn-BD');
}

async function loadProfile() {
  if (!getToken()) {
    logout();
    return;
  }

  const userId = new URLSearchParams(location.search).get('id');

  if (!userId) {
    message.textContent = 'ব্যবহারকারীর ID পাওয়া যায়নি।';
    return;
  }

  message.textContent = 'প্রোফাইল লোড হচ্ছে...';

  try {
    const response = await fetch(
      `${API}/users/${encodeURIComponent(userId)}`,
      {
        headers: {
          Authorization: `Bearer ${getToken()}`
        }
      }
    );

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      logout();
      return;
    }

    if (!response.ok) {
      throw new Error(data.message || 'প্রোফাইল লোড করা যায়নি।');
    }

    const user = data.user || {};

    document.getElementById('accountInfo').replaceChildren();

    showValue('accountInfo', 'নাম', user.name);
    showValue('accountInfo', 'ইমেইল', user.email);
    showValue('accountInfo', 'ফোন', user.phone);
    showValue('accountInfo', 'User ID', user.id);
    showValue('accountInfo', 'Free Fire ID', user.ff_player_id);
    showValue('accountInfo', 'Free Fire নাম', user.ff_ingame_name);
    showValue('accountInfo', 'ভাষা', user.language);
    showValue('accountInfo', 'অ্যাকাউন্টের অবস্থা', user.status);
    showValue('accountInfo', 'তৈরির তারিখ', formatDate(user.created_at));

    document.getElementById('walletInfo').replaceChildren();

    showValue(
      'walletInfo',
      'বর্তমান ব্যালেন্স',
      `৳${user.wallet_balance ?? 0}`
    );

    showRecords('walletHistory', data.walletTransactions, [
      ['লেনদেনের ধরন', 'type'],
      ['পরিমাণ', 'amount'],
      ['বিবরণ', 'description'],
      ['তারিখ', 'created_at', formatDate]
    ]);

    showRecords('orders', data.orders, [
      ['অর্ডার ID', 'id'],
      ['অর্ডারের ধরন', 'type'],
      ['ডায়মন্ড প্যাকেজ', 'diamond_package_name'],
      ['লাইক সার্ভিস', 'like_service_name'],
      ['প্রোডাক্ট', 'product_name'],
      ['টার্গেট', 'target'],
      ['পরিমাণ', 'amount'],
      ['অবস্থা', 'status'],
      ['অ্যাডমিন নোট', 'admin_note'],
      ['তারিখ', 'created_at', formatDate]
    ]);

    showRecords('tournaments', data.tournamentHistory, [
      ['টুর্নামেন্ট', 'tournament_title'],
      ['ম্যাচ ID', 'tournament_id'],
      ['মোড', 'mode'],
      ['অংশগ্রহণের অবস্থা', 'participation_status'],
      ['প্লেসমেন্ট', 'placement'],
      ['কিল', 'kills'],
      ['পয়েন্ট', 'points'],
      ['পুরস্কার', 'prize_text'],
      ['বিজয়ী', 'is_winner'],
      ['শুরুর সময়', 'starts_at', formatDate],
      ['রেজিস্ট্রেশনের তারিখ', 'registered_at', formatDate]
    ]);

    showRecords('loginHistory', data.loginHistory, [
      ['লগইনের মাধ্যম', 'login_method'],
      ['লগইনের সময়', 'logged_in_at', formatDate]
    ]);

    showRecords('notifications', data.notifications, [
      ['শিরোনাম', 'title'],
      ['বার্তা', 'body'],
      ['পড়া হয়েছে', 'is_read'],
      ['তারিখ', 'created_at', formatDate]
    ]);

    showRecords('supportTickets', data.supportTickets, [
      ['টিকিট ID', 'id'],
      ['বিষয়', 'subject'],
      ['বার্তা', 'message'],
      ['উত্তর', 'reply'],
      ['অবস্থা', 'status'],
      ['তারিখ', 'created_at', formatDate]
    ]);

    message.textContent = 'প্রোফাইলের তথ্য লোড হয়েছে।';

  } catch (error) {
    message.textContent = error.message;
  }
}

loadProfile();