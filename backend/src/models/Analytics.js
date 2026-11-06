const mongoose = require('mongoose');

// Monthly vendor sales summary (ER: Analytics). Recomputed from orders on demand.
const analyticsSchema = new mongoose.Schema(
  {
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    period: { type: String, required: true }, // YYYY-MM
    totalSales: { type: Number, default: 0 },
    orderCount: { type: Number, default: 0 },
    unitsSold: { type: Number, default: 0 },
  },
  { timestamps: true }
);

analyticsSchema.index({ vendor: 1, period: 1 }, { unique: true });

module.exports = mongoose.model('Analytics', analyticsSchema);
