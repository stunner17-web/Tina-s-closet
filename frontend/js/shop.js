const API_URL = 'http://localhost:5000/api/products';

function escapeText(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// "Native wear" and "Native Wear" both become "native" for the tabs
function getFilterKey(category) {
  const c = category.toLowerCase();
  return c.includes('native') ? 'native' : c;
}

function soldOutLabel(p) {
  return p.stock < 1
    ? '<p style="color:#b91c1c;font-weight:700;font-size:14px;margin:4px 0 0;">Out of stock</p>'
    : '';
}

// New Arrivals: products ticked as "New Arrival" in admin
async function loadNewArrivals() {
  const grid = document.getElementById('newArrivalsGrid');
  if (!grid) return;

  try {
    const res = await fetch(`${API_URL}?newArrival=true`);
    const products = await res.json();

    if (products.length === 0) {
      grid.innerHTML = '<p>No new arrivals yet.</p>';
      return;
    }

    grid.innerHTML = products.map(p => `
      <div class="product-card">
        <a href="product.html?id=${p.id}">
          <img src="${escapeText(p.images[0])}" alt="${escapeText(p.name)}">
        </a>
        <div class="card-actions">
          <a href="product.html?id=${p.id}">${p.stock < 1 ? 'Out of stock' : 'Add To Cart'} <i class="bi bi-arrow-right"></i></a>
          <a href="#"><i class="bi bi-arrows-fullscreen"></i></a>
          <a href="#"><i class="bi bi-heart"></i></a>
        </div>
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = '<p>Could not load new arrivals.</p>';
  }
}

// Best Selling: products ticked as "Best Seller" in admin
async function loadShopProducts() {
  const grid = document.getElementById('bestSellingGrid');
  if (!grid) return;

  try {
    const res = await fetch(`${API_URL}?bestSeller=true`);
    const products = await res.json();

    if (products.length === 0) {
      grid.innerHTML = '<p>No best sellers yet.</p>';
      return;
    }

    grid.innerHTML = products.map(p => `
      <a href="product.html?id=${p.id}" class="item" data-category="${getFilterKey(p.category)}">
        <div class="product-card">
          <img src="${escapeText(p.images[0])}" alt="${escapeText(p.name)}">
        </div>
        <h4>${escapeText(p.name)}</h4>
        <p class="price">$${p.price.toFixed(2)}</p>
        ${soldOutLabel(p)}
      </a>
    `).join('');
  } catch (err) {
    grid.innerHTML = '<p>Could not load products.</p>';
  }
}

loadNewArrivals();
loadShopProducts();