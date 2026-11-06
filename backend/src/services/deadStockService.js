const { Product, Order, PurchaseEvent, InventoryInsight, Requirement, RescueDeal, Settings } = require('../models');
const { RISK, RISK_LABELS, EVENT_TYPES } = require('../config/constants');
const { DAY_MS, daysBetween } = require('../utils/dates');
const { notify } = require('./notificationService');
const { expireDueDeals } = require('./pricingService');

const SEVERITY = { [RISK.HEALTHY]: 0, [RISK.INSUFFICIENT]: 0, [RISK.SLOW]: 1, [RISK.AT_RISK]: 2, [RISK.DEAD]: 3 };
const fmtDate = (d) => new Date(d).toISOString().slice(0, 10);

/**
 * Pure classification function (unit-tested). Inputs come from real orders and events.
 *
 * Evidence used:
 *  - idleDays: days since the last sale, or days since listing if it has never sold
 *  - recent velocity: units sold in the analysis window / observed days
 *  - daysOfCover: how long current stock lasts at that velocity
 * High stock alone never triggers a flag: every rule needs a time-based sales signal.
 */
function classify({ stock, productAgeDays, unitsInWindow, totalUnitsSold, lastSaleDate, viewsInWindow = 0, now = new Date() }, cfg) {
  const metrics = { stock, productAgeDays, unitsInWindow, totalUnitsSold, viewsInWindow };

  if (stock <= 0) {
    return { riskStatus: RISK.HEALTHY, reasons: ['No stock on hand, so there is nothing at risk of going unsold.'], metrics };
  }
  if (productAgeDays < cfg.minObservationDays) {
    return {
      riskStatus: RISK.INSUFFICIENT,
      reasons: [
        `Listed ${productAgeDays} day(s) ago. At least ${cfg.minObservationDays} days of sales history are needed before a risk classification is made.`,
      ],
      metrics,
    };
  }

  const daysSinceLastSale = lastSaleDate ? daysBetween(lastSaleDate, now) : null;
  const idleDays = daysSinceLastSale ?? productAgeDays;
  const observedDays = Math.max(1, Math.min(cfg.analysisWindowDays, productAgeDays));
  const dailyVelocity = unitsInWindow / observedDays;
  const daysOfCover = dailyVelocity > 0 ? Math.round(stock / dailyVelocity) : null;
  Object.assign(metrics, { daysSinceLastSale, idleDays, observedDays, dailyVelocity: Number(dailyVelocity.toFixed(3)), daysOfCover });

  const reasons = [];
  let status = RISK.HEALTHY;
  const raise = (s) => {
    if (SEVERITY[s] > SEVERITY[status]) status = s;
  };

  // Rule 1: time since last sale (or since listing when never sold).
  const idleText = lastSaleDate
    ? `No sale for ${idleDays} days (last sale on ${fmtDate(lastSaleDate)}).`
    : `Never sold since it was listed ${productAgeDays} days ago.`;
  if (idleDays >= cfg.deadStockDays) {
    raise(RISK.DEAD);
    reasons.push(`${idleText} Threshold for potential dead stock: ${cfg.deadStockDays} days.`);
  } else if (idleDays >= cfg.atRiskDays) {
    raise(RISK.AT_RISK);
    reasons.push(`${idleText} Threshold for at-risk: ${cfg.atRiskDays} days.`);
  } else if (idleDays >= cfg.slowMovingDays) {
    raise(RISK.SLOW);
    reasons.push(`${idleText} Threshold for slow-moving: ${cfg.slowMovingDays} days.`);
  }

  // Rule 2: stock cover at the recent sales rate (only when there were recent sales to measure).
  if (daysOfCover !== null) {
    const coverText = `${unitsInWindow} unit(s) sold in the last ${observedDays} days; at that rate the ${stock} in stock would last about ${daysOfCover} days.`;
    if (daysOfCover >= cfg.atRiskCoverDays) {
      raise(RISK.AT_RISK);
      reasons.push(`${coverText} Threshold for at-risk: ${cfg.atRiskCoverDays} days of cover.`);
    } else if (daysOfCover >= cfg.slowCoverDays) {
      raise(RISK.SLOW);
      reasons.push(`${coverText} Threshold for slow-moving: ${cfg.slowCoverDays} days of cover.`);
    }
  }

  if (status !== RISK.HEALTHY && viewsInWindow > 0 && unitsInWindow === 0) {
    reasons.push(`Shoppers viewed it ${viewsInWindow} time(s) recently without buying, so interest exists but is not converting.`);
  }
  if (status === RISK.HEALTHY) {
    reasons.push(
      daysOfCover !== null
        ? `Selling steadily: last sale ${idleDays} day(s) ago, about ${daysOfCover} days of stock cover.`
        : `Last sale ${idleDays} day(s) ago, within the ${cfg.slowMovingDays}-day threshold.`
    );
  }
  return { riskStatus: status, reasons, metrics };
}

