process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/smart_marketplace_test';

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const M = require('../src/models');

const DAY = 86400000;
let counter = 0;

async function setup() {
  await connectDB(process.env.MONGODB_URI);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(M).map((m) => m.syncIndexes()));
}
const teardown = () => disconnectDB();
const api = () => request(app);

async function register(role = 'customer', extra = {}) {
  counter += 1;
  const body = {
    name: `${role} ${counter}`,
    email: `${role}${counter}@test.dev`,
    password: 'Passw0rd!',
    role,
    ...(role === 'vendor' ? { storeName: `Store ${counter}`, categories: ['Electronics'] } : {}),
    ...extra,
  };
  const res = await api().post('/api/auth/register').send(body);
  if (res.status !== 201) throw new Error(`register failed: ${JSON.stringify(res.body)}`);
  return { token: res.body.token, user: res.body.user, vendor: res.body.vendor };
}

async function approvedVendor() {
  const v = await register('vendor');
  await M.Vendor.updateOne({ _id: v.vendor._id }, { $set: { status: 'approved' } });
  return v;
}

async function adminUser() {
  counter += 1;
  const user = await M.User.create({ name: 'Admin', email: `admin${counter}@test.dev`, password: 'Passw0rd!', role: 'admin' });
  const res = await api().post('/api/auth/login').send({ email: user.email, password: 'Passw0rd!' });
  return { token: res.body.token, user: res.body.user };
}

async function product(vendor, overrides = {}) {
  return M.Product.create({
    vendor: vendor.user._id,
    store: vendor.vendor._id,
    name: `Product ${++counter}`,
    category: 'Electronics',
    price: 1000,
    stock: 10,
    listedAt: new Date(),
    ...overrides,
  });
}

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const address = { line1: '12 Test Street', city: 'Chennai', state: 'TN', postalCode: '600001' };
const isoDay = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

module.exports = { setup, teardown, api, register, approvedVendor, adminUser, product, auth, address, isoDay, M, DAY };
