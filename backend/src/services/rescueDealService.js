const { Product, RescueDeal, Settings } = require('../models');
const ApiError = require('../utils/ApiError');
const { round2 } = require('../utils/money');
const { addDays } = require('../utils/dates');
const { RISK, RISK_LABELS } = require('../config/constants');
const { analyzeInventory } = require('./deadStockService');
const { expireDueDeals } = require('./pricingService');
const { logActivity } = require('./activityService');

const RESCUABLE = [RISK.SLOW, RISK.AT_RISK, RISK.DEAD];

async function createDeal(vendorUser, { productId, discountPercent, durationDays }) {
  const { rescue } = await Settings.get();
  if (discountPercent < rescue.minDiscountPercent || discountPercent > rescue.maxDiscountPercent) {
    throw ApiError.badRequest(`Discount must be between ${rescue.minDiscountPercent}% and ${rescue.maxDiscountPercent}%`);
  }
  if (durationDays < 1 || durationDays > rescue.maxDurationDays) {
    throw ApiError.badRequest(`Deal duration must be between 1 and ${rescue.maxDurationDays} days`);
  }

  const product = await Product.findOne({ _id: productId, vendor: vendorUser._id, isArchived: { $ne: true } });
  if (!product) throw ApiError.notFound('Product not found in your catalogue');
  if (!product.isActive || product.isBlocked) throw ApiError.badRequest('Only active, visible products can be promoted');
  if (product.stock <= 0) throw ApiError.badRequest('This product is out of stock, so there is nothing to rescue');

  // Re-run the analysis now so the deal is based on current evidence, not a stale snapshot.
  const [insight] = await analyzeInventory({ vendorId: vendorUser._id, productIds: [product._id], notifyChanges: false });
  if (!insight || !RESCUABLE.includes(insight.riskStatus)) {
    throw ApiError.badRequest(
      `Rescue deals are for slow-moving, at-risk or potential dead stock. This product is currently: ${RISK_LABELS[insight?.riskStatus] || 'unknown'}.`
    );
  }

  await expireDueDeals({ force: true });
  const now = new Date();
  try {
    const deal = await RescueDeal.create({
      product: product._id,
      vendor: vendorUser._id,
      discountPercent,
      originalPrice: product.price,
      dealPrice: Math.max(1, round2(product.price * (1 - discountPercent / 100))),
      startsAt: now,
      endsAt: addDays(now, durationDays),
      riskStatusAtCreation: insight.riskStatus,
      stockAtCreation: product.stock,
    });
    await logActivity(vendorUser, 'rescue_deal.created', { entityType: 'RescueDeal', entityId: deal._id, summary: `${product.name} −${discountPercent}%` });
    return deal;
  } catch (err) {
    if (err.code === 11000) throw ApiError.conflict('This product already has an active rescue deal');
    throw err;
  }
}

async function cancelDeal(vendorUser, dealId, { asAdmin = false } = {}) {
  const filter = { _id: dealId, status: 'active' };
  if (!asAdmin) filter.vendor = vendorUser._id;
  const deal = await RescueDeal.findOneAndUpdate(filter, { $set: { status: 'cancelled', endsAt: new Date() } }, { new: true });
  if (!deal) throw ApiError.conflict('Only active deals you own can be ended');
  await logActivity(vendorUser, 'rescue_deal.cancelled', { entityType: 'RescueDeal', entityId: deal._id });
  return deal;
}

// Keeps an active deal consistent when the vendor edits the base price.
async function syncDealWithPrice(productId, newPrice) {
  const deal = await RescueDeal.findOne({ product: productId, status: 'active' });
  if (!deal) return;
  deal.originalPrice = newPrice;
  deal.dealPrice = Math.max(1, round2(newPrice * (1 - deal.discountPercent / 100)));
  await deal.save();
}

module.exports = { createDeal, cancelDeal, syncDealWithPrice, RESCUABLE };