function suggestActions(riskStatus, { openRequirementsInCategory = 0, hasActiveDeal = false, viewsInWindow = 0 } = {}) {
  const actions = [];
  if (riskStatus === RISK.SLOW) {
    actions.push('Improve the listing: clearer photos, specifications and delivery details');
    actions.push('Consider a small rescue deal (5 to 15% off) to restart sales');
    actions.push('Reduce the next reorder quantity until sales pick up');
  } else if (riskStatus === RISK.AT_RISK) {
    actions.push('Create a rescue deal (15 to 30% off) for a limited time');
    actions.push('Bundle it with a faster-selling product');
    actions.push('Pause restocking this product');
  } else if (riskStatus === RISK.DEAD) {
    actions.push('Create a rescue deal with a deeper discount (30% or more)');
    actions.push('Pause restocking and consider clearance or return to supplier');
    actions.push('Review whether the price is in line with similar products');
  }
  if (SEVERITY[riskStatus] > 0 && viewsInWindow >= 10) {
    actions.push('Shoppers are viewing it: review the price and product details for conversion issues');
  }
  if (SEVERITY[riskStatus] > 0 && openRequirementsInCategory > 0) {
    actions.push(`${openRequirementsInCategory} open customer requirement(s) in this category: check the Requirement Board and offer this stock`);
  }
  if (hasActiveDeal) actions.unshift('A rescue deal is already running: monitor its sales before changing anything');
  return actions;
}

