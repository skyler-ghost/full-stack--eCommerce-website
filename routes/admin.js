const router = require("express").Router();
const { protect, adminOnly } = require("../middleware/auth");
const { wrap } = require("../middleware/error");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const Message = require("../models/Message");
const sendMail = require("../utils/email");

router.use(protect, adminOnly);

router.get(
  "/stats",
  wrap(async (_req, res) => {
    const [orders, users, products, revenue, lowStock] = await Promise.all([
      Order.countDocuments(),
      User.countDocuments({ role: "user" }),
      Product.countDocuments({ active: true }),
      Order.aggregate([
        { $match: { status: { $in: ["paid", "shipped", "delivered"] } } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      Product.find({ active: true, stock: { $lte: 5 } }).select("name stock"),
    ]);
    res.json({
      orders,
      users,
      products,
      revenue: revenue[0] ? revenue[0].total : 0,
      lowStock,
    });
  }),
);

router.get(
  "/orders",
  wrap(async (req, res) => {
    const filter = req.query.status ? { status: req.query.status } : {};
    res.json(
      await Order.find(filter)
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .limit(200),
    );
  }),
);

router.put(
  "/orders/:id/status",
  wrap(async (req, res) => {
    const { status } = req.body;
    if (!["shipped", "delivered", "cancelled"].includes(status))
      return res.status(400).json({ message: "Invalid status" });
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true },
    ).populate("user", "name email");
    if (!order) return res.status(404).json({ message: "Order not found" });
    sendMail({
      to: order.user.email,
      subject: `Order ${order._id} ${status}`,
      html: `<p>Your order is now <b>${status}</b>.</p>`,
    });
    res.json(order);
  }),
);

router.get(
  "/products",
  wrap(async (_req, res) =>
    res.json(await Product.find().sort({ createdAt: -1 })),
  ),
);

// Inventory
router.get(
  "/inventory",
  wrap(async (_req, res) =>
    res.json(
      await Product.find().select("name stock price active").sort({ stock: 1 }),
    ),
  ),
);
router.put(
  "/inventory/:id",
  wrap(async (req, res) => {
    const p = await Product.findByIdAndUpdate(
      req.params.id,
      { stock: Number(req.body.stock) },
      { new: true },
    );
    if (!p) return res.status(404).json({ message: "Product not found" });
    res.json(p);
  }),
);

router.get(
  "/users",
  wrap(async (_req, res) =>
    res.json(await User.find().select("-cart").sort({ createdAt: -1 })),
  ),
);
router.get(
  "/messages",
  wrap(async (_req, res) =>
    res.json(await Message.find().sort({ createdAt: -1 })),
  ),
);

module.exports = router;
