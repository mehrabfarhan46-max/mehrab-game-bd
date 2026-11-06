
const API = 'http://localhost:4000/api/admin/orders';

const orderList = document.getElementById('orderList');
const message = document.getElementById('message');

function getToken() {
  return sessionStorage.getItem('adminToken');
}

function logout() {
  sessionStorage.removeItem('adminToken');
  sessionStorage.removeItem('adminProfile');
  window.location.href = 'login.html';
}

function showMessage(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? '#dc2626' : '#087b54';
}

async function request(url, options = {}) {
  const token = getToken();

  if (!token) {
    logout();
    throw new Error('Admin login required.');
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401 || response.status === 403) {
    logout();
    throw new Error('Admin session expired.');
  }

  if (!response.ok) {
    throw new Error(data.message || 'Request failed.');
  }

  return data;
}

const statuses = [
  'pending',
  'processing',
  'completed',
  'rejected',
  'refunded'
];

async function updateStatus(orderId, status, button) {
  button.disabled = true;

  try {
    await request(
      `${API}/${encodeURIComponent(orderId)}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status })
      }
    );

    showMessage('Order status updated.');
    await loadOrders();
  } catch (error) {
    showMessage(error.message, true);
    button.disabled = false;
  }
}

async function loadOrders() {
  orderList.textContent = 'Loading orders...';

  try {
    const data = await request(API);
    const orders = data.orders || [];

    orderList.replaceChildren();

    if (!orders.length) {
      orderList.textContent = 'No orders found.';
      return;
    }

    orders.forEach((order) => {
      const card = document.createElement('div');
      card.className = 'order';

      const title = document.createElement('strong');
      title.textContent = `Order #${order.id}`;

      const details = document.createElement('p');
      details.textContent =
        `Type: ${order.type || 'N/A'} · Amount: ৳${order.total_amount ?? order.amount ?? 'N/A'}`;

      const statusText = document.createElement('p');
      statusText.textContent = `Current status: ${order.status}`;
      statusText.className = 'muted';

      const select = document.createElement('select');

      statuses.forEach((status) => {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status;
        option.selected = order.status === status;
        select.appendChild(option);
      });

      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Update Status';

      button.addEventListener('click', () => {
        updateStatus(order.id, select.value, button);
      });

      card.append(title, details, statusText, select, button);
      orderList.appendChild(card);
    });
  } catch (error) {
    orderList.textContent = 'Could not load orders.';
    showMessage(error.message, true);
  }
}

if (!getToken()) {
  logout();
} else {
  loadOrders();
}
