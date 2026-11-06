const { z } = require('zod');
const { CATEGORIES, ORDER_STATUS, VENDOR_STATUS, REMOVAL_REASONS } = require('../config/constants');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const trimmed = (min, max) => z.string().trim().min(min).max(max);
const money = z.coerce.number().positive('Must be greater than zero').max(10_000_000);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Use YYYY-MM-DD');

const address = z.object({
  line1: trimmed(3, 200),
  city: trimmed(2, 80),
  state: z.string().trim().max(80).optional().default(''),
  postalCode: z.string().trim().regex(/^[A-Za-z0-9 -]{3,12}$/, 'Invalid postal code'),
});

const password = z.string().min(8, 'Password must be at least 8 characters').max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter').regex(/\d/, 'Password must contain a number');

const schemas = {
  idParam: z.object({ id: objectId }),
  productIdParam: z.object({ productId: objectId }),

  register: z.object({
    name: trimmed(2, 80),
    email: z.string().trim().toLowerCase().email(),
    password,
    role: z.enum(['customer', 'vendor']).default('customer'),
    phone: z.string().trim().max(20).optional(),
    storeName: z.string().trim().min(2).max(80).optional(),
    storeDescription: z.string().trim().max(1000).optional(),
    categories: z.array(z.enum(CATEGORIES)).max(10).optional(),
    city: z.string().trim().max(80).optional(),
  }).refine((d) => d.role !== 'vendor' || d.storeName, { message: 'Store name is required for vendors', path: ['storeName'] }),
  login: z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) }),
  updateProfile: z.object({
    name: trimmed(2, 80).optional(),
    phone: z.string().trim().max(20).optional(),
    address: address.optional(),
  }),
  changePassword: z.object({ currentPassword: z.string().min(1), newPassword: password }),

  product: z.object({
    name: trimmed(2, 120),
    description: z.string().trim().max(3000).optional().default(''),
    category: z.enum(CATEGORIES),
    brand: z.string().trim().max(60).optional(),
    sku: z.string().trim().max(40).optional().transform((v) => v || undefined),
    price: money,
    stock: z.coerce.number().int().min(0).max(1_000_000),
    imageUrl: z.union([z.string().trim().url().max(500), z.literal('')]).optional(),
    isActive: z.boolean().optional(),
  }),
  productQuery: z.object({
    q: z.string().trim().max(100).optional(),
    category: z.enum(CATEGORIES).optional(),
    store: objectId.optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    inStock: z.enum(['true', 'false']).optional(),
    sort: z.enum(['newest', 'price_asc', 'price_desc', 'popular', 'name']).optional().default('newest'),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(60).optional(),
  }),
  trackEvent: z.object({
    eventType: z.literal('product_viewed', { errorMap: () => ({ message: 'Only product_viewed is reported by the browser; other events are recorded by the server' }) }),
    sessionId: z.string().trim().min(8).max(64).optional(),
  }),

  addToCart: z.object({ productId: objectId, quantity: z.coerce.number().int().min(1).max(99).default(1) }),
  updateCartItem: z.object({ quantity: z.coerce.number().int().min(1).max(99) }),
  removeCartItem: z.object({ reason: z.enum(REMOVAL_REASONS).optional() }),

  placeOrder: z.object({ shippingAddress: address, paymentMethod: z.enum(['cod', 'simulated_online']).default('cod') }),
  orderStatus: z.object({ status: z.enum(ORDER_STATUS), note: z.string().trim().max(300).optional() }),
  cancelOrder: z.object({ reason: z.string().trim().max(300).optional() }),

  requirement: z.object({
    title: trimmed(3, 120),
    description: trimmed(10, 2000),
    category: z.enum(CATEGORIES),
    quantity: z.coerce.number().int().min(1).max(100000),
    budget: money,
    requiredBy: isoDate,
  }),
  offer: z.object({
    requirementId: objectId,
    totalPrice: money,
    deliveryDays: z.coerce.number().int().min(1).max(365),
    details: z.string().trim().max(1500).optional().default(''),
    productId: objectId.optional(),
  }),
  offerAction: z.discriminatedUnion('action', [
    z.object({ action: z.literal('select'), shippingAddress: address, paymentMethod: z.enum(['cod', 'simulated_online']).default('cod') }),
    z.object({
      action: z.literal('update'),
      totalPrice: money.optional(),
      deliveryDays: z.coerce.number().int().min(1).max(365).optional(),
      details: z.string().trim().max(1500).optional(),
      productId: objectId.nullable().optional(),
    }),
    z.object({ action: z.literal('withdraw') }),
  ]),

  rescueDeal: z.object({
    productId: objectId,
    discountPercent: z.coerce.number().int().min(1).max(90),
    durationDays: z.coerce.number().int().min(1).max(90),
  }),

  vendorProfile: z.object({
    storeName: trimmed(2, 80).optional(),
    description: z.string().trim().max(1000).optional(),
    categories: z.array(z.enum(CATEGORIES)).max(10).optional(),
    city: z.string().trim().max(80).optional(),
    phone: z.string().trim().max(20).optional(),
  }),

  report: z.object({
    category: z.enum(['product', 'order', 'vendor', 'payment', 'technical', 'other']),
    subject: trimmed(3, 140),
    description: trimmed(10, 3000),
    relatedId: z.string().trim().max(64).optional(),
  }),
  reportUpdate: z.object({
    status: z.enum(['open', 'in_review', 'resolved', 'dismissed']),
    adminNote: z.string().trim().max(1000).optional(),
  }),

  userStatus: z.object({ isActive: z.boolean() }),
  vendorStatus: z.object({ status: z.enum(VENDOR_STATUS), note: z.string().trim().max(500).optional() }),
  productModeration: z.object({ isBlocked: z.boolean(), reason: z.string().trim().max(300).optional() }),
  settings: z.object({
    deadStock: z.object({
      minObservationDays: z.number().int().min(1).max(365),
      analysisWindowDays: z.number().int().min(7).max(730),
      slowMovingDays: z.number().int().min(1).max(730),
      atRiskDays: z.number().int().min(1).max(730),
      deadStockDays: z.number().int().min(1).max(1095),
      slowCoverDays: z.number().int().min(1).max(3650),
      atRiskCoverDays: z.number().int().min(1).max(3650),
    }).partial().optional(),
    dropoff: z.object({
      abandonmentGraceHours: z.number().int().min(1).max(720),
      viewDedupMinutes: z.number().int().min(1).max(1440),
      minViewsForInsight: z.number().int().min(1),
      lowViewConversionPct: z.number().min(0).max(100),
      minCartAddsForInsight: z.number().int().min(1),
      lowCartConversionPct: z.number().min(0).max(100),
      minCheckoutsForInsight: z.number().int().min(1),
      lowCheckoutConversionPct: z.number().min(0).max(100),
    }).partial().optional(),
    rescue: z.object({
      minDiscountPercent: z.number().int().min(1).max(90),
      maxDiscountPercent: z.number().int().min(1).max(90),
      maxDurationDays: z.number().int().min(1).max(90),
    }).partial().optional(),
  }),
};

module.exports = schemas;
