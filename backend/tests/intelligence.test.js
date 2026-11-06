const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');
const { classify } = require('../src/services/deadStockService');
const { DEFAULTS } = require('../src/models/Settings');

const cfg = DEFAULTS.deadStock;
const now = new Date();
const ago = (d) => new Date(now.getTime() - d * h.DAY);

before(h.setup);
after(h.teardown);

// ---------------- Dead Stock classification (pure logic)

test('new products get "Insufficient data" instead of a guessed risk', () => {
  const r = classify({ stock: 500, productAgeDays: 4, unitsInWindow: 0, totalUnitsSold: 0, lastSaleDate: null, now }, cfg);
  assert.equal(r.riskStatus, 'insufficient_data');
});

test('high stock alone is never dead stock when the product keeps selling', () => {
  const r = classify({ stock: 300, productAgeDays: 200, unitsInWindow: 600, totalUnitsSold: 1400, lastSaleDate: ago(1), now }, cfg);
  assert.equal(r.riskStatus, 'healthy');
  const r2 = classify({ stock: 5000, productAgeDays: 200, unitsInWindow: 90, totalUnitsSold: 200, lastSaleDate: ago(1), now }, cfg);
  assert.notEqual(r2.riskStatus, 'dead_stock');
});

test('time since last sale drives slow-moving, at-risk and potential dead stock', () => {
  const base = { stock: 3, productAgeDays: 300, totalUnitsSold: 40, now };
  assert.equal(classify({ ...base, unitsInWindow: 10, lastSaleDate: ago(35) }, cfg).riskStatus, 'slow_moving');
  assert.equal(classify({ ...base, unitsInWindow: 3, lastSaleDate: ago(70) }, cfg).riskStatus, 'at_risk');
  const dead = classify({ ...base, unitsInWindow: 0, lastSaleDate: ago(120) }, cfg);
  assert.equal(dead.riskStatus, 'dead_stock');
  assert.match(dead.reasons[0], /No sale for 120 days/);
  assert.equal(classify({ stock: 10, productAgeDays: 100, unitsInWindow: 0, totalUnitsSold: 0, lastSaleDate: null, now }, cfg).riskStatus, 'dead_stock');
});

test('out-of-stock products are not flagged', () => {
  assert.equal(classify({ stock: 0, productAgeDays: 300, unitsInWindow: 0, totalUnitsSold: 5, lastSaleDate: ago(200), now }, cfg).riskStatus, 'healthy');
});

// ---------------- Dead Stock analysis + Rescue Deals (API)

async function sellAt(vendor, product, daysAgo, qty = 1) {
  const c = await h.register('customer');
  await h.M.Order.create({
    orderNumber: `T-${Math.random().toString(36).slice(2)}`,
    customer: c.user._id, vendor: vendor.user._id, store: vendor.vendor._id,
    items: [{ product: product._id, name: product.name, quantity: qty, unitPrice: product.price, lineTotal: product.price * qty }],
    totalAmount: product.price * qty, shippingAddress: h.address, status: 'delivered', createdAt: ago(daysAgo),
  });
}

test('analysis uses real orders, stores insights and alerts the vendor once', async () => {
  const v = await h.approvedVendor();
  const dead = await h.product(v, { name: 'Old adapter', listedAt: ago(200), stock: 30 });
  const fine = await h.product(v, { name: 'Popular charger', listedAt: ago(200), stock: 5 });
  const fresh = await h.product(v, { name: 'New watch', listedAt: ago(3), stock: 50 });
  await sellAt(v, dead, 130);
  for (const d of [1, 5, 9, 15, 20, 26]) await sellAt(v, fine, d);

  const res = await h.api().get('/api/inventory/dead-stock').set(h.auth(v.token)).expect(200);
  const byName = Object.fromEntries(res.body.items.map((i) => [i.productInfo.name, i]));
  assert.equal(byName['Old adapter'].riskStatus, 'dead_stock');
  assert.equal(byName['Old adapter'].daysSinceLastSale, 130);
  assert.ok(byName['Old adapter'].suggestedActions.length > 0);
  assert.equal(byName['Popular charger'].riskStatus, 'healthy');
  assert.equal(byName['New watch'].riskStatus, 'insufficient_data');
  assert.equal(await h.M.InventoryInsight.countDocuments({ vendor: v.user._id }), 3);

  await h.api().get('/api/inventory/dead-stock').set(h.auth(v.token)).expect(200);
  const alerts = await h.M.Notification.countDocuments({ user: v.user._id, type: 'dead_stock' });
  assert.equal(alerts, 1, 'repeat analysis must not spam the vendor');

  const other = await h.approvedVendor();
  const theirs = await h.api().get('/api/inventory/dead-stock').set(h.auth(other.token)).expect(200);
  assert.equal(theirs.body.items.length, 0);
});

