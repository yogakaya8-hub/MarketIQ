const { PurchaseEvent, Settings } = require('../models');
const { EVENT_TYPES, ROLES } = require('../config/constants');

const actorFilter = (user, sessionId) => (user ? { user: user._id } : { user: null, sessionId });

// Product views are the only event the browser reports; the rest are recorded by the server
// at the moment the real action happens, so they cannot be spoofed or double-counted.
async function recordView({ user, sessionId, product }) {
  if (!user && !sessionId) return { recorded: false, reason: 'no visitor identity' };
  // Vendors viewing their own product and admins are not shoppers.
  if (user && (user.role === ROLES.ADMIN || String(product.vendor) === String(user._id))) {
    return { recorded: false, reason: 'non-shopper view' };
  }
  const { dropoff } = await Settings.get();
  const since = new Date(Date.now() - dropoff.viewDedupMinutes * 60 * 1000);
  const recent = await PurchaseEvent.exists({
    ...actorFilter(user, sessionId),
    product: product._id,
    eventType: EVENT_TYPES.VIEWED,
    timestamp: { $gte: since },
  });
  if (recent) return { recorded: false, reason: 'duplicate view inside de-duplication window' };
  await PurchaseEvent.create({
    user: user?._id,
    sessionId: user ? undefined : sessionId,
    product: product._id,
    vendor: product.vendor,
    eventType: EVENT_TYPES.VIEWED,
  });
  return { recorded: true };
}

async function recordCartEvent(user, product, eventType, { quantity, fromQuantity, toQuantity, reason } = {}) {
  await PurchaseEvent.create({
    user: user._id,
    product: product._id,
    vendor: product.vendor,
    eventType,
    quantity,
    metadata: { fromQuantity, toQuantity, reason },
  });
}

async function recordCheckoutInitiated(user, products) {
  const { dropoff } = await Settings.get();
  const since = new Date(Date.now() - dropoff.viewDedupMinutes * 60 * 1000);
  const docs = [];
  for (const { product, quantity } of products) {
    const recent = await PurchaseEvent.exists({
      user: user._id,
      product: product._id,
      eventType: EVENT_TYPES.CHECKOUT,
      timestamp: { $gte: since },
    });
    if (!recent) docs.push({ user: user._id, product: product._id, vendor: product.vendor, eventType: EVENT_TYPES.CHECKOUT, quantity });
  }
  if (docs.length) await PurchaseEvent.insertMany(docs);
  return docs.length;
}

async function recordPurchases(order, source = 'cart') {
  const docs = order.items
    .filter((i) => i.product)
    .map((i) => ({
      user: order.customer,
      product: i.product,
      vendor: order.vendor,
      eventType: EVENT_TYPES.PURCHASED,
      quantity: i.quantity,
      order: order._id,
      metadata: { source },
      timestamp: order.createdAt,
    }));
  if (docs.length) await PurchaseEvent.insertMany(docs);
}

module.exports = { recordView, recordCartEvent, recordCheckoutInitiated, recordPurchases };
