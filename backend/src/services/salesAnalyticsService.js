const mongoose = require('mongoose');
const { Order, Analytics, Product, InventoryInsight, Offer, Requirement, RescueDeal, User, Vendor, Report } = require('../models');
const { DAY_MS } = require('../utils/dates');
const { RISK } = require('../config/constants');

const oid = (id) => new mongoose.Types.ObjectId(String(id));

function lastMonths(n, now = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

async function monthlySales(match, months) {
  const start = new Date(`${months[0]}-01T00:00:00Z`);
  const rows = await Order.aggregate([
    { $match: { ...match, status: { $ne: 'cancelled' }, createdAt: { $gte: start } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        totalSales: { $sum: '$totalAmount' },
        orderCount: { $sum: 1 },
        unitsSold: { $sum: { $sum: '$items.quantity' } },
      },
    },
  ]);
  const map = new Map(rows.map((r) => [r._id, r]));
  return months.map((m) => ({
    period: m,
    totalSales: Math.round(map.get(m)?.totalSales || 0),
    orderCount: map.get(m)?.orderCount || 0,
    unitsSold: map.get(m)?.unitsSold || 0,
  }));
}

async function riskDistribution(match) {
  const rows = await InventoryInsight.aggregate([{ $match: match }, { $group: { _id: '$riskStatus', n: { $sum: 1 } } }]);
  const out = Object.fromEntries(Object.values(RISK).map((k) => [k, 0]));
  for (const r of rows) out[r._id] = r.n;
  return out;
}

async function vendorSummary(vendorId) {
  const vendor = oid(vendorId);
  const months = lastMonths(6);
  const monthly = await monthlySales({ vendor }, months);

  // Persist the monthly summary (ER: Analytics) so it can be queried historically.
  await Analytics.bulkWrite(
    monthly.map((m) => ({ updateOne: { filter: { vendor, period: m.period }, update: { $set: m }, upsert: true } }))
  );

  const since30 = new Date(Date.now() - 30 * DAY_MS);
  const [last30] = await Order.aggregate([
    { $match: { vendor, status: { $ne: 'cancelled' }, createdAt: { $gte: since30 } } },
    { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
  ]);
  const statusRows = await Order.aggregate([{ $match: { vendor } }, { $group: { _id: '$status', n: { $sum: 1 } } }]);
  const topProducts = await Order.aggregate([
    { $match: { vendor, status: { $ne: 'cancelled' }, createdAt: { $gte: since30 } } },
    { $unwind: '$items' },
    { $group: { _id: '$items.name', revenue: { $sum: '$items.lineTotal' }, units: { $sum: '$items.quantity' } } },
    { $sort: { revenue: -1 } },
    { $limit: 5 },
  ]);
  const productFilter = { vendor, isArchived: { $ne: true } };
  const [productCount, lowStock, outOfStock, pendingOffers, activeDeals, openOrders] = await Promise.all([
    Product.countDocuments(productFilter),
    Product.countDocuments({ ...productFilter, stock: { $gt: 0, $lte: 5 } }),
    Product.countDocuments({ ...productFilter, stock: 0 }),
    Offer.countDocuments({ vendor, status: 'pending' }),
    RescueDeal.countDocuments({ vendor, status: 'active', endsAt: { $gt: new Date() } }),
    Order.countDocuments({ vendor, status: { $in: ['placed', 'confirmed'] } }),
  ]);
  const vendorDoc = await Vendor.findOne({ user: vendor }).lean();
  const openRequirements = await Requirement.countDocuments({
    status: 'open',
    requiredBy: { $gte: new Date() },
    ...(vendorDoc?.categories?.length ? { category: { $in: vendorDoc.categories } } : {}),
  });

  return {
    revenue30d: Math.round(last30?.revenue || 0),
    orders30d: last30?.orders || 0,
    monthly,
    ordersByStatus: Object.fromEntries(statusRows.map((r) => [r._id, r.n])),
    topProducts: topProducts.map((t) => ({ name: t._id, revenue: Math.round(t.revenue), units: t.units })),
    productCount,
    lowStock,
    outOfStock,
    pendingOffers,
    activeDeals,
    openOrders,
    openRequirements,
    riskDistribution: await riskDistribution({ vendor }),
  };
}

async function platformSummary() {
  const months = lastMonths(6);
  const since30 = new Date(Date.now() - 30 * DAY_MS);
  const [usersByRole, vendorsByStatus, ordersByStatus, gmv30, monthly, topVendors, categorySales, reqStats, offersPerReq, openReports, risk] =
    await Promise.all([
      User.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }]),
      Vendor.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      Order.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { status: { $ne: 'cancelled' }, createdAt: { $gte: since30 } } },
        { $group: { _id: null, gmv: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
      ]),
      monthlySales({}, months),
      Order.aggregate([
        { $match: { status: { $ne: 'cancelled' }, createdAt: { $gte: since30 } } },
        { $group: { _id: '$store', revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'vendors', localField: '_id', foreignField: '_id', as: 'store' } },
        { $project: { revenue: 1, orders: 1, storeName: { $first: '$store.storeName' } } },
      ]),
      Order.aggregate([
        { $match: { status: { $ne: 'cancelled' }, createdAt: { $gte: since30 } } },
        { $unwind: '$items' },
        { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'p' } },
        { $group: { _id: { $ifNull: [{ $first: '$p.category' }, 'Requirement orders'] }, revenue: { $sum: '$items.lineTotal' } } },
        { $sort: { revenue: -1 } },
      ]),
      Requirement.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      Offer.aggregate([{ $group: { _id: '$requirement', n: { $sum: 1 } } }, { $group: { _id: null, avg: { $avg: '$n' } } }]),
      Report.countDocuments({ status: { $in: ['open', 'in_review'] } }),
      riskDistribution({}),
    ]);
  const toObj = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.n]));
  return {
    usersByRole: toObj(usersByRole),
    vendorsByStatus: toObj(vendorsByStatus),
    ordersByStatus: toObj(ordersByStatus),
    gmv30d: Math.round(gmv30[0]?.gmv || 0),
    orders30d: gmv30[0]?.orders || 0,
    monthly,
    topVendors: topVendors.map((v) => ({ storeName: v.storeName, revenue: Math.round(v.revenue), orders: v.orders })),
    categorySales: categorySales.map((c) => ({ category: c._id, revenue: Math.round(c.revenue) })),
    requirementsByStatus: toObj(reqStats),
    avgOffersPerRequirement: Number((offersPerReq[0]?.avg || 0).toFixed(1)),
    openReports,
    riskDistribution: risk,
    activeDeals: await RescueDeal.countDocuments({ status: 'active', endsAt: { $gt: new Date() } }),
    productCount: await Product.countDocuments({ isArchived: { $ne: true } }),
  };
}

module.exports = { vendorSummary, platformSummary };
