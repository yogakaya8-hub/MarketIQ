const mongoose = require('mongoose');
const { PurchaseEvent, Product, Settings } = require('../models');
const { EVENT_TYPES } = require('../config/constants');
const { DAY_MS } = require('../utils/dates');

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const pct = (num, den) => (den > 0 ? Number(((num / den) * 100).toFixed(1)) : null);

// Definitions returned with every response so the dashboard can explain each number.
const DEFINITIONS = {
  views: 'Product page views. Repeat views by the same shopper inside the de-duplication window count once.',
  shoppers: 'Distinct shopper and product pairs. A signed-in user is one shopper; an anonymous visitor is identified by a browser session.',
  addToCartEvents: 'Observed "add to cart" actions recorded by the server.',
  checkoutsInitiated: 'Distinct shoppers who pressed "Proceed to checkout" with this product in the cart.',
  purchases: 'Completed purchase line items from orders that were not cancelled.',
  viewConversion: 'Of the shoppers who viewed the product, the share who bought it after their first view.',
  cartConversion: 'Of the shoppers who added it to the cart, the share who bought it after adding.',
  checkoutConversion: 'Of the shoppers who started checkout with it, the share who completed the purchase.',
  inferredCartAbandonment:
    'Inferred, not observed: the shopper added the product, did not buy it afterwards, did not remove it, and has been inactive on it for longer than the grace period.',
  explicitRemovals: 'Observed: the shopper removed the item from the cart. Reasons appear only when the shopper chose one.',
};

const actorKey = { $cond: [{ $ifNull: ['$user', false] }, { $concat: ['u:', { $toString: '$user' }] }, { $concat: ['s:', { $ifNull: ['$sessionId', 'unknown'] }] }] };
const whenType = (types, expr) => ({ $cond: [{ $in: ['$eventType', types] }, expr, null] });
const countType = (types) => ({ $sum: { $cond: [{ $in: ['$eventType', types] }, 1, 0] } });

