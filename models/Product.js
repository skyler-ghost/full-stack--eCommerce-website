const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, unique: true, index: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  category: { type: String, index: true },
  brand: { type: String, default: "" },
  sizes: { type: [String], default: [] },
  images: [String],
  stock: { type: Number, default: 0, min: 0 },
  featured: { type: Boolean, default: false },
  newArrival: { type: Boolean, default: false },
  active: { type: Boolean, default: true }
}, { timestamps: true });

productSchema.index({ name: 'text', description: 'text', category: 'text' });

productSchema.pre('validate', function (next) {
  if (this.isModified('name') || !this.slug) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      + '-' + Math.random().toString(36).slice(2, 6);
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);
