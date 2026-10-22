const itemsBox = document.getElementById('cartItems');
const summary = document.getElementById('cartSummary');
const subtotalEl = document.getElementById('subtotal');

const STOCK_API = 'http://localhost:5000/api/products';
let stockById = {}; // product id -> how many are in stock

// message shown above the cart items (e.g. "Only 3 available")
const notice = document.createElement('p');
notice.style.color = '#b91c1c';
notice.style.fontWeight = '700';
notice.style.margin = '8px 0';
itemsBox.insertAdjacentElement('beforebegin', notice);

async function loadStock() {
  try {
    const res = await fetch(STOCK_API);
    const products = await res.json();
    products.forEach((p) => { stockById[p.id] = p.stock; });
  } catch (err) {
    // if stock can't be loaded, the server still checks stock at checkout
    stockById = {};
  }
}

function getCart() {
  return JSON.parse(localStorage.getItem('cart')) || [];
}

function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
}

// total quantity of one product in the cart (all sizes together)
function totalForProduct(cart, id) {
  return cart
    .filter((item) => item.id === id)
    .reduce((sum, item) => sum + item.qty, 0);
}

function stockNote(cart, item) {
  const stock = stockById[item.id];
  if (stock === undefined) return '';

  if (stock < 1) {
    return '<p style="color:#b91c1c;font-size:13px;margin:4px 0 0;">Out of stock. Please remove this item.</p>';
  }
  if (totalForProduct(cart, item.id) > stock) {
    return `<p style="color:#b91c1c;font-size:13px;margin:4px 0 0;">Only ${stock} available. Please reduce the quantity.</p>`;
  }
  return '';
}

function render() {
  const cart = getCart();

  if (cart.length === 0) {
    itemsBox.innerHTML = `
      <div class="empty-cart">
        <p>Your cart is empty.</p>
        <a href="index.html#best-selling" class="shop-btn">Continue shopping</a>
      </div>`;
    summary.style.display = 'none';
    return;
  }

  summary.style.display = 'block';

  itemsBox.innerHTML = cart.map((item, i) => `
    <div class="cart-item">
      <img src="${item.image}" alt="${item.name}">
      <div class="item-info">
        <h3>${item.name}</h3>
        <p class="item-size">Size: ${item.size}</p>
        <p class="item-price">$${item.price.toFixed(2)}</p>
        ${stockNote(cart, item)}
      </div>
      <div class="qty">
        <button data-action="minus" data-index="${i}">-</button>
        <span>${item.qty}</span>
        <button data-action="plus" data-index="${i}">+</button>
      </div>
      <p class="line-total">$${(item.price * item.qty).toFixed(2)}</p>
      <button class="remove-btn" data-action="remove" data-index="${i}" aria-label="Remove">
        <i class="bi bi-trash"></i>
      </button>
    </div>
  `).join('');

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  subtotalEl.textContent = '$' + subtotal.toFixed(2);
}

itemsBox.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  const cart = getCart();
  const i = Number(btn.dataset.index);
  notice.textContent = '';

  if (btn.dataset.action === 'plus') {
    const stock = stockById[cart[i].id];
    const total = totalForProduct(cart, cart[i].id);

    if (stock !== undefined && total >= stock) {
      notice.textContent = `Only ${stock} available of ${cart[i].name}`;
      return;
    }
    cart[i].qty++;
  }
  if (btn.dataset.action === 'minus' && cart[i].qty > 1) cart[i].qty--;
  if (btn.dataset.action === 'remove') cart.splice(i, 1);

  saveCart(cart);
  render();
});

// show the cart straight away, then re-draw once stock is known
render();
loadStock().then(render);