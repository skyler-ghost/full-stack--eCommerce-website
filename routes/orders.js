const router = require("express").Router();
const { protect } = require("../middleware/auth");
const { wrap } = require("../middleware/error");
const Order = require("../models/Order");

router.use(protect);

// Checkout: turn the server-side cart into a pending order (prices come from DB, never from the client)
router.post(
  "/",
  wrap(async (req, res) => {
    const { shippingAddress } = req.body;
    if (
      !shippingAddress ||
      !shippingAddress.line1 ||
      !shippingAddress.city ||
      !shippingAddress.phone
    )
      return res
        .status(400)
        .json({ message: "Shipping address (line1, city, phone) is required" });

    await req.user.populate("cart.product");
    const lines = req.user.cart.filter((i) => i.product && i.product.active);
    if (!lines.length)
      return res.status(400).json({ message: "Cart is empty" });

    for (const l of lines)
      if (l.qty > l.product.stock)
        return res
          .status(400)
          .json({ message: `${l.product.name}: only ${l.product.stock} left` });

    const items = lines.map((l) => ({
      product: l.product._id,
      name: l.product.name,
      price: l.product.price,
      qty: l.qty,
      size: l.size,
      image: l.product.images[0],
    }));
    const total = items.reduce((s, i) => s + i.price * i.qty, 0);
    const order = await Order.create({
      user: req.user._id,
      items,
      shippingAddress,
      total,
    });
    res.status(201).json(order);
  }),
);

router.get(
  "/mine",
  wrap(async (req, res) =>
    res.json(await Order.find({ user: req.user._id }).sort({ createdAt: -1 })),
  ),
);

router.get(
  "/:id",
  wrap(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (
      String(order.user) !== String(req.user._id) &&
      req.user.role !== "admin"
    )
      return res.status(403).json({ message: "Forbidden" });
    res.json(order);
  }),
);

module.exports = router;