test('rescue deals: only for flagged products, one active deal, effective price applied and expiry enforced', async () => {
  const v = await h.approvedVendor();
  const c = await h.register('customer');
  const dead = await h.product(v, { listedAt: ago(200), stock: 30, price: 1000 });
  const healthy = await h.product(v, { listedAt: ago(200), stock: 5 });
  for (const d of [1, 3, 6]) await sellAt(v, healthy, d, 5);

  const rejected = await h.api().post('/api/rescue-deals').set(h.auth(v.token)).send({ productId: healthy._id, discountPercent: 20, durationDays: 7 });
  assert.equal(rejected.status, 400);
  assert.equal((await h.api().post('/api/rescue-deals').set(h.auth(v.token)).send({ productId: dead._id, discountPercent: 95, durationDays: 7 })).status, 400);

  const created = await h.api().post('/api/rescue-deals').set(h.auth(v.token)).send({ productId: dead._id, discountPercent: 30, durationDays: 7 }).expect(201);
  assert.equal(created.body.deal.dealPrice, 700);
  assert.equal((await h.api().post('/api/rescue-deals').set(h.auth(v.token)).send({ productId: dead._id, discountPercent: 40, durationDays: 7 })).status, 409);

  const listing = await h.api().get('/api/rescue-deals').expect(200);
  assert.equal(listing.body.deals.length, 1);
  assert.equal((await h.M.Product.findById(dead._id)).price, 1000, 'base price is never overwritten');

  await h.api().post('/api/cart/items').set(h.auth(c.token)).send({ productId: dead._id, quantity: 2 });
  const order = await h.api().post('/api/orders').set(h.auth(c.token)).send({ shippingAddress: h.address }).expect(201);
  assert.equal(order.body.orders[0].totalAmount, 1400);
  assert.equal((await h.M.RescueDeal.findById(created.body.deal._id)).unitsSold, 2);

  // Price change keeps the deal consistent.
  await h.api().put(`/api/products/${dead._id}`).set(h.auth(v.token)).send({ price: 2000 }).expect(200);
  assert.equal((await h.M.RescueDeal.findById(created.body.deal._id)).dealPrice, 1400);

  // Expired deals stop applying immediately, even before the background sweep runs.
  await h.M.RescueDeal.updateOne({ _id: created.body.deal._id }, { $set: { endsAt: new Date(Date.now() - 1000) } });
  const after = await h.api().get(`/api/products/${dead._id}`).expect(200);
  assert.equal(after.body.product.deal, null);
  assert.equal(after.body.product.effectivePrice, 2000);
  assert.equal((await h.api().get('/api/rescue-deals')).body.deals.length, 0);
});

// ---------------- Failed Purchase Learning

test('view tracking de-duplicates repeat views and ignores the vendor\'s own views', async () => {
  const v = await h.approvedVendor();
  const p = await h.product(v);
  await h.api().post(`/api/products/${p._id}/events`).send({ eventType: 'product_viewed', sessionId: 'session-abc-123' }).expect(201);
  await h.api().post(`/api/products/${p._id}/events`).send({ eventType: 'product_viewed', sessionId: 'session-abc-123' }).expect(200);
  await h.api().post(`/api/products/${p._id}/events`).set(h.auth(v.token)).send({ eventType: 'product_viewed' }).expect(200);
  const spoof = await h.api().post(`/api/products/${p._id}/events`).send({ eventType: 'purchase_completed', sessionId: 'session-abc-123' });
  assert.equal(spoof.status, 400);
  assert.equal(await h.M.PurchaseEvent.countDocuments({ product: p._id }), 1);
});

