const router = require("express").Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { protect } = require("../middleware/auth");
const { wrap } = require("../middleware/error");
const sendMail = require("../utils/email");

const sign = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES || "7d",
  });
const publicUser = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
});

router.post(
  "/register",
  wrap(async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 8)
      return res
        .status(400)
        .json({
          message: "Name, email and a password of 8+ characters are required",
        });
    if (await User.findOne({ email: String(email).toLowerCase() }))
      return res.status(409).json({ message: "Email already registered" });
    const user = await User.create({ name, email, password });
    sendMail({
      to: user.email,
      subject: "Welcome!",
      html: `<p>Hi ${user.name}, your account is ready.</p>`,
    });
    res.status(201).json({ token: sign(user._id), user: publicUser(user) });
  }),
);

router.post(
  "/login",
  wrap(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({
      email: String(email || "").toLowerCase(),
    }).select("+password");
    if (!user || !(await user.matchPassword(String(password || ""))))
      return res.status(401).json({ message: "Invalid email or password" });
    res.json({ token: sign(user._id), user: publicUser(user) });
  }),
);

router.get("/me", protect, (req, res) =>
  res.json({ user: publicUser(req.user) }),
);

router.put(
  "/me",
  protect,
  wrap(async (req, res) => {
    const { name, phone, addresses } = req.body;
    if (name) req.user.name = name;
    if (phone) req.user.phone = phone;
    if (Array.isArray(addresses)) req.user.addresses = addresses;
    await req.user.save();
    res.json({ user: publicUser(req.user) });
  }),
);

module.exports = router;
