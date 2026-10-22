const express = require('express');
const { PrismaClient } = require('@prisma/client');
const requireAdmin = require('../middleware/auth');

const prisma = new PrismaClient();
const router = express.Router();

// turn the saved text into usable data:
// images "a.jpg,b.jpg"  -> ["a.jpg", "b.jpg"]
// sizes  '{"8":3,"10":5}' -> { "8": 3, "10": 5 }
function formatProduct(p) {
  let sizes = {};
  try {
    const parsed = p.sizes ? JSON.parse(p.sizes) : {};
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      sizes = parsed;
    }
  } catch (err) {
    sizes = {}; // old comma-separated data: ignore it
  }

  return { ...p, images: p.images.split(','), sizes };
}

// clean up the sizes sent from the admin page: whole numbers, 0 removed
function cleanSizes(sizes) {
  const clean = {};
  if (sizes && typeof sizes === 'object' && !Array.isArray(sizes)) {
    for (const [size, qty] of Object.entries(sizes)) {
      const n = Math.max(0, Math.floor(Number(qty) || 0));
      if (n > 0) clean[size] = n;
    }
  }
  return clean;
}

// total stock = all the sizes added together
function totalStock(sizes) {
  return Object.values(sizes).reduce((sum, n) => sum + n, 0);
}

// Get all products (supports ?newArrival=true and ?bestSeller=true)
router.get('/', async (req, res) => {
  try {
    const where = {};
    if (req.query.newArrival === 'true') where.isNewArrival = true;
    if (req.query.bestSeller === 'true') where.isBestSeller = true;

    const products = await prisma.product.findMany({
      where,
      orderBy: { id: 'asc' },
    });
    res.json(products.map(formatProduct));
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Get one product
router.get('/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(formatProduct(product));
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Add a product (admin only)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const {
      name,
      category,
      price,
      description,
      images,
      isNewArrival,
      isBestSeller,
      sizes,
    } = req.body;

    if (!name || !category || !price || !description || !images?.length) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const clean = cleanSizes(sizes);

    const product = await prisma.product.create({
      data: {
        name,
        category,
        price: Number(price),
        description,
        images: images.join(','),
        stock: totalStock(clean),
        isNewArrival: Boolean(isNewArrival),
        isBestSeller: Boolean(isBestSeller),
        sizes: JSON.stringify(clean),
      },
    });

    res.status(201).json(formatProduct(product));
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Edit a product (admin only)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const {
      name,
      category,
      price,
      description,
      images,
      isNewArrival,
      isBestSeller,
      sizes,
    } = req.body;

    const data = {};
    if (name) data.name = name;
    if (category) data.category = category;
    if (price) data.price = Number(price);
    if (description) data.description = description;
    if (images?.length) data.images = images.join(',');
    if (isNewArrival !== undefined) data.isNewArrival = Boolean(isNewArrival);
    if (isBestSeller !== undefined) data.isBestSeller = Boolean(isBestSeller);

    if (sizes !== undefined) {
      const clean = cleanSizes(sizes);
      data.sizes = JSON.stringify(clean);
      data.stock = totalStock(clean);
    }

    const product = await prisma.product.update({
      where: { id: Number(req.params.id) },
      data,
    });

    res.json(formatProduct(product));
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Delete a product (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;