async function computeDropoff({ vendorId = null, days = 30, now = new Date() } = {}) {
  const { dropoff: cfg } = await Settings.get();
  const windowStart = new Date(now.getTime() - days * DAY_MS);
  const graceMs = cfg.abandonmentGraceHours * 60 * 60 * 1000;

  const match = {
    timestamp: { $gte: windowStart, $lte: now },
    'metadata.cancelled': { $ne: true },
  };
  if (vendorId) match.vendor = new mongoose.Types.ObjectId(String(vendorId));

  const [pairs, daily, reasonRows] = await Promise.all([
    PurchaseEvent.aggregate([
      { $match: match },
      {
        $group: {
          _id: { product: '$product', actor: actorKey },
          views: countType([EVENT_TYPES.VIEWED]),
          firstView: { $min: whenType([EVENT_TYPES.VIEWED], '$timestamp') },
          adds: countType([EVENT_TYPES.ADDED]),
          firstAdd: { $min: whenType([EVENT_TYPES.ADDED], '$timestamp') },
          lastCartTouch: { $max: whenType([EVENT_TYPES.ADDED, EVENT_TYPES.QTY_CHANGED], '$timestamp') },
          qtyChanges: countType([EVENT_TYPES.QTY_CHANGED]),
          removals: countType([EVENT_TYPES.REMOVED]),
          lastRemove: { $max: whenType([EVENT_TYPES.REMOVED], '$timestamp') },
          checkouts: countType([EVENT_TYPES.CHECKOUT]),
          firstCheckout: { $min: whenType([EVENT_TYPES.CHECKOUT], '$timestamp') },
          lastCheckout: { $max: whenType([EVENT_TYPES.CHECKOUT], '$timestamp') },
          purchases: countType([EVENT_TYPES.PURCHASED]),
          units: { $sum: { $cond: [{ $eq: ['$eventType', EVENT_TYPES.PURCHASED] }, { $ifNull: ['$quantity', 0] }, 0] } },
          lastPurchase: { $max: whenType([EVENT_TYPES.PURCHASED], '$timestamp') },
        },
      },
    ]),
    PurchaseEvent.aggregate([
      { $match: match },
      { $group: { _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, type: '$eventType' }, n: { $sum: 1 } } },
    ]),
    PurchaseEvent.aggregate([
      { $match: { ...match, eventType: EVENT_TYPES.REMOVED, 'metadata.reason': { $nin: [null, ''] } } },
      { $group: { _id: { product: '$product', reason: '$metadata.reason' }, n: { $sum: 1 } } },
    ]),
  ]);

  const rows = new Map();
  const blank = () => ({
    views: 0, viewers: 0, viewersAdded: 0, viewersPurchased: 0,
    addEvents: 0, adders: 0, addersPurchased: 0, qtyChanges: 0,
    removals: 0, removedAfterAdd: 0,
    checkoutsInitiated: 0, checkoutsPurchased: 0,
    purchases: 0, unitsPurchased: 0, purchasers: 0,
    inferredCartAbandoned: 0, inferredCheckoutAbandoned: 0, tooRecentToJudge: 0,
    reasons: {},
  });

  for (const p of pairs) {
    const id = String(p._id.product);
    if (!rows.has(id)) rows.set(id, blank());
    const r = rows.get(id);
    const lastPurchase = p.lastPurchase ? new Date(p.lastPurchase) : null;
    const boughtAfter = (t) => Boolean(lastPurchase && t && lastPurchase >= new Date(t));

    r.views += p.views;
    if (p.views > 0) {
      r.viewers += 1;
      if (p.adds > 0 && p.lastCartTouch && new Date(p.lastCartTouch) >= new Date(p.firstView)) r.viewersAdded += 1;
      if (boughtAfter(p.firstView)) r.viewersPurchased += 1;
    }
    r.addEvents += p.adds;
    r.qtyChanges += p.qtyChanges;
    r.removals += p.removals;
    if (p.adds > 0) {
      r.adders += 1;
      if (boughtAfter(p.firstAdd)) r.addersPurchased += 1;
      // Cart intent still open = last cart action newer than the last purchase.
      const openIntent = !boughtAfter(p.lastCartTouch);
      if (openIntent) {
        if (p.lastRemove && new Date(p.lastRemove) >= new Date(p.lastCartTouch)) r.removedAfterAdd += 1; // observed
        else if (now - new Date(p.lastCartTouch) > graceMs) r.inferredCartAbandoned += 1; // inferred
        else r.tooRecentToJudge += 1;
      }
    }
    if (p.checkouts > 0) {
      r.checkoutsInitiated += 1;
      if (boughtAfter(p.firstCheckout)) r.checkoutsPurchased += 1;
      if (!boughtAfter(p.lastCheckout) && now - new Date(p.lastCheckout) > graceMs) r.inferredCheckoutAbandoned += 1;
    }
    r.purchases += p.purchases;
    r.unitsPurchased += p.units;
    if (p.purchases > 0) r.purchasers += 1;
  }
  for (const rr of reasonRows) {
    const id = String(rr._id.product);
    if (rows.has(id)) rows.get(id).reasons[rr._id.reason] = rr.n;
  }

  const products = await Product.find({ _id: { $in: [...rows.keys()] } }).select('name category price imageUrl vendor store').populate('store', 'storeName').lean();
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const productRows = [];
  for (const [id, r] of rows) {
    const p = productMap.get(id);
    if (!p) continue;
    productRows.push({
      productId: id,
      name: p.name,
      category: p.category,
      price: p.price,
      storeName: p.store?.storeName,
      ...r,
      viewToCartPct: pct(r.viewersAdded, r.viewers),
      viewConversionPct: pct(r.viewersPurchased, r.viewers),
      cartConversionPct: pct(r.addersPurchased, r.adders),
      checkoutConversionPct: pct(r.checkoutsPurchased, r.checkoutsInitiated),
    });
  }
  productRows.sort((a, b) => b.views - a.views);

  const insights = buildInsights(productRows, cfg, days);

  const totals = productRows.reduce((t, r) => {
    for (const k of ['views', 'viewers', 'viewersAdded', 'viewersPurchased', 'addEvents', 'adders', 'addersPurchased', 'removals', 'removedAfterAdd', 'checkoutsInitiated', 'checkoutsPurchased', 'purchases', 'unitsPurchased', 'purchasers', 'inferredCartAbandoned', 'inferredCheckoutAbandoned', 'tooRecentToJudge']) {
      t[k] = (t[k] || 0) + r[k];
    }
    return t;
  }, {});
  totals.viewConversionPct = pct(totals.viewersPurchased || 0, totals.viewers || 0);
  totals.cartConversionPct = pct(totals.addersPurchased || 0, totals.adders || 0);
  totals.checkoutConversionPct = pct(totals.checkoutsPurchased || 0, totals.checkoutsInitiated || 0);
  totals.funnel = [
    { stage: 'Viewed', value: totals.viewers || 0 },
    { stage: 'Added to cart', value: totals.adders || 0 },
    { stage: 'Started checkout', value: totals.checkoutsInitiated || 0 },
    { stage: 'Purchased', value: totals.purchasers || 0 },
  ];

  const dailyMap = new Map();
  for (let t = windowStart.getTime(); t <= now.getTime(); t += DAY_MS) {
    const day = new Date(t).toISOString().slice(0, 10);
    dailyMap.set(day, { date: day, views: 0, addToCart: 0, checkouts: 0, purchases: 0, removals: 0 });
  }
  const typeKey = {
    [EVENT_TYPES.VIEWED]: 'views', [EVENT_TYPES.ADDED]: 'addToCart', [EVENT_TYPES.CHECKOUT]: 'checkouts',
    [EVENT_TYPES.PURCHASED]: 'purchases', [EVENT_TYPES.REMOVED]: 'removals',
  };
  for (const d of daily) {
    const row = dailyMap.get(d._id.day);
    const key = typeKey[d._id.type];
    if (row && key) row[key] += d.n;
  }

  const reasonTotals = {};
  for (const r of productRows) for (const [k, v] of Object.entries(r.reasons)) reasonTotals[k] = (reasonTotals[k] || 0) + v;

  return {
    windowDays: days,
    generatedAt: now,
    graceHours: cfg.abandonmentGraceHours,
    definitions: DEFINITIONS,
    totals,
    products: productRows,
    insights,
    daily: [...dailyMap.values()],
    removalReasons: Object.entries(reasonTotals).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
  };
}

