const summaryItems = document.getElementById('summaryItems');
const orderTotal = document.getElementById('orderTotal');
const form = document.getElementById('checkoutForm');
const success = document.getElementById('orderSuccess');
const grid = document.querySelector('.checkout-grid');

const cart = JSON.parse(localStorage.getItem('cart')) || [];

// An empty cart has nothing to check out
if (cart.length === 0) {
  window.location.href = 'cart.html';
}

summaryItems.innerHTML = cart.map(item => `
  <div class="summary-item">
    <img src="${item.image}" alt="${item.name}">
    <div>
      <h4>${item.name}</h4>
      <p>Size ${item.size} × ${item.qty}</p>
    </div>
    <span>$${(item.price * item.qty).toFixed(2)}</span>
  </div>
`).join('');

const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
orderTotal.textContent = '$' + total.toFixed(2); 


const API_URL = 'http://localhost:5000/api/orders';

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const data = Object.fromEntries(new FormData(form));
  const button = form.querySelector('.place-order-btn');

  const order = {
    customerName: data.name,
    email: data.email,
    phone: data.phone,
    address: data.address + ', ' + data.city,
    items: cart.map(item => ({ id: item.id, size: item.size, qty: item.qty }))
  };

  button.disabled = true;
  button.textContent = 'Placing order...';

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });

    if (!res.ok) {
      // use the server's message, e.g. "Only 1 left of Blue Office Dress"
      let message = 'Order failed';
      try {
        const errData = await res.json();
        if (errData.error) message = errData.error;
      } catch (_) {}
      const err = new Error(message);
      err.fromServer = true;
      throw err;
    }

    // Only clear the cart once the server has saved the order
    localStorage.removeItem('cart');
    updateCartCount();

    grid.style.display = 'none';
    success.style.display = 'block';
  } catch (err) {
    if (err.fromServer) {
      alert(err.message + '\n\nPlease go back to your cart and update it.');
    } else {
      alert('Sorry, we could not place your order. Please try again.');
    }
    button.disabled = false;
    button.textContent = 'Place Order';
  }
});