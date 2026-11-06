const mongoose = require('mongoose');
const { RISK } = require('../config/constants');

// Latest dead-stock analysis snapshot per product (ER: InventoryInsight).
const inventoryInsightSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, unique: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    stock: Number,
    salesCount: Number, // units sold inside the analysis window
    totalUnitsSold: Number,
    lastSaleDate: Date,
    daysSinceLastSale: Number,
    productAgeDays: Number,
    riskStatus: { type: String, enum: Object.values(RISK), required: true, index: true },
    reasons: [String],
    suggestedActions: [String],
    metrics: mongoose.Schema.Types.Mixed,
    analyzedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('InventoryInsight', inventoryInsightSchema);