test('drop-off analytics: cohort conversions, observed removals vs inferred abandonment, cancelled orders excluded', async () => {
  const v = await h.approvedVendor();
  const p = await h.product(v, { name: 'Desk Lamp', stock: 100, price: 100 });
  const E = h.M.PurchaseEvent;
  const shoppers = await Promise.all([1, 2, 3, 4, 5].map(() => h.register('customer')));
  const ev = (u, eventType, hoursAgo, extra = {}) => ({ user: u.user._id, product: p._id, vendor: v.user._id, eventType, timestamp: new Date(Date.now() - hoursAgo * 3600000), ...extra });

  // 40 anonymous views: interest without purchases.
  await E.insertMany(Array.from({ length: 40 }, (_, i) => ({ sessionId: `anon-${i}-xxxx`, product: p._id, vendor: v.user._id, eventType: 'product_viewed', timestamp: new Date(Date.now() - (i + 1) * 3600000) })));
  const [buyer, remover, abandoner, recent, cancelled] = shoppers;
  await E.insertMany([
    ev(buyer, 'product_viewed', 50), ev(buyer, 'added_to_cart', 49), ev(buyer, 'checkout_initiated', 48.9), ev(buyer, 'purchase_completed', 48.8, { quantity: 1 }),
    ev(remover, 'product_viewed', 60), ev(remover, 'added_to_cart', 59), ev(remover, 'cart_item_removed', 58, { metadata: { reason: 'Delivery takes too long' } }),
    ev(abandoner, 'product_viewed', 80), ev(abandoner, 'added_to_cart', 79), ev(abandoner, 'checkout_initiated', 78),
    ev(recent, 'product_viewed', 2), ev(recent, 'added_to_cart', 1),
    ev(cancelled, 'product_viewed', 30), ev(cancelled, 'added_to_cart', 29), ev(cancelled, 'purchase_completed', 28, { metadata: { cancelled: true } }),
  ]);

  const res = await h.api().get('/api/analytics/purchase-dropoff?days=30').set(h.auth(v.token)).expect(200);
  const row = res.body.products.find((r) => r.name === 'Desk Lamp');
  assert.equal(row.views, 45);
  assert.equal(row.addEvents, 5);
  assert.equal(row.purchases, 1, 'cancelled purchase must not count');
  assert.equal(row.adders, 5);
  assert.equal(row.addersPurchased, 1);
  assert.equal(row.cartConversionPct, 20);
  assert.equal(row.removedAfterAdd, 1, 'explicit removal is observed, not inferred');
  assert.equal(row.inferredCartAbandoned, 2, 'abandoner and cancelled buyer are inferred abandoned');
  assert.equal(row.tooRecentToJudge, 1, 'cart activity inside the grace period is not labelled abandoned');
  assert.equal(row.inferredCheckoutAbandoned, 1);
  assert.ok(row.viewConversionPct <= 100);

  const types = res.body.insights.filter((i) => i.productName === 'Desk Lamp').map((i) => i.type);
  assert.ok(types.includes('high_views_low_purchases'));
  assert.ok(types.includes('cart_not_purchased'));
  const insight = res.body.insights.find((i) => i.type === 'cart_not_purchased');
  assert.match(insight.observed, /Desk Lamp received 45 views and 5 add-to-cart events but only 1 completed purchase in the last 30 days/);
  assert.match(insight.inferred, /^Inferred:/);
  assert.match(insight.statedReasons, /Delivery takes too long/);

  const other = await h.approvedVendor();
  const theirs = await h.api().get('/api/analytics/purchase-dropoff').set(h.auth(other.token)).expect(200);
  assert.equal(theirs.body.products.length, 0);
});
