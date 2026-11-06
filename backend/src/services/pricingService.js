const { RescueDeal } = require('../models');

let lastSweep = 0;

// Marks deals whose end date has passed as expired. Called lazily before any price lookup
// (throttled to once per 5 seconds) and on a timer from server.js.
async function expireDueDeals({ force = false } = {}) {
  const now = Date.now();
  if (!force && now - lastSweep < 5000) return 0;
  lastSweep = now;
  const res = await RescueDeal.updateMany({ status: 'active', endsAt: { $lte: new Date() } }, { $set: { status: 'expired' } });
  return res.modifiedCount;
}

// Returns Map<productId, deal> of deals that are active right now.
async function activeDealsFor(productIds) {
  await expireDueDeals();
  if (!productIds.length) return new Map();
  const now = new Date();
  const deals = await RescueDeal.find({
    product: { $in: productIds },
    status: 'active',
    startsAt: { $lte: now },
    endsAt: { $gt: now },
  }).lean();
  return new Map(deals.map((d) => [String(d.product), d]));
}

function withPricing(product, deal) {
  const p = typeof product.toObject === 'function' ? product.toObject() : { ...product };
  if (deal) {
    p.deal = {
      _id: deal._id,
      discountPercent: deal.discountPercent,
      dealPrice: deal.dealPrice,
      endsAt: deal.endsAt,
    };
    p.effectivePrice = deal.dealPrice;
  } else {
    p.deal = null;
    p.effectivePrice = p.price;
  }
  return p;
}

async function attachPricing(products) {
  const list = Array.isArray(products) ? products : [products];
  const deals = await activeDealsFor(list.map((p) => p._id));
  const priced = list.map((p) => withPricing(p, deals.get(String(p._id))));
  return Array.isArray(products) ? priced : priced[0];
}

module.exports = { expireDueDeals, activeDealsFor, attachPricing, withPricing };
