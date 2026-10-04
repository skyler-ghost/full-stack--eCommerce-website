const router = require("express").Router();
const { protect } = require("../middleware/auth");
const { wrap } = require("../middleware/error");
const Product = require("../models/Product");

router.use(protect);

const view = async user => {
  await user.populate("cart.product");
  const items = user.cart.filter(i => i.product && i.product.active)
    .map(i => ({ lineId: i._id, product: i.product, size: i.size, qty: i.qty, lineTotal: i.product.price * i.qty }));
  return { items, count: items.reduce((s, i) => s + i.qty, 0), total: items.reduce((s, i) => s + i.lineTotal, 0) };
};

router.get("/", wrap(async (req, res) => res.json(await view(req.user))));

router.post("/", wrap(async (req, res) => {
  const { productId, qty = 1, size = "" } = req.body;
  const q = Math.max(1, parseInt(qty) || 1);
  const product = await Product.findOne({ _id: productId, active: true });
  if (!product) return res.status(404).json({ message: "Product not found" });
  const line = req.user.cart.find(i => String(i.product) === String(productId) && (i.size || "") === size);
  const newQty = (line ? line.qty : 0) + q;
  if (newQty > product.stock) return res.status(400).json({ message: `Only ${product.stock} in stock` });
  if (line) line.qty = newQty; else req.user.cart.push({ product: productId, qty: q, size });
  await req.user.save();
  res.json(await view(req.user));
}));

router.put("/:lineId", wrap(async (req, res) => {
  const qty = parseInt(req.body.qty);
  const line = req.user.cart.id(req.params.lineId);
  if (!line) return res.status(404).json({ message: "Item not in cart" });
  if (!qty || qty <= 0) line.deleteOne();
  else {
    const product = await Product.findById(line.product);
    if (!product || qty > product.stock) return res.status(400).json({ message: "Not enough stock" });
    line.qty = qty;
  }
  await req.user.save();
  res.json(await view(req.user));
}));

router.delete("/:lineId", wrap(async (req, res) => {
  const line = req.user.cart.id(req.params.lineId);
  if (line) line.deleteOne();
  await req.user.save();
  res.json(await view(req.user));
}));

module.exports = router;
