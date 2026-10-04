const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    price: Number,
    qty: Number,
    size: String,
    image: String
  }],
  shippingAddress: { fullName: String, phone: String, line1: String, city: String, state: String, country: String },
  total: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'paid', 'shipped', 'delivered', 'cancelled'], default: 'pending' },
  paymentReference: { type: String, index: true },
  paidAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
