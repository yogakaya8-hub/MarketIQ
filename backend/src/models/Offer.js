const mongoose = require('mongoose');
const { OFFER_STATUS } = require('../config/constants');

const offerSchema = new mongoose.Schema(
  {
    requirement: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement', required: true, index: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, // optional link to a catalogue item
    totalPrice: { type: Number, required: true, min: 1 }, // price for the full requested quantity
    deliveryDays: { type: Number, required: true, min: 1, max: 365 },
    expectedDeliveryDate: { type: Date, required: true },
    details: { type: String, trim: true, maxlength: 1500, default: '' },
    status: { type: String, enum: OFFER_STATUS, default: 'pending', index: true },
    decidedAt: Date,
  },
  { timestamps: true }
);

// One offer per vendor per requirement; vendors revise their existing offer instead of duplicating.
offerSchema.index({ requirement: 1, vendor: 1 }, { unique: true });

module.exports = mongoose.model('Offer', offerSchema);
