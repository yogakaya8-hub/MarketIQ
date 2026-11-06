const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect, optionalAuth, authorize, requireApprovedVendor } = require('../middleware/auth');
const validate = require('../middleware/validate');
const s = require('../validators/schemas');
const env = require('../config/env');

const auth = require('../controllers/authController');
const products = require('../controllers/productController');
const stores = require('../controllers/storeController');
const cart = require('../controllers/cartController');
const orders = require('../controllers/orderController');
const requirements = require('../controllers/requirementController');
const offers = require('../controllers/offerController');
const inventory = require('../controllers/inventoryController');
const deals = require('../controllers/rescueDealController');
const analytics = require('../controllers/analyticsController');
const notifications = require('../controllers/notificationController');
const reports = require('../controllers/reportController');
const vendor = require('../controllers/vendorController');
const admin = require('../controllers/adminController');

const router = express.Router();
const id = validate({ params: s.idParam });
const customer = [protect, authorize('customer')];
const vendorOnly = [protect, authorize('vendor')];
const approvedVendor = [protect, authorize('vendor'), requireApprovedVendor];
const adminOnly = [protect, authorize('admin')];

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: env.nodeEnv === 'test' ? 1000 : 30, standardHeaders: true, legacyHeaders: false });

router.get('/health', (req, res) => res.json({ success: true, status: 'ok', time: new Date() }));

// Auth
router.post('/auth/register', authLimiter, validate({ body: s.register }), auth.register);
router.post('/auth/login', authLimiter, validate({ body: s.login }), auth.login);
router.get('/auth/me', protect, auth.me);
router.put('/auth/me', protect, validate({ body: s.updateProfile }), auth.updateMe);
router.put('/auth/password', protect, validate({ body: s.changePassword }), auth.changePassword);

// Products (public browsing + vendor catalogue)
router.get('/products', validate({ query: s.productQuery }), products.list);
router.get('/products/categories', products.categories);
router.get('/products/:id', id, optionalAuth, products.getOne);
router.post('/products/:id/events', id, optionalAuth, validate({ body: s.trackEvent }), products.trackEvent);
router.post('/products', ...approvedVendor, validate({ body: s.product }), products.create);
router.put('/products/:id', id, ...vendorOnly, validate({ body: s.product.partial() }), products.update);
router.delete('/products/:id', id, ...vendorOnly, products.remove);

router.get('/stores', stores.list);
router.get('/stores/:id', id, stores.getOne);

// Cart
router.get('/cart', ...customer, cart.get);
router.post('/cart/items', ...customer, validate({ body: s.addToCart }), cart.addItem);
router.patch('/cart/items/:productId', ...customer, validate({ params: s.productIdParam, body: s.updateCartItem }), cart.updateItem);
router.delete('/cart/items/:productId', ...customer, validate({ params: s.productIdParam, body: s.removeCartItem }), cart.removeItem);
router.post('/cart/checkout-intent', ...customer, cart.checkoutIntent);

// Orders
router.post('/orders', ...customer, validate({ body: s.placeOrder }), orders.place);
router.get('/orders/my', ...customer, orders.mine);
router.get('/orders/vendor', ...vendorOnly, orders.vendorOrders);
router.get('/orders', ...adminOnly, orders.all);
router.get('/orders/:id', id, protect, orders.getOne);
router.patch('/orders/:id/status', id, protect, authorize('vendor', 'admin'), validate({ body: s.orderStatus }), orders.updateStatus);
router.post('/orders/:id/cancel', id, protect, validate({ body: s.cancelOrder }), orders.cancel);

// Feature A: Reverse Marketplace
router.post('/requirements', ...customer, validate({ body: s.requirement }), requirements.create);
router.get('/requirements', protect, requirements.list);
router.get('/requirements/:id', id, protect, requirements.getOne);
router.patch('/requirements/:id/cancel', id, ...customer, requirements.cancel);
router.post('/offers', ...approvedVendor, validate({ body: s.offer }), offers.submit);
router.get('/offers/mine', ...vendorOnly, offers.mine);
router.get('/offers', ...adminOnly, offers.all);
router.put('/offers/:id', id, protect, authorize('customer', 'vendor'), validate({ body: s.offerAction }), offers.act);

// Feature B: Dead Stock Rescue
router.get('/inventory/dead-stock', protect, authorize('vendor', 'admin'), inventory.deadStock);
router.get('/rescue-deals', deals.publicList);
router.get('/rescue-deals/mine', ...vendorOnly, deals.mine);
router.post('/rescue-deals', ...approvedVendor, validate({ body: s.rescueDeal }), deals.create);
router.patch('/rescue-deals/:id/cancel', id, protect, authorize('vendor', 'admin'), deals.cancel);

// Feature C: Failed Purchase Learning + sales analytics
router.get('/analytics/purchase-dropoff', protect, authorize('vendor', 'admin'), analytics.purchaseDropoff);
router.get('/analytics/vendor-summary', ...vendorOnly, analytics.vendorSummary);
router.get('/analytics/platform', ...adminOnly, analytics.platform);

// Vendor store profile
router.get('/vendor/profile', ...vendorOnly, vendor.getProfile);
router.put('/vendor/profile', ...vendorOnly, validate({ body: s.vendorProfile }), vendor.updateProfile);
router.get('/vendor/products', ...vendorOnly, products.vendorList);

// Notifications and issue reports (all signed-in users)
router.get('/notifications', protect, notifications.list);
router.get('/notifications/unread-count', protect, notifications.unreadCount);
router.patch('/notifications/read-all', protect, notifications.markAllRead);
router.patch('/notifications/:id/read', id, protect, notifications.markRead);
router.post('/reports', protect, authorize('customer', 'vendor'), validate({ body: s.report }), reports.create);
router.get('/reports/mine', protect, reports.mine);

// Admin
router.get('/admin/users', ...adminOnly, admin.users);
router.patch('/admin/users/:id/status', id, ...adminOnly, validate({ body: s.userStatus }), admin.setUserStatus);
router.get('/admin/vendors', ...adminOnly, admin.vendors);
router.patch('/admin/vendors/:id/status', id, ...adminOnly, validate({ body: s.vendorStatus }), admin.setVendorStatus);
router.get('/admin/products', ...adminOnly, admin.products);
router.patch('/admin/products/:id/moderation', id, ...adminOnly, validate({ body: s.productModeration }), admin.moderateProduct);
router.get('/admin/requirements', ...adminOnly, admin.requirements);
router.get('/admin/reports', ...adminOnly, reports.all);
router.patch('/admin/reports/:id', id, ...adminOnly, validate({ body: s.reportUpdate }), reports.update);
router.get('/admin/activity', ...adminOnly, admin.activity);
router.get('/admin/settings', ...adminOnly, admin.getSettings);
router.put('/admin/settings', ...adminOnly, validate({ body: s.settings }), admin.updateSettings);

module.exports = router;
