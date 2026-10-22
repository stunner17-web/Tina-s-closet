const API = 'http://localhost:5000/api';

const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const productList = document.getElementById('productList');

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// reads the quantity boxes of a group, e.g. getSizeQuantities('pSizeQty')
// returns something like { "8": 3, "10": 5 } (sizes with 0 are left out)
function getSizeQuantities(groupName) {
  const result = {};
  document.querySelectorAll(`input[name="${groupName}"]`).forEach((input) => {
    const qty = Number(input.value) || 0;
    if (qty > 0) result[input.dataset.size] = qty;
  });
  return result;
}

// fills the quantity boxes of a group from an object like { "8": 3 }
function setSizeQuantities(groupName, sizes) {
  document.querySelectorAll(`input[name="${groupName}"]`).forEach((input) => {
    input.value = (sizes && sizes[input.dataset.size]) || 0;
  });
}

// turns { "8": 3, "10": 5 } into "8 (3), 10 (5)"
function formatSizes(sizes) {
  return Object.entries(sizes || {})
    .filter(([, qty]) => qty > 0)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([size, qty]) => `${size} (${qty})`)
    .join(', ');
}


let allProducts = [];

async function loadProducts() {
  productList.innerHTML = '<p>Loading...</p>';
  try {
    const res = await fetch(`${API}/products`);
    allProducts = await res.json();

    productList.innerHTML = allProducts.map((p) => {
      const sizesText = formatSizes(p.sizes);
      return `
      <div class="product-row">
        <img src="${escapeHtml(p.images[0])}" alt="">
        <div class="info">
          <strong>${escapeHtml(p.name)}</strong>
          <span>${escapeHtml(p.category)} · $${p.price.toFixed(2)}</span>
          <span>${p.stock > 0 ? `Stock: ${p.stock}` : 'OUT OF STOCK'}${p.isNewArrival ? ' · New Arrival' : ''}${p.isBestSeller ? ' · Best Seller' : ''}</span>
          ${sizesText ? `<span>Sizes: ${escapeHtml(sizesText)}</span>` : ''}
        </div>
        <div class="actions">
          <button class="edit-btn" data-id="${p.id}">Edit</button>
          <button class="delete-btn" data-id="${p.id}" data-name="${escapeHtml(p.name)}">Delete</button>
        </div>
      </div>
    `;
    }).join('');
  } catch (err) {
    productList.innerHTML = '<p>Could not load products.</p>';
  }
}


function showDashboard() {
  loginView.hidden = true;
  dashboardView.hidden = false;
  loadProducts();
  loadOrders();
}

function showLogin() {
  dashboardView.hidden = true;
  loginView.hidden = false;
}

// stay logged in until the tab is closed
if (sessionStorage.getItem('adminToken')) {
  showDashboard();
} else {
  showLogin();
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';

  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: document.getElementById('email').value,
        password: document.getElementById('password').value
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    sessionStorage.setItem('adminToken', data.token);
    loginForm.reset();
    showDashboard();
  } catch (err) {
    loginError.textContent = err.message;
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  sessionStorage.removeItem('adminToken');
  showLogin();
});



const addForm = document.getElementById('addForm');
const addMessage = document.getElementById('addMessage');

addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  addMessage.textContent = '';
  addMessage.style.color = '#b91c1c';

  const token = sessionStorage.getItem('adminToken');
  const button = addForm.querySelector('button');
  button.disabled = true;
  button.textContent = 'Adding...';

  try {
    // 1. upload the photo
    const formData = new FormData();
    formData.append('image', document.getElementById('pImage').files[0]);

    const uploadRes = await fetch(`${API}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    if (uploadRes.status === 401) {
      sessionStorage.removeItem('adminToken');
      showLogin();
      return;
    }
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');

    // 2. create the product with that photo
    const res = await fetch(`${API}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: document.getElementById('pName').value,
        category: document.getElementById('pCategory').value,
        price: document.getElementById('pPrice').value,
        description: document.getElementById('pDescription').value,
        isNewArrival: document.getElementById('pNew').checked,
        isBestSeller: document.getElementById('pBest').checked,
        sizes: getSizeQuantities('pSizeQty'),
        images: [uploadData.url]
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not add product');

    addForm.reset();
    addMessage.style.color = '#15803d';
    addMessage.textContent = 'Product added';
    loadProducts();
  } catch (err) {
    addMessage.textContent = err.message;
  } finally {
    button.disabled = false;
    button.textContent = 'Add product';
  }
});



