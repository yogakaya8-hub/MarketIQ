const mongoose = require('mongoose');
const { VENDOR_STATUS, CATEGORIES } = require('../config/constants');

// Store profile for a vendor user (ER: Vendor, 1:1 with User).
const vendorSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    storeName: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    categories: [{ type: String, enum: CATEGORIES }],
    city: { type: String, trim: true, maxlength: 80 },
    phone: { type: String, trim: true, maxlength: 20 },
    status: { type: String, enum: VENDOR_STATUS, default: 'pending', index: true },
    statusNote: { type: String, trim: true, maxlength: 500 },
    approvedAt: Date,
  },
  { timestamps: true }
);

vendorSchema.index({ storeName: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

module.exports = mongoose.model('Vendor', vendorSchema);
