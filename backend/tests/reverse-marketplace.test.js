const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

before(h.setup);
after(h.teardown);

async function postRequirement(customer, overrides = {}) {
  const res = await h.api().post('/api/requirements').set(h.auth(customer.token)).send({
    title: 'Office chairs', description: 'Ergonomic mesh chairs for our office', category: 'Electronics',
    quantity: 10, budget: 50000, requiredBy: h.isoDay(10), ...overrides,
  });
  return res;
}

test('requirement validation rejects past dates and vendors cannot post requirements', async () => {
  const c = await h.register('customer');
  const v = await h.approvedVendor();
  assert.equal((await postRequirement(c, { requiredBy: h.isoDay(-2) })).status, 400);
  assert.equal((await postRequirement(c, { budget: 0 })).status, 400);
  assert.equal((await postRequirement(v)).status, 403);
  assert.equal((await postRequirement(c)).status, 201);
});

test('offer rules: valid terms only, no duplicates, delivery before required date', async () => {
  const c = await h.register('customer');
  const v = await h.approvedVendor();
  const { body } = await postRequirement(c);
  const reqId = body.requirement._id;

  assert.equal((await h.api().post('/api/offers').set(h.auth(v.token)).send({ requirementId: reqId, totalPrice: 40000, deliveryDays: 30 })).status, 400);
  assert.equal((await h.api().post('/api/offers').set(h.auth(v.token)).send({ requirementId: reqId, totalPrice: -5, deliveryDays: 3 })).status, 400);
  await h.api().post('/api/offers').set(h.auth(v.token)).send({ requirementId: reqId, totalPrice: 40000, deliveryDays: 5 }).expect(201);
  assert.equal((await h.api().post('/api/offers').set(h.auth(v.token)).send({ requirementId: reqId, totalPrice: 39000, deliveryDays: 5 })).status, 409);

  const lowStock = await h.product(v, { stock: 2 });
  const v2 = await h.approvedVendor();
  const notMine = await h.api().post('/api/offers').set(h.auth(v2.token)).send({ requirementId: reqId, totalPrice: 1, deliveryDays: 2, productId: lowStock._id });
  assert.equal(notMine.status, 400);

  const pending = await h.register('vendor');
  assert.equal((await h.api().post('/api/offers').set(h.auth(pending.token)).send({ requirementId: reqId, totalPrice: 1, deliveryDays: 2 })).status, 403);
});

test('customer compares offers and selects one: requirement closes, order is created, others rejected', async () => {
  const c = await h.register('customer');
  const stranger = await h.register('customer');
  const v1 = await h.approvedVendor();
  const v2 = await h.approvedVendor();
  const stock = await h.product(v1, { stock: 15 });
  const { body } = await postRequirement(c);
  const reqId = body.requirement._id;
  const o1 = (await h.api().post('/api/offers').set(h.auth(v1.token)).send({ requirementId: reqId, totalPrice: 45000, deliveryDays: 4, productId: stock._id })).body.offer;
  const o2 = (await h.api().post('/api/offers').set(h.auth(v2.token)).send({ requirementId: reqId, totalPrice: 55000, deliveryDays: 2 })).body.offer;

  const view = await h.api().get(`/api/requirements/${reqId}`).set(h.auth(c.token)).expect(200);
  assert.equal(view.body.offers.length, 2);
  const cheap = view.body.offers.find((o) => o._id === o1._id);
  const fast = view.body.offers.find((o) => o._id === o2._id);
  assert.ok(cheap.tags.includes('Lowest price'));
  assert.ok(fast.tags.includes('Fastest delivery'));
  assert.equal(fast.overBudget, true);
  assert.equal(cheap.unitPrice, 4500);

  // Vendors only see a masked customer and never other vendors' prices.
  const vendorView = await h.api().get(`/api/requirements/${reqId}`).set(h.auth(v2.token)).expect(200);
  assert.equal(vendorView.body.offers, undefined);
  assert.equal(vendorView.body.requirement.customer.email, undefined);

  assert.equal((await h.api().put(`/api/offers/${o1._id}`).set(h.auth(stranger.token)).send({ action: 'select', shippingAddress: h.address })).status, 403);
  assert.equal((await h.api().put(`/api/offers/${o1._id}`).set(h.auth(v1.token)).send({ action: 'select', shippingAddress: h.address })).status, 403);

  const sel = await h.api().put(`/api/offers/${o1._id}`).set(h.auth(c.token)).send({ action: 'select', shippingAddress: h.address }).expect(200);
  assert.equal(sel.body.requirement.status, 'awarded');
  assert.equal(sel.body.order.totalAmount, 45000);
  assert.equal(sel.body.order.source, 'requirement');
  assert.equal((await h.M.Offer.findById(o2._id)).status, 'rejected');
  assert.equal((await h.M.Product.findById(stock._id)).stock, 5);

  const again = await h.api().put(`/api/offers/${o2._id}`).set(h.auth(c.token)).send({ action: 'select', shippingAddress: h.address });
  assert.equal(again.status, 409);
  const late = await h.api().post('/api/offers').set(h.auth((await h.approvedVendor()).token)).send({ requirementId: reqId, totalPrice: 1000, deliveryDays: 2 });
  assert.equal(late.status, 409);
});

test('two simultaneous selections on the same requirement: exactly one succeeds', async () => {
  const c = await h.register('customer');
  const vs = await Promise.all([1, 2, 3].map(() => h.approvedVendor()));
  const { body } = await postRequirement(c);
  const offers = [];
  for (const v of vs) offers.push((await h.api().post('/api/offers').set(h.auth(v.token)).send({ requirementId: body.requirement._id, totalPrice: 30000, deliveryDays: 3 })).body.offer);
  const results = await Promise.all(offers.map((o) => h.api().put(`/api/offers/${o._id}`).set(h.auth(c.token)).send({ action: 'select', shippingAddress: h.address })));
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.equal(await h.M.Order.countDocuments({ requirement: body.requirement._id }), 1);
  assert.equal(await h.M.Offer.countDocuments({ requirement: body.requirement._id, status: 'accepted' }), 1);
});

test('vendors can revise and withdraw their own pending offers', async () => {
  const c = await h.register('customer');
  const v = await h.approvedVendor();
  const { body } = await postRequirement(c);
  const offer = (await h.api().post('/api/offers').set(h.auth(v.token)).send({ requirementId: body.requirement._id, totalPrice: 30000, deliveryDays: 3 })).body.offer;
  const upd = await h.api().put(`/api/offers/${offer._id}`).set(h.auth(v.token)).send({ action: 'update', totalPrice: 28000 }).expect(200);
  assert.equal(upd.body.offer.totalPrice, 28000);
  await h.api().put(`/api/offers/${offer._id}`).set(h.auth(v.token)).send({ action: 'withdraw' }).expect(200);
  const sel = await h.api().put(`/api/offers/${offer._id}`).set(h.auth(c.token)).send({ action: 'select', shippingAddress: h.address });
  assert.equal(sel.status, 409);
});
