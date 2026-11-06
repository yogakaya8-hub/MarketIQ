const mongoose = require('mongoose');

const rescueDealSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    discountPercent: { type: Number, required: true, min: 1, max: 90 },
    originalPrice: { type: Number, required: true, min: 1 },
    dealPrice: { type: Number, required: true, min: 1 },
    startsAt: { type: Date, default: Date.now },
    endsAt: { type: Date, required: true, index: true },
    status: { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active', index: true },
    riskStatusAtCreation: String,
    stockAtCreation: Number,
    unitsSold: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// At most one active deal per product.
rescueDealSchema.index({ product: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });

module.exports = mongoose.model('RescueDeal', rescueDealSchema);
