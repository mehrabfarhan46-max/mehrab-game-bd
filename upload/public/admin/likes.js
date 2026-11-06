
const API = 'http://localhost:4000/api/admin/likes';

const form = document.getElementById('likesForm');
const list = document.getElementById('adminLikesList');
const message = document.getElementById('likesMessage');
const saveButton = document.getElementById('saveLikesButton');
const cancelButton = document.getElementById('cancelLikesEdit');

let editingId = null;
let likesData = [];

async function request(url, options = {}) {
  const token = sessionStorage.getItem('adminToken');

  if (!token) {
    window.location.href = 'login.html';
    throw new Error('Admin login পাওয়া যায়নি। আবার Login করো।');
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  const data = await response.json();

  if (response.status === 401) {
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminProfile');
    window.location.href = 'login.html';
    throw new Error('Session শেষ হয়েছে। আবার Login করো।');
  }

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Request failed.');
  }

  return data;
}

function showMessage(text, success = false) {
  message.textContent = text;
  message.style.color = success ? '#16803c' : '#dc2626';
}

function resetForm() {
  form.reset();
  editingId = null;
  document.getElementById('formTitle').textContent =
    'Add Likes Package';
  saveButton.textContent = 'Add Package';
  cancelButton.hidden = true;
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function renderLikes() {
  list.innerHTML = '';

  if (!likesData.length) {
    list.textContent = 'No Likes packages found.';
    return;
  }

  likesData.forEach(item => {
    const card = document.createElement('article');
    card.className = 'admin-like-card';

    card.innerHTML = `
      <h3>${escapeHTML(item.name_en)}</h3>
      <p>${escapeHTML(item.name_bn || '')}</p>
      <p>Platform: ${escapeHTML(item.platform || 'N/A')}</p>
      <p>Quantity: ${Number(item.quantity).toLocaleString()}</p>
      <h3>৳${Number(item.price).toFixed(2)}</h3>
      <p>Status: ${item.is_active ? 'Active' : 'Inactive'}</p>
      <button class="edit-like" type="button">Edit</button>
      <button class="status-like" type="button">
        ${item.is_active ? 'Deactivate' : 'Activate'}
      </button>
    `;

    const buttons = card.querySelectorAll('button');

    buttons[0].addEventListener('click', () => startEdit(item));
    buttons[1].addEventListener('click', () => toggleStatus(item));

    list.appendChild(card);
  });
}

async function loadLikes() {
  list.textContent = 'Loading packages...';

  try {
    const data = await request(API);
    likesData = data.likes || [];
    renderLikes();
  } catch (error) {
    list.textContent = error.message;
  }
}

function startEdit(item) {
  editingId = item.id;

  document.getElementById('name_en').value = item.name_en;
  document.getElementById('name_bn').value = item.name_bn || '';
  document.getElementById('platform').value = item.platform || '';
  document.getElementById('quantity').value = item.quantity;
  document.getElementById('price').value = item.price;

  document.getElementById('formTitle').textContent =
    'Edit Likes Package';

  saveButton.textContent = 'Update Package';
  cancelButton.hidden = false;

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function toggleStatus(item) {
  const action = item.is_active ? 'Deactivate' : 'Activate';

  if (!confirm(`${action} ${item.name_en}?`)) return;

  try {
    await request(`${API}/${item.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        is_active: !item.is_active
      })
    });

    showMessage('Package status updated.', true);
    await loadLikes();
  } catch (error) {
    showMessage(error.message);
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();

  const payload = {
    name_en: document.getElementById('name_en').value.trim(),
    name_bn: document.getElementById('name_bn').value.trim() || null,
    platform: document.getElementById('platform').value.trim() || null,
    quantity: Number(document.getElementById('quantity').value),
    price: Number(document.getElementById('price').value)
  };

  saveButton.disabled = true;
  saveButton.textContent = 'Saving...';

  try {
    if (editingId !== null) {
      await request(`${API}/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });

      showMessage('Likes package updated successfully.', true);
    } else {
      await request(API, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      showMessage('Likes package added successfully.', true);
    }

    resetForm();
    await loadLikes();
  } catch (error) {
    showMessage(error.message);
  } finally {
    saveButton.disabled = false;

    if (editingId === null) {
      saveButton.textContent = 'Add Package';
    } else {
      saveButton.textContent = 'Update Package';
    }
  }
});

cancelButton.addEventListener('click', resetForm);

document.getElementById('refreshLikesButton')
  .addEventListener('click', loadLikes);

loadLikes();
