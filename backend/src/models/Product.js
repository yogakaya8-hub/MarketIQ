const mongoose = require('mongoose');
const { CATEGORIES } = require('../config/constants');

const productSchema = new mongoose.Schema(
  {
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 3000, default: '' },
    category: { type: String, enum: CATEGORIES, required: true, index: true },
    brand: { type: String, trim: true, maxlength: 60 },
    sku: { type: String, trim: true, maxlength: 40 },
    price: { type: Number, required: true, min: 1 }, // base price; rescue deals never overwrite it
    stock: { type: Number, required: true, min: 0, default: 0 },
    imageUrl: { type: String, trim: true, maxlength: 500 },
    isActive: { type: Boolean, default: true }, // vendor-controlled visibility
    isBlocked: { type: Boolean, default: false }, // admin moderation
    blockReason: { type: String, trim: true, maxlength: 300 },
    isArchived: { type: Boolean, default: false }, // vendor 'delete' keeps history for past orders
    listedAt: { type: Date, default: Date.now }, // used for product-age in dead-stock analysis
    // Denormalised counters maintained by the order service (analysis recomputes from orders).
    salesCount: { type: Number, default: 0, min: 0 },
    lastSaleDate: Date,
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', description: 'text', brand: 'text' }, { weights: { name: 5, brand: 3, description: 1 } });
productSchema.index({ vendor: 1, sku: 1 }, { unique: true, partialFilterExpression: { sku: { $type: 'string' } } });

module.exports = mongoose.model('Product', productSchema);
