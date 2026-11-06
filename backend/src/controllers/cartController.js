const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { Cart, Product, Vendor } = require('../models');
const { EVENT_TYPES } = require('../config/constants');
const { round2 } = require('../utils/money');
const { activeDealsFor, withPricing } = require('../services/pricingService');
const { recordCartEvent, recordCheckoutInitiated } = require('../services/trackingService');

async function loadCart(userId) {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
}

async function presentCart(cart) {
  await cart.populate({ path: 'items.product', populate: { path: 'store', select: 'storeName status' } });
  const products = cart.items.filter((i) => i.product).map((i) => i.product);
  const deals = await activeDealsFor(products.map((p) => p._id));
  let subtotal = 0;
  let savings = 0;
  const items = cart.items.map((i) => {
    if (!i.product) return { product: null, quantity: i.quantity, problem: 'This product no longer exists' };
    const p = withPricing(i.product, deals.get(String(i.product._id)));
    let problem = null;
    if (!p.isActive || p.isBlocked || p.isArchived || p.store?.status !== 'approved') problem = 'No longer available';
    else if (p.stock < i.quantity) problem = p.stock === 0 ? 'Out of stock' : `Only ${p.stock} left`;
    const lineTotal = round2(p.effectivePrice * i.quantity);
    if (!problem) {
      subtotal += lineTotal;
      savings += round2((p.price - p.effectivePrice) * i.quantity);
    }
    return { product: p, quantity: i.quantity, lineTotal, problem };
  });
  return {
    _id: cart._id,
    items,
    itemCount: items.reduce((s, i) => s + i.quantity, 0),
    subtotal: round2(subtotal),
    savings: round2(savings),
    hasProblems: items.some((i) => i.problem),
  };
}

async function purchasableProduct(productId) {
  const product = await Product.findOne({ _id: productId, isActive: true, isBlocked: false, isArchived: { $ne: true } });
  if (!product) throw ApiError.notFound('Product not available');
  const store = await Vendor.findById(product.store).select('status').lean();
  if (store?.status !== 'approved') throw ApiError.badRequest('This vendor is not currently selling');
  return product;
}

exports.get = asyncHandler(async (req, res) => {
  res.json({ success: true, cart: await presentCart(await loadCart(req.user._id)) });
});

exports.addItem = asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;
  const product = await purchasableProduct(productId);
  const cart = await loadCart(req.user._id);
  const existing = cart.items.find((i) => String(i.product) === String(productId));
  const newQty = (existing?.quantity || 0) + quantity;
  if (newQty > 99) throw ApiError.badRequest('Maximum 99 units per product');
  if (product.stock < newQty) throw ApiError.badRequest(product.stock === 0 ? 'This product is out of stock' : `Only ${product.stock} in stock`);
  if (existing) existing.quantity = newQty;
  else cart.items.push({ product: product._id, quantity });
  await cart.save();
  await recordCartEvent(req.user, product, EVENT_TYPES.ADDED, { quantity, fromQuantity: existing ? newQty - quantity : 0, toQuantity: newQty });
  res.status(201).json({ success: true, cart: await presentCart(cart) });
});

exports.updateItem = asyncHandler(async (req, res) => {
  const cart = await loadCart(req.user._id);
  const item = cart.items.find((i) => String(i.product) === req.params.productId);
  if (!item) throw ApiError.notFound('Item is not in your cart');
  const product = await Product.findById(req.params.productId);
  if (!product) throw ApiError.notFound('Product not found');
  const { quantity } = req.body;
  if (quantity > product.stock) throw ApiError.badRequest(`Only ${product.stock} in stock`);
  const from = item.quantity;
  if (from !== quantity) {
    item.quantity = quantity;
    await cart.save();
    await recordCartEvent(req.user, product, EVENT_TYPES.QTY_CHANGED, { quantity, fromQuantity: from, toQuantity: quantity });
  }
  res.json({ success: true, cart: await presentCart(cart) });
});

exports.removeItem = asyncHandler(async (req, res) => {
  const cart = await loadCart(req.user._id);
  const idx = cart.items.findIndex((i) => String(i.product) === req.params.productId);
  if (idx === -1) throw ApiError.notFound('Item is not in your cart');
  const [removed] = cart.items.splice(idx, 1);
  await cart.save();
  const product = await Product.findById(req.params.productId).select('vendor').lean();
  if (product) {
    await recordCartEvent(req.user, product, EVENT_TYPES.REMOVED, { quantity: removed.quantity, fromQuantity: removed.quantity, toQuantity: 0, reason: req.body?.reason });
  }
  res.json({ success: true, cart: await presentCart(cart) });
});

exports.checkoutIntent = asyncHandler(async (req, res) => {
  const cart = await loadCart(req.user._id);
  if (!cart.items.length) throw ApiError.badRequest('Your cart is empty');
  const presented = await presentCart(cart);
  const valid = presented.items.filter((i) => i.product && !i.problem).map((i) => ({ product: i.product, quantity: i.quantity }));
  const recorded = await recordCheckoutInitiated(req.user, valid);
  res.json({ success: true, cart: presented, recorded });
});
