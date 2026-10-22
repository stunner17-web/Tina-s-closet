const express = require('express');
const { PrismaClient } = require('@prisma/client');
const requireAdmin = require('../middleware/auth');

const prisma = new PrismaClient();
const router = express.Router();

// '{"8":3,"10":5}' -> { "8": 3, "10": 5 }
function parseSizes(text) {
  try {
    const parsed = text ? JSON.parse(text) : {};
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch (err) {
    // old or broken data: treat as no sizes
  }
  return {};
}

function totalStock(sizes) {
  return Object.values(sizes).reduce((sum, n) => sum + n, 0);
}

// Take stock off (or put it back on) the exact sizes of one product.
// bySize looks like { "8": 2, "10": 1 }. direction is 'remove' or 'add'.
async function changeStock(tx, productId, bySize, direction) {
  const product = await tx.product.findUnique({ where: { id: Number(productId) } });
  if (!product) return; // product was deleted, nothing to update

  const sizes = parseSizes(product.sizes);

  for (const [size, qty] of Object.entries(bySize)) {
    const current = sizes[size] || 0;
    const next = direction === 'remove' ? current - qty : current + qty;

    if (next < 0) throw new Error('NOT_ENOUGH_STOCK');

    if (next > 0) sizes[size] = next;
    else delete sizes[size];
  }

  // only saves if nobody changed this product in the meantime
  // (protects against two people buying the last item at the same time)
  const result = await tx.product.updateMany({
    where: { id: product.id, sizes: product.sizes },
    data: { sizes: JSON.stringify(sizes), stock: totalStock(sizes) },
  });

  if (result.count === 0) throw new Error('CONFLICT');
}

// Place an order (customers)
router.post('/', async (req, res) => {
  try {
    const { customerName, email, phone, address, items } = req.body;

    if (!customerName || !email || !phone || !address || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Missing order details' });
    }

    // prices come from the database, never from the browser
    const ids = items.map((i) => Number(i.id));
    const products = await prisma.product.findMany({ where: { id: { in: ids } } });

    let total = 0;
    const orderItems = [];
    const wantedBySize = {}; // { productId: { size: quantity } }

    for (const item of items) {
      const product = products.find((p) => p.id === Number(item.id));
      const qty = Number(item.qty);

      if (!product || !item.size || !Number.isInteger(qty) || qty < 1) {
        return res.status(400).json({ error: 'Invalid item in cart' });
      }

      const size = String(item.size);
      wantedBySize[product.id] = wantedBySize[product.id] || {};
      wantedBySize[product.id][size] = (wantedBySize[product.id][size] || 0) + qty;

      total += product.price * qty;
      orderItems.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        size,
        qty,
      });
    }

    // check stock for each size before creating the order
    for (const product of products) {
      const wanted = wantedBySize[product.id];
      if (!wanted) continue;

      const sizes = parseSizes(product.sizes);

      for (const [size, qty] of Object.entries(wanted)) {
        const available = sizes[size] || 0;

        if (available < 1) {
          return res.status(400).json({
            error: `${product.name} is out of stock in size ${size}`,
          });
        }
        if (qty > available) {
          return res.status(400).json({
            error: `Only ${available} left of ${product.name} in size ${size}`,
          });
        }
      }
    }

    // create the order and reduce stock together, so both happen or neither does
    const order = await prisma.$transaction(async (tx) => {
      for (const productId of Object.keys(wantedBySize)) {
        await changeStock(tx, productId, wantedBySize[productId], 'remove');
      }

      return tx.order.create({
        data: { customerName, email, phone, address, total, items: { create: orderItems } },
        include: { items: true },
      });
    });

    res.status(201).json(order);
  } catch (err) {
    if (err.message === 'NOT_ENOUGH_STOCK' || err.message === 'CONFLICT') {
      return res.status(400).json({ error: 'Sorry, an item in your cart just went out of stock' });
    }
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// See all orders (admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: { items: true },
      orderBy: { id: 'desc' },
    });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Change an order's status (admin only)
router.patch('/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];

    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const id = Number(req.params.id);

    const order = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!existing) throw new Error('NOT_FOUND');

      // nothing to do if the status is not changing
      if (existing.status === status) return existing;

      // quantity per size for each product in this order
      const bySizeByProduct = {}; // { productId: { size: quantity } }
      for (const item of existing.items) {
        bySizeByProduct[item.productId] = bySizeByProduct[item.productId] || {};
        bySizeByProduct[item.productId][item.size] =
          (bySizeByProduct[item.productId][item.size] || 0) + item.qty;
      }

      // cancelling: put the items back in stock, in the same sizes
      if (status === 'cancelled' && existing.status !== 'cancelled') {
        for (const productId of Object.keys(bySizeByProduct)) {
          await changeStock(tx, productId, bySizeByProduct[productId], 'add');
        }
      }

      // reopening a cancelled order: take the items out of stock again
      if (existing.status === 'cancelled' && status !== 'cancelled') {
        for (const productId of Object.keys(bySizeByProduct)) {
          await changeStock(tx, productId, bySizeByProduct[productId], 'remove');
        }
      }

      return tx.order.update({
        where: { id },
        data: { status },
        include: { items: true },
      });
    });

    res.json(order);
  } catch (err) {
    if (err.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (err.message === 'NOT_ENOUGH_STOCK') {
      return res.status(400).json({ error: 'Not enough stock to reopen this order' });
    }
    if (err.message === 'CONFLICT') {
      return res.status(409).json({ error: 'Stock just changed, please try again' });
    }
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;