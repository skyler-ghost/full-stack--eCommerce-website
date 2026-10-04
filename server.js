const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "config", "config.env") });
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/error");

if (!process.env.JWT_SECRET) { console.error("JWT_SECRET missing in config/config.env"); process.exit(1); }

const app = express();
app.set("trust proxy", 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CLIENT_URL || true }));
// keep the raw body so the Paystack webhook signature can be checked
app.use(express.json({ limit: "1mb", verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(mongoSanitize());
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, max: 600 }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, max: 40 }));

app.get("/api/config", (_req, res) => res.json({
  currency: process.env.CURRENCY_SYMBOL || "₦",
  demoPayments: !process.env.PAYSTACK_SECRET_KEY && process.env.NODE_ENV !== "production"
}));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/cart", require("./routes/cart"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/payment", require("./routes/payment"));
app.use("/api/contact", require("./routes/contact"));
app.use("/api/admin", require("./routes/admin"));
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use(express.static(path.join(__dirname, "public")));
app.use("/api", notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
connectDB().then(() => app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`)));
