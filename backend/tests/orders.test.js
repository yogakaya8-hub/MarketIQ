const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

before(h.setup);
after(h.teardown);

test('checkout splits orders per vendor, decrements stock and records the purchase funnel', async () => {
  const c = await h.register('customer');
  const v1 = await h.approvedVendor();
  const v2 = await h.approvedVendor();
  const p1 = await h.product(v1, { price: 500, stock: 5 });
  const p2 = await h.product(v2, { price: 200, stock: 3 });

  await h.api().post('/api/cart/items').set(h.auth(c.token)).send({ productId: p1._id, quantity: 2 }).expect(201);
  await h.api().post('/api/cart/items').set(h.auth(c.token)).send({ productId: p2._id, quantity: 1 }).expect(201);
  await h.api().patch(`/api/cart/items/${p2._id}`).set(h.auth(c.token)).send({ quantity: 3 }).expect(200);
  await h.api().post('/api/cart/checkout-intent').set(h.auth(c.token)).expect(200);
  const res = await h.api().post('/api/orders').set(h.auth(c.token)).send({ shippingAddress: h.address }).expect(201);

  assert.equal(res.body.orders.length, 2);
  const totals = res.body.orders.map((o) => o.totalAmount).sort((a, b) => a - b);
  assert.deepEqual(totals, [600, 1000]);
  assert.equal((await h.M.Product.findById(p1._id)).stock, 3);
  assert.equal((await h.M.Product.findById(p2._id)).stock, 0);
  assert.equal((await h.M.Product.findById(p1._id)).salesCount, 2);

  const types = (await h.M.PurchaseEvent.find({ user: c.user._id, product: p2._id }).lean()).map((e) => e.eventType).sort();
  assert.deepEqual(types, ['added_to_cart', 'cart_quantity_changed', 'checkout_initiated', 'purchase_completed']);
  const cart = await h.api().get('/api/cart').set(h.auth(c.token));
  assert.equal(cart.body.cart.items.length, 0);
});

test('concurrent checkouts can never oversell the last unit', async () => {
  const v = await h.approvedVendor();
  const p = await h.product(v, { stock: 1 });
  const buyers = await Promise.all([1, 2, 3, 4].map(() => h.register('customer')));
  for (const b of buyers) await h.api().post('/api/cart/items').set(h.auth(b.token)).send({ productId: p._id, quantity: 1 }).expect(201);
  const results = await Promise.all(buyers.map((b) => h.api().post('/api/orders').set(h.auth(b.token)).send({ shippingAddress: h.address })));
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.ok(results.filter((r) => r.status !== 201).every((r) => r.status === 409));
  assert.equal((await h.M.Product.findById(p._id)).stock, 0);
});

test('prices are computed on the server, never taken from the client', async () => {
  const c = await h.register('customer');
  const v = await h.approvedVendor();
  const p = await h.product(v, { price: 999 });
  await h.api().post('/api/cart/items').set(h.auth(c.token)).send({ productId: p._id, quantity: 1, price: 1 }).expect(201);
  const res = await h.api().post('/api/orders').set(h.auth(c.token)).send({ shippingAddress: h.address, totalAmount: 1 }).expect(201);
  assert.equal(res.body.orders[0].totalAmount, 999);
});

test('order status follows the allowed workflow and cancellation restores stock', async () => {
  const c = await h.register('customer');
  const v = await h.approvedVendor();
  const other = await h.approvedVendor();
  const p = await h.product(v, { stock: 4 });
  await h.api().post('/api/cart/items').set(h.auth(c.token)).send({ productId: p._id, quantity: 2 });
  const { body } = await h.api().post('/api/orders').set(h.auth(c.token)).send({ shippingAddress: h.address });
  const id = body.orders[0]._id;

  assert.equal((await h.api().patch(`/api/orders/${id}/status`).set(h.auth(other.token)).send({ status: 'confirmed' })).status, 404, 'other vendors cannot even see the order');
  assert.equal((await h.api().patch(`/api/orders/${id}/status`).set(h.auth(v.token)).send({ status: 'delivered' })).status, 400);
  await h.api().patch(`/api/orders/${id}/status`).set(h.auth(v.token)).send({ status: 'confirmed' }).expect(200);

  await h.api().post(`/api/orders/${id}/cancel`).set(h.auth(c.token)).send({ reason: 'Changed plans' }).expect(200);
  const prod = await h.M.Product.findById(p._id);
  assert.equal(prod.stock, 4);
  assert.equal(prod.salesCount, 0);
  const purchase = await h.M.PurchaseEvent.findOne({ order: id });
  assert.equal(purchase.metadata.cancelled, true);
  assert.equal((await h.api().post(`/api/orders/${id}/cancel`).set(h.auth(c.token)).send({})).status, 400);
});

test('customers cannot read other customers\' orders', async () => {
  const a = await h.register('customer');
  const b = await h.register('customer');
  const v = await h.approvedVendor();
  const p = await h.product(v);
  await h.api().post('/api/cart/items').set(h.auth(a.token)).send({ productId: p._id, quantity: 1 });
  const { body } = await h.api().post('/api/orders').set(h.auth(a.token)).send({ shippingAddress: h.address });
  assert.equal((await h.api().get(`/api/orders/${body.orders[0]._id}`).set(h.auth(b.token))).status, 404);
});