productList.addEventListener('click', async (e) => {
  const btn = e.target.closest('.delete-btn');
  if (!btn) return;

  const { id, name } = btn.dataset;
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

  const token = sessionStorage.getItem('adminToken');

  try {
    const res = await fetch(`${API}/products/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 401) {
      sessionStorage.removeItem('adminToken');
      showLogin();
      return;
    }
    if (!res.ok) throw new Error('Delete failed');

    loadProducts();
  } catch (err) {
    alert('Could not delete the product.');
  }
});


const editDialog = document.getElementById('editDialog');

productList.addEventListener('click', (e) => {
  const btn = e.target.closest('.edit-btn');
  if (!btn) return;

  const p = allProducts.find((x) => x.id === Number(btn.dataset.id));
  if (!p) return;

  document.getElementById('eId').value = p.id;
  document.getElementById('eName').value = p.name;
  document.getElementById('ePrice').value = p.price;
  document.getElementById('eDescription').value = p.description;
  document.getElementById('eNew').checked = p.isNewArrival;
  document.getElementById('eBest').checked = p.isBestSeller;
  document.getElementById('editMessage').textContent = '';

  // fill in the quantity for each size
  setSizeQuantities('eSizeQty', p.sizes);

  // some products use a spelling that isn't in the list, so add it
  const catSelect = document.getElementById('eCategory');
  if (![...catSelect.options].some((o) => o.value === p.category)) {
    catSelect.add(new Option(p.category, p.category));
  }
  catSelect.value = p.category;

  editDialog.showModal();
});

document.getElementById('cancelEdit').addEventListener('click', () => {
  editDialog.close();
});



document.getElementById('editForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const message = document.getElementById('editMessage');
  message.textContent = '';

  const id = document.getElementById('eId').value;
  const token = sessionStorage.getItem('adminToken');
  const button = e.target.querySelector('button[type="submit"]');

  button.disabled = true;
  button.textContent = 'Saving...';

  try {
    const res = await fetch(`${API}/products/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: document.getElementById('eName').value,
        category: document.getElementById('eCategory').value,
        price: document.getElementById('ePrice').value,
        description: document.getElementById('eDescription').value,
        isNewArrival: document.getElementById('eNew').checked,
        isBestSeller: document.getElementById('eBest').checked,
        sizes: getSizeQuantities('eSizeQty')
      })
    });

    if (res.status === 401) {
      editDialog.close();
      sessionStorage.removeItem('adminToken');
      showLogin();
      return;
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save changes');

    editDialog.close();
    loadProducts();
  } catch (err) {
    message.textContent = err.message;
  } finally {
    button.disabled = false;
    button.textContent = 'Save changes';
  }
});



async function loadOrders() {
  const orderList = document.getElementById('orderList');
  orderList.innerHTML = '<p>Loading...</p>';

  const token = sessionStorage.getItem('adminToken');

  try {
    const res = await fetch(`${API}/orders`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 401) {
      sessionStorage.removeItem('adminToken');
      showLogin();
      return;
    }

    const orders = await res.json();

    if (orders.length === 0) {
      orderList.innerHTML = '<p>No orders yet.</p>';
      return;
    }

    orderList.innerHTML = orders.map((o) => `
      <div class="order-card">
        <div class="order-top">
          <strong>Order #${o.id} · ${new Date(o.createdAt).toLocaleString()}</strong>
          <select class="status-select" data-id="${o.id}">
            ${['pending', 'paid', 'shipped', 'delivered', 'cancelled'].map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <p>${escapeHtml(o.customerName)} · ${escapeHtml(o.phone)} · ${escapeHtml(o.email)}</p>
        <p>${escapeHtml(o.address)}</p>
        <ul>
          ${o.items.map((i) => `<li>${escapeHtml(i.name)} · Size ${escapeHtml(i.size)} × ${i.qty} · $${(i.price * i.qty).toFixed(2)}</li>`).join('')}
        </ul>
        <strong>Total: $${o.total.toFixed(2)}</strong>
      </div>
    `).join('');
  } catch (err) {
    orderList.innerHTML = '<p>Could not load orders.</p>';
  }
}



document.getElementById('orderList').addEventListener('change', async (e) => {
  const select = e.target.closest('.status-select');
  if (!select) return;

  const token = sessionStorage.getItem('adminToken');
  select.disabled = true;

  try {
    const res = await fetch(`${API}/orders/${select.dataset.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status: select.value })
    });

    if (res.status === 401) {
      sessionStorage.removeItem('adminToken');
      showLogin();
      return;
    }
    if (!res.ok) throw new Error('Update failed');
  } catch (err) {
    alert('Could not update the order status.');
    loadOrders();
  } finally {
    select.disabled = false;
  }
});