async function salesByProduct(productIds, windowStart) {
  const rows = await Order.aggregate([
    { $match: { status: { $ne: 'cancelled' }, 'items.product': { $in: productIds } } },
    { $unwind: '$items' },
    { $match: { 'items.product': { $in: productIds } } },
    {
      $group: {
        _id: '$items.product',
        totalUnits: { $sum: '$items.quantity' },
        lastSale: { $max: '$createdAt' },
        unitsInWindow: { $sum: { $cond: [{ $gte: ['$createdAt', windowStart] }, '$items.quantity', 0] } },
        ordersInWindow: { $sum: { $cond: [{ $gte: ['$createdAt', windowStart] }, 1, 0] } },
      },
    },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
}

async function viewsByProduct(productIds, windowStart) {
  const rows = await PurchaseEvent.aggregate([
    { $match: { product: { $in: productIds }, eventType: EVENT_TYPES.VIEWED, timestamp: { $gte: windowStart } } },
    { $group: { _id: '$product', views: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.views]));
}

/**
 * Analyses products (all vendors when vendorId is null), stores InventoryInsight snapshots
 * and sends an alert when a product newly becomes at-risk or potential dead stock.
 */
async function analyzeInventory({ vendorId = null, productIds = null, notifyChanges = true } = {}) {
  await expireDueDeals();
  const { deadStock: cfg } = await Settings.get();
  const now = new Date();
  const windowStart = new Date(now.getTime() - cfg.analysisWindowDays * DAY_MS);

  const filter = { isArchived: { $ne: true } };
  if (vendorId) filter.vendor = vendorId;
  if (productIds) filter._id = { $in: productIds };
  const products = await Product.find(filter).populate('store', 'storeName').lean();
  if (!products.length) return [];

  const ids = products.map((p) => p._id);
  const [sales, views, previous, openReqs, deals] = await Promise.all([
    salesByProduct(ids, windowStart),
    viewsByProduct(ids, windowStart),
    InventoryInsight.find({ product: { $in: ids } }).select('product riskStatus').lean(),
    Requirement.aggregate([{ $match: { status: 'open', requiredBy: { $gte: now } } }, { $group: { _id: '$category', n: { $sum: 1 } } }]),
    RescueDeal.find({ product: { $in: ids }, status: 'active' }).lean(),
  ]);
  const prevMap = new Map(previous.map((p) => [String(p.product), p.riskStatus]));
  const reqMap = new Map(openReqs.map((r) => [r._id, r.n]));
  const dealMap = new Map(deals.map((d) => [String(d.product), d]));

  const results = [];
  const bulk = [];
  const alerts = [];
  for (const p of products) {
    const s = sales.get(String(p._id));
    const viewsInWindow = views.get(String(p._id)) || 0;
    const productAgeDays = daysBetween(p.listedAt || p.createdAt, now);
    const lastSaleDate = s?.lastSale || null;
    const { riskStatus, reasons, metrics } = classify(
      { stock: p.stock, productAgeDays, unitsInWindow: s?.unitsInWindow || 0, totalUnitsSold: s?.totalUnits || 0, lastSaleDate, viewsInWindow, now },
      cfg
    );
    const activeDeal = dealMap.get(String(p._id)) || null;
    const suggestedActions = suggestActions(riskStatus, {
      openRequirementsInCategory: reqMap.get(p.category) || 0,
      hasActiveDeal: Boolean(activeDeal),
      viewsInWindow,
    });

    const insight = {
      product: p._id,
      vendor: p.vendor,
      stock: p.stock,
      salesCount: s?.unitsInWindow || 0,
      totalUnitsSold: s?.totalUnits || 0,
      lastSaleDate,
      daysSinceLastSale: lastSaleDate ? daysBetween(lastSaleDate, now) : null,
      productAgeDays,
      riskStatus,
      reasons,
      suggestedActions,
      metrics: { ...metrics, ordersInWindow: s?.ordersInWindow || 0, windowDays: cfg.analysisWindowDays },
      analyzedAt: now,
    };
    bulk.push({ updateOne: { filter: { product: p._id }, update: { $set: insight }, upsert: true } });
    results.push({
      ...insight,
      riskLabel: RISK_LABELS[riskStatus],
      productInfo: {
        _id: p._id,
        name: p.name,
        category: p.category,
        price: p.price,
        imageUrl: p.imageUrl,
        isActive: p.isActive,
        storeName: p.store?.storeName,
      },
      activeDeal: activeDeal ? { _id: activeDeal._id, discountPercent: activeDeal.discountPercent, dealPrice: activeDeal.dealPrice, endsAt: activeDeal.endsAt } : null,
    });

    const before = prevMap.get(String(p._id));
    if (notifyChanges && SEVERITY[riskStatus] >= 2 && SEVERITY[riskStatus] > (SEVERITY[before] ?? 0)) {
      alerts.push({ vendor: p.vendor, name: p.name, riskStatus, productId: p._id });
    }
  }
  if (bulk.length) await InventoryInsight.bulkWrite(bulk);

  for (const a of alerts) {
    await notify(a.vendor, {
      type: 'dead_stock',
      title: `${RISK_LABELS[a.riskStatus]} alert: ${a.name}`,
      message: 'Open Inventory Intelligence to see the evidence and create a rescue deal.',
      link: '/vendor/inventory',
    });
  }
  results.sort((a, b) => SEVERITY[b.riskStatus] - SEVERITY[a.riskStatus] || (b.metrics.idleDays ?? 0) - (a.metrics.idleDays ?? 0));
  return results;
}

module.exports = { classify, suggestActions, analyzeInventory, SEVERITY };
