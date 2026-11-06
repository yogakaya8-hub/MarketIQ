const mongoose = require('mongoose');
const { REQUIREMENT_STATUS, CATEGORIES } = require('../config/constants');

const requirementSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    category: { type: String, enum: CATEGORIES, required: true, index: true },
    quantity: { type: Number, required: true, min: 1, max: 100000 },
    budget: { type: Number, required: true, min: 1 }, // total budget for the full quantity (INR)
    requiredBy: { type: Date, required: true },
    status: { type: String, enum: REQUIREMENT_STATUS, default: 'open', index: true },
    selectedOffer: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    awardedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Requirement', requirementSchema);
