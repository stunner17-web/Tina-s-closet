const API_URL = 'http://localhost:5000/api/products';

// Load the product from the URL (product.html?id=2)
const params = new URLSearchParams(window.location.search);
const productId = Number(params.get('id')) || 1;

// how many of this product in this size are already in the cart
function qtyInCart(id, size) {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  return cart
    .filter(item => item.id === id && item.size === size)
    .reduce((sum, item) => sum + item.qty, 0);
}

async function loadProduct() {
  let product;
  try {
    const res = await fetch(`${API_URL}/${productId}`);
    if (!res.ok) throw new Error('Product not found');
    product = await res.json();
  } catch (err) {
    document.getElementById('productName').textContent = 'Product not found';
    return;
  }

  document.title = product.name + " | Tina Closet's";
  document.getElementById('productCategory').textContent = product.category;
  document.getElementById('productName').textContent = product.name;
  document.getElementById('productPrice').textContent = '$' + product.price.toFixed(2);
  document.getElementById('productDescription').textContent = product.description;
  document.getElementById('mainImage').src = product.images[0];
  document.getElementById('mainImage').alt = product.name;

  // sizes come from the database as { "8": 3, "10": 5 }
  const sizeStock = product.sizes || {};
  const availableSizes = Object.keys(sizeStock)
    .filter(size => sizeStock[size] > 0)
    .sort((a, b) => Number(a) - Number(b));
  const totalStock = availableSizes.reduce((sum, size) => sum + sizeStock[size], 0);

  // Stock message (created here, so no change to product.html is needed)
  const stockInfo = document.createElement('p');
  stockInfo.id = 'stockInfo';
  stockInfo.style.fontWeight = '700';
  stockInfo.style.margin = '8px 0';
  document.getElementById('productPrice').insertAdjacentElement('afterend', stockInfo);

  let selectedSize = null;

  function showStock() {
    if (totalStock < 1) {
      stockInfo.textContent = 'Out of stock';
      stockInfo.style.color = '#b91c1c';
    } else if (!selectedSize) {
      stockInfo.textContent = 'In stock';
      stockInfo.style.color = '#15803d';
    } else if (sizeStock[selectedSize] <= 5) {
      stockInfo.textContent = `Only ${sizeStock[selectedSize]} left in size ${selectedSize}`;
      stockInfo.style.color = '#c2410c';
    } else {
      stockInfo.textContent = `Size ${selectedSize} in stock`;
      stockInfo.style.color = '#15803d';
    }
  }
  showStock();

  const thumbsBox = document.getElementById('thumbs');
  product.images.forEach((src, i) => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = product.name;
    img.className = 'thumb' + (i === 0 ? ' active' : '');
    thumbsBox.appendChild(img);
  });

  // Thumbnail gallery
  const mainImage = document.getElementById('mainImage');
  const thumbs = document.querySelectorAll('.thumb');

  thumbs.forEach(thumb => {
    thumb.addEventListener('click', () => {
      mainImage.src = thumb.src;
      thumbs.forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
    });
  });

  // Build the size buttons from the database
  // (the old fixed buttons in product.html are replaced)
  const firstSizeBtn = document.querySelector('.size');
  if (firstSizeBtn) {
    const sizesBox = firstSizeBtn.parentElement;
    const tag = firstSizeBtn.tagName.toLowerCase();
    document.querySelectorAll('.size').forEach(b => b.remove());

    availableSizes.forEach(size => {
      const btn = document.createElement(tag);
      if (tag === 'button') btn.type = 'button';
      btn.className = 'size';
      btn.textContent = size;
      sizesBox.appendChild(btn);
    });
  }

  // Size selector
  const sizes = document.querySelectorAll('.size');
  const sizeError = document.getElementById('sizeError');

  // Quantity (cannot go above what is left in the chosen size)
  const qtyValue = document.getElementById('qtyValue');
  const addBtn = document.getElementById('addToCart');
  let qty = 1;

  function maxCanAdd() {
    if (!selectedSize) return 0;
    return sizeStock[selectedSize] - qtyInCart(product.id, selectedSize);
  }

  sizes.forEach(btn => {
    btn.addEventListener('click', () => {
      sizes.forEach(s => s.classList.remove('selected'));
      btn.classList.add('selected');
      selectedSize = btn.textContent;
      sizeError.classList.remove('show');

      // start again at 1 for the new size
      qty = 1;
      qtyValue.textContent = qty;
      showStock();

      if (maxCanAdd() < 1) {
        stockInfo.textContent = `You already have all of size ${selectedSize} in your cart`;
        stockInfo.style.color = '#b91c1c';
      }
    });
  });

  document.getElementById('plus').addEventListener('click', () => {
    if (!selectedSize) {
      sizeError.classList.add('show');
      return;
    }
    if (qty < maxCanAdd()) {
      qty++;
      qtyValue.textContent = qty;
    } else {
      stockInfo.textContent = `Only ${sizeStock[selectedSize]} available in size ${selectedSize}`;
      stockInfo.style.color = '#c2410c';
    }
  });

  document.getElementById('minus').addEventListener('click', () => {
    if (qty > 1) {
      qty--;
      qtyValue.textContent = qty;
      showStock();
    }
  });

  // Out of stock (or no sizes set yet): block adding to cart
  if (totalStock < 1) {
    addBtn.disabled = true;
    addBtn.textContent = 'Out of stock';
    addBtn.style.opacity = '0.5';
    addBtn.style.cursor = 'not-allowed';
    document.getElementById('plus').disabled = true;
    document.getElementById('minus').disabled = true;
    return;
  }

  // Add to cart
  addBtn.addEventListener('click', () => {
    if (!selectedSize) {
      sizeError.classList.add('show');
      return;
    }

    // do not let the cart go above the stock for this size
    if (qty > maxCanAdd()) {
      stockInfo.textContent = maxCanAdd() <= 0
        ? `You already have all of size ${selectedSize} in your cart`
        : `You can only add ${maxCanAdd()} more in size ${selectedSize}`;
      stockInfo.style.color = '#b91c1c';
      return;
    }

    const cart = JSON.parse(localStorage.getItem('cart')) || [];

    // If the same product and size is already in the cart, add to its quantity
    const existing = cart.find(item => item.id === product.id && item.size === selectedSize);

    if (existing) {
      existing.qty += qty;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.images[0],
        size: selectedSize,
        qty: qty
      });
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();

    // reset the quantity picker for the next add
    qty = 1;
    qtyValue.textContent = qty;
    showStock();

    addBtn.textContent = 'Added to Cart ✓';
    setTimeout(() => { addBtn.textContent = 'Add to Cart'; }, 1500);
  });
}

loadProduct();