function buildInsights(rows, cfg, days) {
  const insights = [];
  for (const r of rows) {
    const purchasesText = r.purchases === 0 ? 'no completed purchases' : `only ${plural(r.purchases, 'completed purchase')}`;
    const observed = `${r.name} received ${plural(r.views, 'view')} and ${plural(r.addEvents, 'add-to-cart event')} but ${purchasesText} in the last ${days} days.`;
    const inferredParts = [];
    if (r.inferredCartAbandoned) inferredParts.push(`${plural(r.inferredCartAbandoned, 'cart')} ${r.inferredCartAbandoned === 1 ? 'has' : 'have'} had no activity for over ${cfg.abandonmentGraceHours} hours without a purchase`);
    if (r.inferredCheckoutAbandoned) inferredParts.push(`${plural(r.inferredCheckoutAbandoned, 'checkout')} ${r.inferredCheckoutAbandoned === 1 ? 'was' : 'were'} started but not completed`);
    const inferred = inferredParts.length ? `Inferred: ${inferredParts.join('; ')}.` : null;
    const reasonList = Object.entries(r.reasons).sort((a, b) => b[1] - a[1]);
    const stated = reasonList.length ? `Customer-stated removal reasons: ${reasonList.map(([k, v]) => `"${k}" (${v})`).join(', ')}.` : null;
    const base = { productId: r.productId, productName: r.name, observed, inferred, statedReasons: stated };

    if (r.views >= cfg.minViewsForInsight && (r.viewConversionPct ?? 0) < cfg.lowViewConversionPct) {
      insights.push({
        ...base,
        type: 'high_views_low_purchases',
        title: 'High interest, few purchases',
        severity: (r.viewConversionPct ?? 0) < cfg.lowViewConversionPct / 2 ? 'high' : 'medium',
        metric: `${r.viewConversionPct ?? 0}% of viewers bought it (alert below ${cfg.lowViewConversionPct}%)`,
        reviewAreas: ['Pricing compared with similar products', 'Product photos, description and specifications', 'Delivery time and charges shown on the page', 'Stock availability messaging'],
      });
    }
    if (r.adders >= cfg.minCartAddsForInsight && (r.cartConversionPct ?? 0) < cfg.lowCartConversionPct) {
      insights.push({
        ...base,
        type: 'cart_not_purchased',
        title: 'Added to cart, not bought',
        severity: (r.cartConversionPct ?? 0) < cfg.lowCartConversionPct / 2 ? 'high' : 'medium',
        metric: `${r.cartConversionPct ?? 0}% of shoppers who added it went on to buy (alert below ${cfg.lowCartConversionPct}%)`,
        reviewAreas: ['Final price including delivery', 'Delivery time', 'Return and warranty information', 'Checkout friction'],
      });
    }
    if (r.checkoutsInitiated >= cfg.minCheckoutsForInsight && (r.checkoutConversionPct ?? 0) < cfg.lowCheckoutConversionPct) {
      insights.push({
        ...base,
        type: 'checkout_dropoff',
        title: 'Drop-off at checkout',
        severity: 'high',
        metric: `${r.checkoutConversionPct ?? 0}% of started checkouts completed (alert below ${cfg.lowCheckoutConversionPct}%)`,
        reviewAreas: ['Checkout steps and address form', 'Payment options', 'Stock running out between cart and checkout'],
      });
    }
    if (r.removals >= 3 && r.addEvents > 0 && r.removals / r.addEvents >= 0.4) {
      insights.push({
        ...base,
        type: 'frequent_removal',
        title: 'Frequently removed from cart',
        severity: 'medium',
        metric: `${plural(r.removals, 'removal')} for ${plural(r.addEvents, 'add-to-cart event')}`,
        reviewAreas: reasonList.length ? ['Start with the reasons customers stated above'] : ['Price', 'Delivery time', 'Product information'],
      });
    }
  }
  const rank = { high: 0, medium: 1, low: 2 };
  return insights.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

module.exports = { computeDropoff, DEFINITIONS };
