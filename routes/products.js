const router = require('express').Router();
const Product = require('../models/Product');
const { protect, adminOnly } = require('../middleware/auth');
const { wrap } = require('../middleware/error');

const FIELDS = ['name', 'brand', 'description', 'price', 'category', 'sizes', 'images', 'stock', 'featured', 'newArrival', 'active'];
const pick = body => Object.fromEntries(Object.entries(body || {}).filter(([k]) => FIELDS.includes(k)));

// GET /api/products?q=&category=&min=&max=&sort=price_asc|price_desc|newest&page=1&limit=12&featured=true
router.get('/', wrap(async (req, res) => {
  const { q, category, min, max, sort, featured } = req.query;
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 12, 50);
  const filter = { active: true };
  if (q) filter.$text = { $search: String(q) };
  if (category) filter.category = String(category);
  if (featured === 'true') filter.featured = true;
  if (req.query.new === 'true') filter.newArrival = true;
  if (min || max) filter.price = { ...(min && { $gte: Number(min) }), ...(max && { $lte: Number(max) }) };
  const sortMap = { price_asc: { price: 1 }, price_desc: { price: -1 }, newest: { createdAt: -1 } };
  const [items, total] = await Promise.all([
    Product.find(filter).sort(sortMap[sort] || { createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Product.countDocuments(filter)
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
}));

router.get('/categories', wrap(async (_req, res) => {
  res.json(await Product.distinct('category', { active: true }));
}));

// id or slug
router.get('/:idOrSlug', wrap(async (req, res) => {
  const { idOrSlug } = req.params;
  const query = /^[a-f\d]{24}$/i.test(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug };
  const product = await Product.findOne(query);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json(product);
}));

router.post('/', protect, adminOnly, wrap(async (req, res) => res.status(201).json(await Product.create(pick(req.body)))));

router.put('/:id', protect, adminOnly, wrap(async (req, res) => {
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: 'Product not found' });
  Object.assign(p, pick(req.body));
  await p.save();
  res.json(p);
}));

router.delete('/:id', protect, adminOnly, wrap(async (req, res) => {
  await Product.findByIdAndUpdate(req.params.id, { active: false }); // soft delete keeps order history valid
  res.json({ message: 'Product deactivated' });
}));

module.exports = router;
