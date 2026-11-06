const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { Product, Vendor, Order } = require('../models');
const { CATEGORIES } = require('../config/constants');
const { getPagination, pageMeta, escapeRegex } = require('../utils/pagination');
const { attachPricing } = require('../services/pricingService');
const { recordView } = require('../services/trackingService');
const { syncDealWithPrice } = require('../services/rescueDealService');
const { logActivity } = require('../services/activityService');

async function publicFilter() {
  const stores = await Vendor.find({ status: 'approved' }).distinct('_id');
  return { isActive: true, isBlocked: false, isArchived: { $ne: true }, store: { $in: stores } };
}

const SORTS = {
  newest: { listedAt: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  popular: { salesCount: -1, listedAt: -1 },
  name: { name: 1 },
};

exports.list = asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const filter = await publicFilter();
  if (q.category) filter.category = q.category;
  if (q.store) filter.store = { $in: filter.store.$in.filter((s) => String(s) === q.store) };
  if (q.inStock === 'true') filter.stock = { $gt: 0 };
  if (q.minPrice != null || q.maxPrice != null) {
    filter.price = {};
    if (q.minPrice != null) filter.price.$gte = q.minPrice;
    if (q.maxPrice != null) filter.price.$lte = q.maxPrice;
  }
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ name: rx }, { brand: rx }, { description: rx }, { category: rx }];
  }
  const { page, limit, skip } = getPagination(q, { defaultLimit: 12 });
  const [items, total] = await Promise.all([
    Product.find(filter).sort(SORTS[q.sort]).skip(skip).limit(limit).populate('store', 'storeName city').lean(),
    Product.countDocuments(filter),
  ]);
  res.json({ success: true, products: await attachPricing(items), ...pageMeta(total, page, limit) });
});

exports.categories = asyncHandler(async (req, res) => {
  const filter = await publicFilter();
  const counts = await Product.aggregate([{ $match: filter }, { $group: { _id: '$category', n: { $sum: 1 } } }]);
  const map = new Map(counts.map((c) => [c._id, c.n]));
  res.json({ success: true, categories: CATEGORIES.map((name) => ({ name, count: map.get(name) || 0 })) });
});

exports.getOne = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('store', 'storeName city description status createdAt categories').lean();
  if (!product) throw ApiError.notFound('Product not found');
  const isOwner = req.user && String(product.vendor) === String(req.user._id);
  const isAdmin = req.user?.role === 'admin';
  const visible = product.isActive && !product.isBlocked && !product.isArchived && product.store?.status === 'approved';
  if (!visible && !isOwner && !isAdmin) throw ApiError.notFound('Product not found');

  const filter = await publicFilter();
  const [vendorProducts, delivered, related] = await Promise.all([
    Product.countDocuments({ ...filter, vendor: product.vendor }),
    Order.countDocuments({ vendor: product.vendor, status: 'delivered' }),
    Product.find({ ...filter, category: product.category, _id: { $ne: product._id } }).sort({ salesCount: -1 }).limit(4).populate('store', 'storeName').lean(),
  ]);
  res.json({
    success: true,
    product: await attachPricing(product),
    vendorStats: { products: vendorProducts, deliveredOrders: delivered },
    related: await attachPricing(related),
  });
});

exports.trackEvent = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).select('vendor').lean();
  if (!product) throw ApiError.notFound('Product not found');
  const result = await recordView({ user: req.user, sessionId: req.body.sessionId, product });
  res.status(result.recorded ? 201 : 200).json({ success: true, ...result });
});

// ---- Vendor catalogue management ----

exports.vendorList = asyncHandler(async (req, res) => {
  const filter = { vendor: req.user._id, isArchived: { $ne: true } };
  if (req.query.q) filter.name = new RegExp(escapeRegex(req.query.q), 'i');
  const items = await Product.find(filter).sort({ updatedAt: -1 }).lean();
  res.json({ success: true, products: await attachPricing(items) });
});

exports.create = asyncHandler(async (req, res) => {
  const product = await Product.create({ ...req.body, vendor: req.user._id, store: req.vendorProfile._id, listedAt: new Date() });
  await logActivity(req.user, 'product.created', { entityType: 'Product', entityId: product._id, summary: product.name });
  res.status(201).json({ success: true, product });
});

async function ownedProduct(req) {
  const product = await Product.findOne({ _id: req.params.id, isArchived: { $ne: true } });
  if (!product) throw ApiError.notFound('Product not found');
  if (String(product.vendor) !== String(req.user._id)) throw ApiError.forbidden('You can only manage your own products');
  return product;
}

exports.update = asyncHandler(async (req, res) => {
  const product = await ownedProduct(req);
  const priceChanged = req.body.price != null && req.body.price !== product.price;
  Object.assign(product, req.body);
  await product.save();
  if (priceChanged) await syncDealWithPrice(product._id, product.price);
  await logActivity(req.user, 'product.updated', { entityType: 'Product', entityId: product._id, summary: product.name });
  res.json({ success: true, product: await attachPricing(product) });
});

// Products are archived rather than hard-deleted so past orders, events and insights stay valid.
exports.remove = asyncHandler(async (req, res) => {
  const product = await ownedProduct(req);
  product.isArchived = true;
  product.isActive = false;
  await product.save();
  const { RescueDeal } = require('../models');
  await RescueDeal.updateMany({ product: product._id, status: 'active' }, { $set: { status: 'cancelled', endsAt: new Date() } });
  await logActivity(req.user, 'product.deleted', { entityType: 'Product', entityId: product._id, summary: product.name });
  res.json({ success: true, message: 'Product removed from your catalogue' });
});

exports.publicFilter = publicFilter;
