const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { User, Vendor, Product, Requirement, ActivityLog, Settings, Order } = require('../models');
const { escapeRegex, getPagination, pageMeta } = require('../utils/pagination');
const { notify } = require('../services/notificationService');
const { logActivity } = require('../services/activityService');
const { attachPricing } = require('../services/pricingService');

exports.users = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 25 });
  const [users, total] = await Promise.all([User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), User.countDocuments(filter)]);
  const orderCounts = await Order.aggregate([{ $match: { customer: { $in: users.map((u) => u._id) } } }, { $group: { _id: '$customer', n: { $sum: 1 } } }]);
  const oc = new Map(orderCounts.map((o) => [String(o._id), o.n]));
  res.json({ success: true, users: users.map((u) => ({ ...u, password: undefined, orderCount: oc.get(String(u._id)) || 0 })), ...pageMeta(total, page, limit) });
});

exports.setUserStatus = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) throw ApiError.badRequest('You cannot change your own account status');
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  if (user.role === 'admin') throw ApiError.forbidden('Administrator accounts cannot be suspended here');
  user.isActive = req.body.isActive;
  await user.save();
  await logActivity(req.user, user.isActive ? 'user.activated' : 'user.suspended', { entityType: 'User', entityId: user._id, summary: user.email });
  res.json({ success: true, user });
});

exports.vendors = asyncHandler(async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  const vendors = await Vendor.find(filter).sort({ createdAt: -1 }).populate('user', 'name email isActive createdAt').lean();
  const counts = await Product.aggregate([{ $match: { isArchived: { $ne: true } } }, { $group: { _id: '$store', n: { $sum: 1 } } }]);
  const pc = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json({ success: true, vendors: vendors.map((v) => ({ ...v, productCount: pc.get(String(v._id)) || 0 })) });
});

exports.setVendorStatus = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) throw ApiError.notFound('Vendor not found');
  vendor.status = req.body.status;
  vendor.statusNote = req.body.note;
  if (vendor.status === 'approved' && !vendor.approvedAt) vendor.approvedAt = new Date();
  await vendor.save();
  await notify(vendor.user, {
    type: 'account',
    title: `Your store "${vendor.storeName}" is now ${vendor.status}`,
    message: req.body.note,
    link: '/vendor',
  });
  await logActivity(req.user, `vendor.${vendor.status}`, { entityType: 'Vendor', entityId: vendor._id, summary: vendor.storeName });
  res.json({ success: true, vendor });
});

exports.products = asyncHandler(async (req, res) => {
  const filter = { isArchived: { $ne: true } };
  if (req.query.q) filter.name = new RegExp(escapeRegex(req.query.q), 'i');
  if (req.query.blocked === 'true') filter.isBlocked = true;
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 25 });
  const [products, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('store', 'storeName status').lean(),
    Product.countDocuments(filter),
  ]);
  res.json({ success: true, products: await attachPricing(products), ...pageMeta(total, page, limit) });
});

exports.moderateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound('Product not found');
  product.isBlocked = req.body.isBlocked;
  product.blockReason = req.body.isBlocked ? req.body.reason : undefined;
  await product.save();
  await notify(product.vendor, {
    type: 'system',
    title: `Product ${product.isBlocked ? 'hidden' : 'restored'} by admin: ${product.name}`,
    message: req.body.reason,
    link: '/vendor/products',
  });
  await logActivity(req.user, product.isBlocked ? 'product.blocked' : 'product.unblocked', { entityType: 'Product', entityId: product._id, summary: product.name });
  res.json({ success: true, product });
});

exports.requirements = asyncHandler(async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  const requirements = await Requirement.find(filter).sort({ createdAt: -1 }).limit(200).populate('customer', 'name email').lean();
  res.json({ success: true, requirements });
});

exports.activity = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.action) filter.action = new RegExp(`^${escapeRegex(req.query.action)}`);
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 50 });
  const [logs, total] = await Promise.all([
    ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('actor', 'name email').lean(),
    ActivityLog.countDocuments(filter),
  ]);
  res.json({ success: true, logs, ...pageMeta(total, page, limit) });
});

exports.getSettings = asyncHandler(async (req, res) => {
  res.json({ success: true, settings: await Settings.get(), defaults: Settings.DEFAULTS });
});

exports.updateSettings = asyncHandler(async (req, res) => {
  const current = await Settings.get();
  const next = {
    deadStock: { ...current.deadStock, ...(req.body.deadStock || {}) },
    dropoff: { ...current.dropoff, ...(req.body.dropoff || {}) },
    rescue: { ...current.rescue, ...(req.body.rescue || {}) },
  };
  const d = next.deadStock;
  if (!(d.slowMovingDays < d.atRiskDays && d.atRiskDays < d.deadStockDays)) {
    throw ApiError.badRequest('Thresholds must increase: slow-moving < at-risk < dead stock days');
  }
  if (!(d.slowCoverDays < d.atRiskCoverDays)) throw ApiError.badRequest('Slow-moving cover days must be lower than at-risk cover days');
  if (next.rescue.minDiscountPercent > next.rescue.maxDiscountPercent) throw ApiError.badRequest('Minimum discount cannot exceed maximum discount');
  await Settings.findByIdAndUpdate('platform', { $set: next }, { upsert: true });
  await logActivity(req.user, 'settings.updated', { entityType: 'Settings', summary: 'Thresholds updated' });
  res.json({ success: true, settings: await Settings.get() });
});
