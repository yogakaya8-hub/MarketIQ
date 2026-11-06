const mongoose = require('mongoose');

// Singleton document holding admin-configurable thresholds.
const DEFAULTS = {
  deadStock: {
    minObservationDays: 21, // products listed for less than this get "Insufficient data"
    analysisWindowDays: 90, // window for recent sales velocity
    slowMovingDays: 30, // days without a sale → slow-moving
    atRiskDays: 60, // days without a sale → at-risk
    deadStockDays: 90, // days without a sale → potential dead stock
    slowCoverDays: 120, // stock would last this long at recent velocity → slow-moving
    atRiskCoverDays: 240, // stock would last this long at recent velocity → at-risk
  },
  dropoff: {
    abandonmentGraceHours: 24, // cart/checkout without purchase older than this is inferred abandoned
    viewDedupMinutes: 30, // repeat views by the same visitor inside this window count once
    minViewsForInsight: 20,
    lowViewConversionPct: 3,
    minCartAddsForInsight: 4,
    lowCartConversionPct: 35,
    minCheckoutsForInsight: 3,
    lowCheckoutConversionPct: 60,
  },
  rescue: {
    minDiscountPercent: 5,
    maxDiscountPercent: 70,
    maxDurationDays: 30,
  },
};

const settingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'platform' },
    deadStock: { type: Object, default: () => ({ ...DEFAULTS.deadStock }) },
    dropoff: { type: Object, default: () => ({ ...DEFAULTS.dropoff }) },
    rescue: { type: Object, default: () => ({ ...DEFAULTS.rescue }) },
  },
  { timestamps: true, minimize: false }
);

settingsSchema.statics.get = async function getSettings() {
  const doc = await this.findById('platform').lean();
  return {
    deadStock: { ...DEFAULTS.deadStock, ...(doc?.deadStock || {}) },
    dropoff: { ...DEFAULTS.dropoff, ...(doc?.dropoff || {}) },
    rescue: { ...DEFAULTS.rescue, ...(doc?.rescue || {}) },
  };
};

const Settings = mongoose.model('Settings', settingsSchema);
Settings.DEFAULTS = DEFAULTS;
module.exports = Settings;
