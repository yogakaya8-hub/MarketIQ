const crypto = require('crypto');
const { Product, Order, Cart, Vendor, RescueDeal, PurchaseEvent } = require('../models');
const ApiError = require('../utils/ApiError');
const { round2 } = require('../utils/money');
const { ORDER_TRANSITIONS, EVENT_TYPES, ROLES } = require('../config/constants');
const { activeDealsFor } = require('./pricingService');
const { recordPurchases } = require('./trackingService');
const { notify } = require('./notificationService');
const { logActivity } = require('./activityService');

const newOrderNumber = () => {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `ORD-${ymd}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
};

const PURCHASABLE = { isActive: true, isBlocked: false, isArchived: { $ne: true } };

async function recomputeLastSale(productId) {
  const [last] = await Order.find({ 'items.product': productId, status: { $ne: 'cancelled' } })
    .sort({ createdAt: -1 })
    .limit(1)
    .select('createdAt')
    .lean();
  await Product.updateOne({ _id: productId }, { $set: { lastSaleDate: last ? last.createdAt : null } });
}

async function releaseStock(lines) {
  for (const { productId, quantity } of lines) {
    await Product.updateOne({ _id: productId }, { $inc: { stock: quantity, salesCount: -quantity } });
    await recomputeLastSale(productId);
  }
}

// Atomically decrements stock line by line. Each update only succeeds when enough stock remains,
// so concurrent checkouts can never oversell. On any failure the earlier lines are released.
async function reserveStock(lines) {
  const applied = [];
  const now = new Date();
  for (const line of lines) {
    const prev = await Product.findOneAndUpdate(
      { _id: line.productId, stock: { $gte: line.quantity }, ...PURCHASABLE },
      { $inc: { stock: -line.quantity, salesCount: line.quantity }, $set: { lastSaleDate: now } }
    );
    if (!prev) {
      await releaseStock(applied);
      const current = await Product.findById(line.productId).select('name stock').lean();
      throw ApiError.conflict(
        current ? `Not enough stock for "${current.name}" (only ${current.stock} left)` : 'A product in your cart is no longer available'
      );
    }
    applied.push(line);
  }
  return applied;
}

async function placeOrderFromCart(user, { shippingAddress, paymentMethod }) {
  const cart = await Cart.findOne({ user: user._id }).populate('items.product');
  if (!cart || cart.items.length === 0) throw ApiError.badRequest('Your cart is empty');

  const missing = cart.items.filter((i) => !i.product);
  if (missing.length) throw ApiError.conflict('Some cart items no longer exist. Please review your cart.');

  const products = cart.items.map((i) => i.product);
  const approvedStores = new Set(
    (await Vendor.find({ _id: { $in: products.map((p) => p.store) }, status: 'approved' }).select('_id').lean()).map((v) => String(v._id))
  );
  for (const { product, quantity } of cart.items) {
    if (!product.isActive || product.isBlocked || product.isArchived || !approvedStores.has(String(product.store))) {
      throw ApiError.conflict(`"${product.name}" is no longer available. Remove it from your cart to continue.`);
    }
    if (product.stock < quantity) throw ApiError.conflict(`Not enough stock for "${product.name}" (only ${product.stock} left)`);
  }

  // Prices are always computed on the server at the moment of purchase.
  const deals = await activeDealsFor(products.map((p) => p._id));
  const byVendor = new Map();
  for (const { product, quantity } of cart.items) {
    const deal = deals.get(String(product._id));
    const unitPrice = deal ? deal.dealPrice : product.price;
    const key = String(product.vendor);
    if (!byVendor.has(key)) byVendor.set(key, { vendor: product.vendor, store: product.store, items: [] });
    byVendor.get(key).items.push({
      product: product._id,
      name: product.name,
      quantity,
      unitPrice,
      originalUnitPrice: product.price,
      rescueDeal: deal?._id,
      lineTotal: round2(unitPrice * quantity),
    });
  }

  const reserved = await reserveStock(cart.items.map((i) => ({ productId: i.product._id, quantity: i.quantity })));

  const checkoutGroup = crypto.randomUUID();
  const created = [];
  try {
    for (const group of byVendor.values()) {
      const order = await Order.create({
        orderNumber: newOrderNumber(),
        checkoutGroup,
        customer: user._id,
        vendor: group.vendor,
        store: group.store,
        source: 'cart',
        items: group.items,
        totalAmount: round2(group.items.reduce((s, i) => s + i.lineTotal, 0)),
        shippingAddress,
        paymentMethod,
        statusHistory: [{ status: 'placed', by: user._id }],
      });
      created.push(order);
    }
  } catch (err) {
    await Order.deleteMany({ _id: { $in: created.map((o) => o._id) } });
    await releaseStock(reserved);
    throw err;
  }

  // Side effects after the orders are safely stored.
  cart.items = [];
  await cart.save();
  for (const order of created) {
    await recordPurchases(order, 'cart');
    for (const item of order.items) {
      if (item.rescueDeal) {
        await RescueDeal.updateOne({ _id: item.rescueDeal }, { $inc: { unitsSold: item.quantity, revenue: item.lineTotal } });
      }
    }
    await notify(order.vendor, {
      type: 'order',
      title: `New order ${order.orderNumber}`,
      message: `${order.items.length} item(s), total ₹${order.totalAmount.toLocaleString('en-IN')}`,
      link: `/vendor/orders/${order._id}`,
    });
    await logActivity(user, 'order.placed', { entityType: 'Order', entityId: order._id, summary: `${order.orderNumber} ₹${order.totalAmount}` });
  }
  return created;
}

async function cancelOrder(order, actor, reason) {
  if (!ORDER_TRANSITIONS[order.status].includes('cancelled')) {
    throw ApiError.badRequest(`An order that is ${order.status} cannot be cancelled`);
  }
  // Guard against two concurrent cancellations restocking twice.
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: order.status },
    {
      $set: { status: 'cancelled', cancelReason: reason },
      $push: { statusHistory: { status: 'cancelled', by: actor._id, note: reason } },
    },
    { new: true }
  );
  if (!updated) throw ApiError.conflict('Order status changed in the meantime. Refresh and try again.');

  const lines = updated.items.filter((i) => i.product).map((i) => ({ productId: i.product, quantity: i.quantity }));
  await releaseStock(lines);
  for (const item of updated.items) {
    if (item.rescueDeal) {
      await RescueDeal.updateOne({ _id: item.rescueDeal }, { $inc: { unitsSold: -item.quantity, revenue: -item.lineTotal } });
    }
  }
  // A cancelled order is not a completed purchase for analytics purposes.
  await PurchaseEvent.updateMany({ order: updated._id, eventType: EVENT_TYPES.PURCHASED }, { $set: { 'metadata.cancelled': true } });

  const other = actor.role === ROLES.CUSTOMER ? updated.vendor : updated.customer;
  await notify([other], {
    type: 'order',
    title: `Order ${updated.orderNumber} cancelled`,
    message: reason ? `Reason: ${reason}` : `Cancelled by ${actor.role}`,
    link: actor.role === ROLES.CUSTOMER ? `/vendor/orders/${updated._id}` : `/orders/${updated._id}`,
  });
  await logActivity(actor, 'order.cancelled', { entityType: 'Order', entityId: updated._id, summary: updated.orderNumber });
  return updated;
}

async function updateOrderStatus(order, actor, status, note) {
  if (status === 'cancelled') return cancelOrder(order, actor, note);
  if (!ORDER_TRANSITIONS[order.status].includes(status)) {
    throw ApiError.badRequest(`Cannot move an order from ${order.status} to ${status}`);
  }
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: order.status },
    { $set: { status }, $push: { statusHistory: { status, by: actor._id, note } } },
    { new: true }
  );
  if (!updated) throw ApiError.conflict('Order status changed in the meantime. Refresh and try again.');
  await notify(updated.customer, {
    type: 'order',
    title: `Order ${updated.orderNumber} is ${status}`,
    message: note || undefined,
    link: `/orders/${updated._id}`,
  });
  await logActivity(actor, `order.${status}`, { entityType: 'Order', entityId: updated._id, summary: updated.orderNumber });
  return updated;
}

module.exports = { placeOrderFromCart, cancelOrder, updateOrderStatus, reserveStock, releaseStock, newOrderNumber, PURCHASABLE };
