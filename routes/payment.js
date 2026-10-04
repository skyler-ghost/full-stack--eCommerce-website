const router = require('express').Router();
const crypto = require('crypto');
const { protect } = require('../middleware/auth');
const { wrap } = require('../middleware/error');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const sendMail = require('../utils/email');

const PAYSTACK = 'https://api.paystack.co';
const demoMode = () => !process.env.PAYSTACK_SECRET_KEY && process.env.NODE_ENV !== 'production';
const headers = () => ({ Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' });

// Idempotent: only the first call that flips pending -> paid does the work
async function markPaid(reference) {
  const order = await Order.findOneAndUpdate(
    { paymentReference: reference, status: 'pending' },
    { status: 'paid', paidAt: new Date() },
    { new: true }
  ).populate('user');
  if (!order) return null;

  await Promise.all(order.items.map(i => Product.updateOne({ _id: i.product }, { $inc: { stock: -i.qty } })));
  await User.updateOne({ _id: order.user._id }, { $set: { cart: [] } });

  const rows = order.items.map(i => `<li>${i.name} × ${i.qty}</li>`).join('');
  sendMail({ to: order.user.email, subject: `Order ${order._id} confirmed`, html: `<p>Thanks ${order.user.name}!</p><ul>${rows}</ul><p>Total: ${order.total}</p>` });
  if (process.env.ADMIN_EMAIL)
    sendMail({ to: process.env.ADMIN_EMAIL, subject: `New paid order ${order._id}`, html: `<p>Total: ${order.total}</p><ul>${rows}</ul>` });
  return order;
}

router.post('/initialize', protect, wrap(async (req, res) => {
  const order = await Order.findOne({ _id: req.body.orderId, user: req.user._id, status: 'pending' });
  if (!order) return res.status(404).json({ message: 'Pending order not found' });

  const reference = `ord_${order._id}_${Date.now()}`;
  if (demoMode()) {
    order.paymentReference = reference;
    await order.save();
    return res.json({ authorization_url: `${process.env.CLIENT_URL || ''}/order-success.html?reference=${reference}&demo=1`, reference, demo: true });
  }
  const r = await fetch(`${PAYSTACK}/transaction/initialize`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      email: req.user.email,
      amount: Math.round(order.total * 100), // kobo
      currency: process.env.PAYSTACK_CURRENCY || 'NGN',
      reference,
      callback_url: `${process.env.CLIENT_URL}/order-success.html`
    })
  });
  const data = await r.json();
  if (!data.status) return res.status(502).json({ message: data.message || 'Payment init failed' });

  order.paymentReference = reference;
  await order.save();
  res.json({ authorization_url: data.data.authorization_url, reference });
}));

// Frontend calls this after redirect back from Paystack
router.get('/verify/:reference', protect, wrap(async (req, res) => {
  if (demoMode()) {
    const o = await Order.findOne({ paymentReference: req.params.reference, user: req.user._id });
    return res.json({ status: o ? o.status : 'unknown', order: o, demo: true });
  }
  const r = await fetch(`${PAYSTACK}/transaction/verify/${encodeURIComponent(req.params.reference)}`, { headers: headers() });
  const data = await r.json();
  if (data.status && data.data.status === 'success') {
    const order = await Order.findOne({ paymentReference: req.params.reference });
    if (order && Math.round(order.total * 100) === data.data.amount) await markPaid(req.params.reference);
  }
  const order = await Order.findOne({ paymentReference: req.params.reference, user: req.user._id });
  res.json({ status: order ? order.status : 'unknown', order });
}));

// Demo only (development, no Paystack key): simulate a successful payment
router.post('/demo-confirm', protect, wrap(async (req, res) => {
  if (!demoMode()) return res.status(404).json({ message: 'Not available' });
  const o = await Order.findOne({ paymentReference: req.body.reference, user: req.user._id });
  if (!o) return res.status(404).json({ message: 'Order not found' });
  await markPaid(req.body.reference);
  res.json({ status: 'paid' });
}));

// Paystack webhook (set URL in Paystack dashboard: /api/payment/webhook)
router.post('/webhook', wrap(async (req, res) => {
  const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(req.rawBody || '').digest('hex');
  if (hash !== req.headers['x-paystack-signature']) return res.sendStatus(401);
  const event = req.body;
  if (event.event === 'charge.success') {
    const order = await Order.findOne({ paymentReference: event.data.reference });
    if (order && Math.round(order.total * 100) === event.data.amount) await markPaid(event.data.reference);
  }
  res.sendStatus(200);
}));

module.exports = router;
