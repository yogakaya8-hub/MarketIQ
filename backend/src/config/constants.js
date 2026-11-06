const ROLES = Object.freeze({ CUSTOMER: 'customer', VENDOR: 'vendor', ADMIN: 'admin' });

const CATEGORIES = Object.freeze([
  'Electronics',
  'Fashion',
  'Home & Kitchen',
  'Books',
  'Sports & Fitness',
  'Beauty & Personal Care',
  'Groceries',
  'Toys & Games',
  'Office Supplies',
  'Health',
]);

const VENDOR_STATUS = Object.freeze(['pending', 'approved', 'rejected', 'suspended']);
const ORDER_STATUS = Object.freeze(['placed', 'confirmed', 'shipped', 'delivered', 'cancelled']);
// Allowed fulfilment transitions. Vendors drive the forward flow; customers may cancel before shipping.
const ORDER_TRANSITIONS = Object.freeze({
  placed: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
});

const REQUIREMENT_STATUS = Object.freeze(['open', 'awarded', 'expired', 'cancelled']);
const OFFER_STATUS = Object.freeze(['pending', 'accepted', 'rejected', 'withdrawn']);

const EVENT_TYPES = Object.freeze({
  VIEWED: 'product_viewed',
  ADDED: 'added_to_cart',
  QTY_CHANGED: 'cart_quantity_changed',
  REMOVED: 'cart_item_removed',
  CHECKOUT: 'checkout_initiated',
  PURCHASED: 'purchase_completed',
});

const RISK = Object.freeze({
  HEALTHY: 'healthy',
  SLOW: 'slow_moving',
  AT_RISK: 'at_risk',
  DEAD: 'dead_stock',
  INSUFFICIENT: 'insufficient_data',
});

const RISK_LABELS = Object.freeze({
  healthy: 'Healthy',
  slow_moving: 'Slow-moving',
  at_risk: 'At-risk',
  dead_stock: 'Potential dead stock',
  insufficient_data: 'Insufficient data',
});

const REMOVAL_REASONS = Object.freeze([
  'Found a better price elsewhere',
  'Delivery takes too long',
  'Changed my mind',
  'Need more product information',
  'Only saving for later',
  'Other',
]);

module.exports = {
  ROLES,
  CATEGORIES,
  VENDOR_STATUS,
  ORDER_STATUS,
  ORDER_TRANSITIONS,
  REQUIREMENT_STATUS,
  OFFER_STATUS,
  EVENT_TYPES,
  RISK,
  RISK_LABELS,
  REMOVAL_REASONS,
};
