const API = 'http://localhost:4000/api/admin/packages';

const form = document.getElementById('packageForm');
const packageList = document.getElementById('packageList');
const message = document.getElementById('message');

const nameInput = document.getElementById('name');
const nameBnInput = document.getElementById('name_bn');
const categoryInput = document.getElementById('category');
const diamondsInput = document.getElementById('diamonds');
const priceInput = document.getElementById('price');
const imageInput = document.getElementById('image_url');
const sortInput = document.getElementById('sort_order');

const saveButton = document.getElementById('saveButton');
const cancelEditButton = document.getElementById('cancelEditButton');
const refreshButton = document.getElementById('refreshButton');

let editingId = null;
let packages = [];

function showMessage(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? '#dc2626' : '#15803d';
}

function getToken() {
  return sessionStorage.getItem('adminToken');
}

async function request(path = '', options = {}) {
  const token = getToken();

  if (!token) {
    throw new Error('Admin login পাওয়া যায়নি। আবার Admin Login করো।');
  }

  const response = await fetch(API + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    throw new Error(data.message || 'Request সফল হয়নি।');
  }

  return data;
}

function updateDiamondField() {
  const isDiamond = categoryInput.value === 'diamonds';

  diamondsInput.disabled = !isDiamond;
  diamondsInput.required = isDiamond;

  if (!isDiamond) {
    diamondsInput.value = '';
  }
}

function resetForm() {
  editingId = null;
  form.reset();

  categoryInput.value = 'diamonds';
  saveButton.textContent = 'Add Package';
  cancelEditButton.hidden = true;

  updateDiamondField();
}

function cancelEdit() {
  resetForm();
  showMessage('Edit বাতিল করা হয়েছে।');
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[char]);
}

function categoryName(category) {
  const names = {
    diamonds: 'Diamonds',
    weekly: 'Weekly Membership',
    monthly: 'Monthly Membership',
    levelup: 'Level Up Pass'
  };

  return names[category] || category;
}

async function loadPackages() {
  packageList.innerHTML = '<p>Loading packages...</p>';

  try {
    const data = await request();

    packages = data.packages || [];

    if (!packages.length) {
      packageList.innerHTML = '<p>কোনো Package পাওয়া যায়নি।</p>';
      return;
    }

    packageList.innerHTML = packages.map(item => `
      <div class="package-card">
        <h3>${escapeHTML(item.name_en)}</h3>

        <p>${escapeHTML(item.name_bn || '')}</p>

        <p>Category: ${escapeHTML(categoryName(item.category))}</p>

        ${
          item.category === 'diamonds'
            ? `<p>Diamond Amount: ${escapeHTML(item.diamonds)}</p>`
            : ''
        }

        <p>Price: ৳${escapeHTML(item.price)}</p>

        <p>Status:
          ${item.is_active ? 'Active' : 'Inactive'}
        </p>

        <div class="package-actions">
          <button
            type="button"
            class="edit"
            data-action="edit"
            data-id="${escapeHTML(item.id)}"
          >
            Edit
          </button>

          <button
            type="button"
            data-action="toggle"
            data-id="${escapeHTML(item.id)}"
          >
            ${item.is_active ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      </div>
    `).join('');

  } catch (error) {
    packageList.innerHTML = '';
    showMessage(error.message, true);
  }
}

function startEdit(id) {
  const item = packages.find(pkg => String(pkg.id) === String(id));

  if (!item) {
    showMessage('Package পাওয়া যায়নি।', true);
    return;
  }

  editingId = item.id;

  nameInput.value = item.name_en || '';
  nameBnInput.value = item.name_bn || '';
  categoryInput.value = item.category || 'diamonds';
  diamondsInput.value = item.diamonds ?? '';
  priceInput.value = item.price ?? '';
  imageInput.value = item.image_url || '';
  sortInput.value = item.sort_order ?? 0;

  updateDiamondField();

  saveButton.textContent = 'Save Changes';
  cancelEditButton.hidden = false;

  showMessage('Package Edit করো, তারপর Save Changes চাপো।');

  form.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}

async function togglePackage(id) {
  try {
    const item = packages.find(pkg => String(pkg.id) === String(id));

    if (!item) {
      throw new Error('Package পাওয়া যায়নি।');
    }

    await request(`/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        is_active: !item.is_active
      })
    });

    showMessage('Package Status পরিবর্তন হয়েছে।');
    await loadPackages();

  } catch (error) {
    showMessage(error.message, true);
  }
}

packageList.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');

  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.action;

  if (action === 'edit') {
    startEdit(id);
  }

  if (action === 'toggle') {
    togglePackage(id);
  }
});

categoryInput.addEventListener('change', updateDiamondField);

cancelEditButton.addEventListener('click', cancelEdit);

refreshButton.addEventListener('click', loadPackages);

form.addEventListener('submit', async event => {
  event.preventDefault();

  const isDiamond = categoryInput.value === 'diamonds';

  const packageData = {
    name_en: nameInput.value.trim(),
    name_bn: nameBnInput.value.trim() || null,
    category: categoryInput.value,
    diamonds: isDiamond ? Number(diamondsInput.value) : null,
    price: Number(priceInput.value),
    image_url: imageInput.value.trim() || null,
    sort_order: Number(sortInput.value || 0)
  };

  if (!packageData.name_en) {
    showMessage('Package Name লিখো।', true);
    return;
  }

  if (isDiamond && (!Number.isInteger(packageData.diamonds) || packageData.diamonds <= 0)) {
    showMessage('সঠিক Diamond Amount লিখো।', true);
    return;
  }

  if (!Number.isFinite(packageData.price) || packageData.price < 0) {
    showMessage('সঠিক Price লিখো।', true);
    return;
  }

  saveButton.disabled = true;

  try {
    if (editingId !== null) {
      await request(`/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify(packageData)
      });

      resetForm();
      showMessage('Package সফলভাবে Update হয়েছে।');

    } else {
      await request('', {
        method: 'POST',
        body: JSON.stringify(packageData)
      });

      resetForm();
      showMessage('নতুন Package সফলভাবে Add হয়েছে।');
    }

    await loadPackages();

  } catch (error) {
    showMessage(error.message, true);

  } finally {
    saveButton.disabled = false;
  }
});

updateDiamondField();
cancelEditButton.hidden = true;
loadPackages();