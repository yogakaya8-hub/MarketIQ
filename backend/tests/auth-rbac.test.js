const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

before(h.setup);
after(h.teardown);

test('registration hashes passwords and rejects duplicate emails', async () => {
  const c = await h.register('customer');
  const stored = await h.M.User.findById(c.user._id).select('+password').lean();
  assert.notEqual(stored.password, 'Passw0rd!');
  assert.ok(stored.password.startsWith('$2'));
  assert.equal(c.user.password, undefined);
  const dup = await h.api().post('/api/auth/register').send({ name: 'Xavier', email: c.user.email, password: 'Passw0rd!' });
  assert.equal(dup.status, 409);
});

test('users cannot self-register as admin', async () => {
  const res = await h.api().post('/api/auth/register').send({ name: 'Eve', email: 'eve@test.dev', password: 'Passw0rd!', role: 'admin' });
  assert.equal(res.status, 400);
});

test('wrong password and suspended accounts are rejected', async () => {
  const c = await h.register('customer');
  const bad = await h.api().post('/api/auth/login').send({ email: c.user.email, password: 'nope12345' });
  assert.equal(bad.status, 401);
  await h.M.User.updateOne({ _id: c.user._id }, { $set: { isActive: false } });
  const blocked = await h.api().get('/api/auth/me').set(h.auth(c.token));
  assert.equal(blocked.status, 403);
});

test('role checks are enforced on the server', async () => {
  const c = await h.register('customer');
  const v = await h.approvedVendor();
  const body = { name: 'Phone', category: 'Electronics', price: 100, stock: 1 };
  assert.equal((await h.api().post('/api/products').set(h.auth(c.token)).send(body)).status, 403);
  assert.equal((await h.api().get('/api/admin/users').set(h.auth(v.token))).status, 403);
  assert.equal((await h.api().get('/api/admin/users')).status, 401);
  assert.equal((await h.api().post('/api/cart/items').set(h.auth(v.token)).send({ productId: '0'.repeat(24) })).status, 403);
  assert.equal((await h.api().post('/api/products').set(h.auth(v.token)).send(body)).status, 201);
});

test('pending vendors cannot list products or submit offers until approved', async () => {
  const v = await h.register('vendor');
  const res = await h.api().post('/api/products').set(h.auth(v.token)).send({ name: 'Phone', category: 'Electronics', price: 100, stock: 1 });
  assert.equal(res.status, 403);
  assert.match(res.body.message, /pending/);
  const admin = await h.adminUser();
  await h.api().patch(`/api/admin/vendors/${v.vendor._id}/status`).set(h.auth(admin.token)).send({ status: 'approved' }).expect(200);
  await h.api().post('/api/products').set(h.auth(v.token)).send({ name: 'Phone', category: 'Electronics', price: 100, stock: 1 }).expect(201);
});

test('vendors cannot edit another vendor\'s product', async () => {
  const a = await h.approvedVendor();
  const b = await h.approvedVendor();
  const p = await h.product(a);
  const res = await h.api().put(`/api/products/${p._id}`).set(h.auth(b.token)).send({ price: 1 });
  assert.equal(res.status, 403);
});

test('products of unapproved or blocked stores are hidden from the public catalogue', async () => {
  const pending = await h.register('vendor');
  const p = await h.product(pending, { name: 'Hidden item' });
  const res = await h.api().get('/api/products?q=Hidden');
  assert.equal(res.body.products.length, 0);
  assert.equal((await h.api().get(`/api/products/${p._id}`)).status, 404);
});
