const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { Order } = require('../models');
const { getPagination, pageMeta, escapeRegex } = require('../utils/pagination');
const { placeOrderFromCart, cancelOrder, updateOrderStatus } = require('../services/orderService');

const POPULATE = [
  { path: 'store', select: 'storeName city' },
  { path: 'customer', select: 'name email phone' },
  { path: 'requirement', select: 'title' },
];

exports.place = asyncHandler(async (req, res) => {
  const orders = await placeOrderFromCart(req.user, req.body);
  res.status(201).json({ success: true, orders });
});

async function listOrders(req, res, base) {
  const filter = { ...base };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.q) filter.orderNumber = new RegExp(escapeRegex(req.query.q), 'i');
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 20 });
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate(POPULATE).lean(),
    Order.countDocuments(filter),
  ]);
  res.json({ success: true, orders, ...pageMeta(total, page, limit) });
}

exports.mine = asyncHandler((req, res) => listOrders(req, res, { customer: req.user._id }));
exports.vendorOrders = asyncHandler((req, res) => listOrders(req, res, { vendor: req.user._id }));
exports.all = asyncHandler((req, res) => listOrders(req, res, {}));

async function accessibleOrder(req) {
  const order = await Order.findById(req.params.id).populate(POPULATE);
  if (!order) throw ApiError.notFound('Order not found');
  const uid = String(req.user._id);
  const allowed =
    req.user.role === 'admin' || String(order.customer._id) === uid || String(order.vendor) === uid;
  if (!allowed) throw ApiError.notFound('Order not found');
  return order;
}

exports.getOne = asyncHandler(async (req, res) => {
  const order = await accessibleOrder(req);
  // Customers' contact details are only visible to the fulfilling vendor and admins.
  res.json({ success: true, order });
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const order = await accessibleOrder(req);
  if (req.user.role === 'vendor' && String(order.vendor) !== String(req.user._id)) throw ApiError.forbidden();
  if (req.user.role === 'customer') throw ApiError.forbidden('Customers can only cancel orders');
  const updated = await updateOrderStatus(order, req.user, req.body.status, req.body.note);
  res.json({ success: true, order: updated });
});

exports.cancel = asyncHandler(async (req, res) => {
  const order = await accessibleOrder(req);
  const updated = await cancelOrder(order, req.user, req.body.reason || `Cancelled by ${req.user.role}`);
  res.json({ success: true, order: updated });
});
