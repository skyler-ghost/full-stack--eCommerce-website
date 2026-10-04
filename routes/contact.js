const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const Message = require('../models/Message');
const sendMail = require('../utils/email');
const { wrap } = require('../middleware/error');

router.post('/', rateLimit({ windowMs: 60 * 60 * 1000, max: 10 }), wrap(async (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ message: 'Name, email and message are required' });
  await Message.create({ name, email, subject, message });
  sendMail({
    to: process.env.ADMIN_EMAIL,
    subject: `Contact: ${subject || 'New message'}`,
    html: `<p><b>${name}</b> (${email})</p><p>${String(message).replace(/</g, '&lt;')}</p>`
  });
  res.status(201).json({ message: 'Message received' });
}));

module.exports = router;
