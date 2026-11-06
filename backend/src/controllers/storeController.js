const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { Vendor, Product, Order } = require('../models');
const { attachPricing } = require('../services/pricingService');

exports.list = asyncHandler(async (req, res) => {
  const stores = await Vendor.find({ status: 'approved' }).select('storeName city description categories createdAt').sort({ storeName: 1 }).lean();
  res.json({ success: true, stores });
});

exports.getOne = asyncHandler(async (req, res) => {
  const store = await Vendor.findOne({ _id: req.params.id, status: 'approved' }).select('storeName city description categories createdAt user').lean();
  if (!store) throw ApiError.notFound('Store not found');
  const [products, delivered] = await Promise.all([
    Product.find({ store: store._id, isActive: true, isBlocked: false, isArchived: { $ne: true } }).sort({ salesCount: -1 }).lean(),
    Order.countDocuments({ vendor: store.user, status: 'delivered' }),
  ]);
  delete store.user;
  res.json({ success: true, store, stats: { products: products.length, deliveredOrders: delivered }, products: await attachPricing(products) });
});
