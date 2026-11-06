/* eslint-disable no-console */
/**
 * Seeds the database with a realistic, internally consistent marketplace history:
 *  - users (admin, vendors incl. one pending, customers incl. one suspended)
 *  - ~45 products with different sales "profiles" over the last 6 months
 *  - orders generated from those profiles (sales counters are derived from the orders)
 *  - a purchase-event funnel for every order plus non-converting browsing, cart and checkout traffic
 *  - carts that match the last recorded cart actions
 *  - requirements and offers in every state, rescue deals (active and expired), reports
 * It then runs the real dead-stock analysis and sales summaries so insights and alerts exist.
 *
 * Usage: npm run seed            (drops and recreates the database in MONGODB_URI)
 */
const crypto = require('crypto');
const mongoose = require('mongoose');
const env = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const M = require('../models');
const { EVENT_TYPES, REMOVAL_REASONS } = require('../config/constants');
const { analyzeInventory } = require('../services/deadStockService');
const { vendorSummary } = require('../services/salesAnalyticsService');
const { round2 } = require('../utils/money');

const DAY = 86400000;
const HOUR = 3600000;
const NOW = Date.now();
const ago = (days) => new Date(NOW - days * DAY);
const ahead = (days) => new Date(NOW + days * DAY);

// Deterministic PRNG so every seed run produces the same data.
let state = 20261023;
const rand = () => {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = (a, b) => a + rand() * (b - a);
const int = (a, b) => Math.floor(between(a, b + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;
const orderNo = (d) => `ORD-${d.toISOString().slice(2, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

// ---------------------------------------------------------------- reference data
const VENDORS = [
  { key: 'tech', name: 'Ramesh Kumar', email: 'technest@marketplace.test', storeName: 'TechNest Electronics', city: 'Chennai', categories: ['Electronics', 'Office Supplies'], description: 'Gadgets, accessories and office electronics with fast dispatch from Chennai.' },
  { key: 'fashion', name: 'Meera Pillai', email: 'urbanthread@marketplace.test', storeName: 'UrbanThread Fashion', city: 'Bengaluru', categories: ['Fashion', 'Beauty & Personal Care'], description: 'Everyday and ethnic wear, plus natural personal care.' },
  { key: 'home', name: 'Suresh Babu', email: 'homecraft@marketplace.test', storeName: 'HomeCraft Living', city: 'Coimbatore', categories: ['Home & Kitchen', 'Groceries'], description: 'Kitchenware, home textiles and cold-pressed pantry staples.' },
  { key: 'sports', name: 'Anil Verma', email: 'fitzone@marketplace.test', storeName: 'FitZone Sports', city: 'Hyderabad', categories: ['Sports & Fitness', 'Health'], description: 'Fitness gear, sports equipment and health monitors.' },
  { key: 'books', name: 'Lakshmi Narayan', email: 'pageturner@marketplace.test', storeName: 'PageTurner Books', city: 'Madurai', categories: ['Books', 'Toys & Games', 'Office Supplies'], description: 'Books for all ages, puzzles, games and stationery.' },
];
const PENDING_VENDOR = { name: 'Divya Krishnan', email: 'greenleaf@marketplace.test', storeName: 'GreenLeaf Organics', city: 'Kochi', categories: ['Groceries', 'Health'], description: 'Certified organic produce and wellness foods.' };

const CUSTOMERS = [
  ['Priya Sharma', 'priya@marketplace.test', 'Chennai', 'Tamil Nadu', '600020', '12 Gandhi Nagar, Adyar'],
  ['Arjun Mehta', 'arjun@marketplace.test', 'Mumbai', 'Maharashtra', '400050', '7 Hill Road, Bandra West'],
  ['Kavya Iyer', 'kavya@marketplace.test', 'Bengaluru', 'Karnataka', '560034', '45 Koramangala 5th Block'],
  ['Rahul Nair', 'rahul@marketplace.test', 'Kochi', 'Kerala', '682024', '3 Marine Drive'],
  ['Sneha Reddy', 'sneha@marketplace.test', 'Hyderabad', 'Telangana', '500081', '22 Madhapur Main Road'],
  ['Vikram Singh', 'vikram@marketplace.test', 'New Delhi', 'Delhi', '110017', '9 Saket Block C'],
  ['Ananya Das', 'ananya@marketplace.test', 'Kolkata', 'West Bengal', '700019', '18 Ballygunge Place'],
  ['Karthik Raman', 'karthik@marketplace.test', 'Coimbatore', 'Tamil Nadu', '641004', '5 Race Course Road'],
];

/**
 * Sales profiles. Each controls listing age, how sales are spread over time, stock on hand
 * and how much non-converting traffic the product gets.
 */
const PROFILES = {
  hot: { listed: [170, 180], sales: [38, 55], window: [0, 170], lastWithin: 2, stock: [15, 35], views: 4, addRate: 0.05 },
  steady: { listed: [150, 175], sales: [18, 26], window: [0, 150], lastWithin: 8, stock: [5, 12], views: 2, addRate: 0.05 },
  slow: { listed: [150, 165], sales: [10, 14], window: [36, 140], stock: [7, 11], views: 0.6, addRate: 0.04 },
  atRisk: { listed: [160, 175], sales: [5, 8], window: [66, 160], stock: [14, 28], views: 0.4, addRate: 0.03 },
  dead: { listed: [140, 170], sales: [0, 3], window: [105, 140], stock: [20, 45], views: 0.3, addRate: 0.02 },
  fresh: { listed: [5, 12], sales: [0, 2], window: [0, 4], stock: [25, 40], views: 2, addRate: 0.06 },
  slowCover: { listed: [170, 178], sales: [26, 32], window: [0, 170], lastWithin: 4, stock: [40, 48], views: 1, addRate: 0.04 },
  overstock: { listed: [170, 178], sales: [12, 16], window: [0, 170], lastWithin: 5, stock: [340, 400], views: 0.5, addRate: 0.03 },
  lookers: { listed: [120, 150], sales: [12, 16], window: [0, 120], lastWithin: 6, stock: [8, 12], views: 7, addRate: 0.03 },
  carters: { listed: [120, 150], sales: [12, 16], window: [0, 120], lastWithin: 7, stock: [8, 12], views: 3, addRate: 0.32, removeRate: 0.55, reasons: ['Delivery takes too long', 'Found a better price elsewhere'] },
  checkoutDrop: { listed: [120, 150], sales: [12, 16], window: [0, 120], lastWithin: 5, stock: [8, 12], views: 3, addRate: 0.22, checkoutRate: 0.8, removeRate: 0.2 },
};

// [vendorKey, name, category, brand, price, profile, description]
const PRODUCTS = [
  ['tech', 'Wireless Bluetooth Earbuds Pro', 'Electronics', 'SonicWave', 1799, 'hot', 'True wireless earbuds with 30-hour battery life, touch controls and IPX5 sweat resistance.'],
  ['tech', 'USB-C 65W Fast Charger', 'Electronics', 'VoltEdge', 1299, 'steady', 'GaN charger with USB-C PD 65W and USB-A QC 3.0 ports. Charges laptops and phones.'],
  ['tech', 'Smart LED Desk Lamp', 'Electronics', 'Lumina', 2499, 'lookers', 'Touch dimmable lamp with 5 colour modes, USB charging port and auto-off timer.'],
  ['tech', 'Mechanical Keyboard (Blue Switch)', 'Electronics', 'KeyForge', 3999, 'carters', 'Full-size mechanical keyboard with tactile blue switches and white backlight.'],
  ['tech', '1080p HD Webcam', 'Electronics', 'ClearView', 2199, 'atRisk', 'Full HD webcam with dual microphones and privacy shutter, plug and play.'],
  ['tech', 'Portable SSD 512GB', 'Electronics', 'DataVault', 5499, 'steady', 'USB 3.2 portable SSD with read speeds up to 1050 MB/s, shock resistant.'],
  ['tech', 'VGA to HDMI Adapter', 'Electronics', 'LinkPort', 649, 'dead', 'Converts VGA output with audio to HDMI for older laptops and projectors.'],
  ['tech', 'Smartwatch Fitness Band X2', 'Electronics', 'PulseFit', 2999, 'fresh', 'AMOLED fitness band with heart-rate, SpO2 and sleep tracking.'],
  ['tech', 'Laser Printer Toner Cartridge', 'Office Supplies', 'PrintPro', 1899, 'overstock', 'Compatible black toner cartridge, approx. 1600 pages yield.'],
  ['fashion', "Men's Slim Fit Cotton Shirt", 'Fashion', 'UrbanThread', 899, 'hot', '100% cotton slim fit shirt, breathable and easy to iron. Sizes S to XXL.'],
  ['fashion', "Women's Printed Kurta Set", 'Fashion', 'UrbanThread', 1499, 'steady', 'Rayon kurta with palazzo pants and block print design.'],
  ['fashion', 'Unisex Denim Jacket', 'Fashion', 'BlueRidge', 2299, 'lookers', 'Classic stonewash denim jacket with button front and chest pockets.'],
  ['fashion', 'Leather Formal Belt', 'Fashion', 'Hidecraft', 599, 'slow', 'Genuine leather belt with brushed metal buckle, 35mm width.'],
  ['fashion', 'Woollen Winter Muffler', 'Fashion', 'Himalayan Weaves', 749, 'dead', 'Soft woollen muffler, 180cm long, ideal for winter travel.'],
  ['fashion', 'Canvas Sneakers', 'Fashion', 'StreetStep', 1299, 'checkoutDrop', 'Lightweight canvas sneakers with cushioned insole.'],
  ['fashion', 'Herbal Face Wash 150ml', 'Beauty & Personal Care', 'NeemLeaf', 249, 'hot', 'Soap-free face wash with neem and tulsi extracts for daily use.'],
  ['fashion', 'Silk Saree, Kanchipuram Style', 'Fashion', 'Kanchi Looms', 6999, 'atRisk', 'Art silk saree with zari border and matching blouse piece.'],
  ['home', 'Stainless Steel Pressure Cooker 5L', 'Home & Kitchen', 'SteelChef', 2199, 'steady', 'Induction-compatible 5-litre cooker with safety valve and gasket release.'],
  ['home', 'Non-stick Tawa 28cm', 'Home & Kitchen', 'SteelChef', 799, 'hot', 'Three-layer non-stick tawa for dosa and roti, induction base.'],
  ['home', 'Ceramic Dinner Set (24 pcs)', 'Home & Kitchen', 'Terracotta Home', 3499, 'slow', 'Microwave-safe ceramic dinner set for six with plates, bowls and mugs.'],
  ['home', 'Cold-Pressed Groundnut Oil 1L', 'Groceries', 'Chekku Fresh', 329, 'hot', 'Traditional wood-pressed groundnut oil, unrefined.'],
  ['home', 'Handwoven Cotton Bedsheet (Double)', 'Home & Kitchen', 'Erode Weaves', 1199, 'carters', 'Handloom cotton bedsheet with two pillow covers, 90 x 100 inches.'],
  ['home', 'Glass Storage Jars Set of 6', 'Home & Kitchen', 'ClearStore', 999, 'dead', 'Airtight borosilicate glass jars with bamboo lids, 750ml each.'],
  ['home', 'Electric Kettle 1.5L', 'Home & Kitchen', 'BrewMate', 1149, 'slowCover', 'Stainless steel kettle with auto shut-off and boil-dry protection.'],
  ['home', 'Bamboo Chopping Board', 'Home & Kitchen', 'GreenCut', 449, 'fresh', 'Large bamboo chopping board with juice groove.'],
  ['sports', 'Yoga Mat 6mm Anti-slip', 'Sports & Fitness', 'FlexFit', 799, 'hot', 'TPE yoga mat with alignment lines and carry strap, 183 x 61cm.'],
  ['sports', 'Adjustable Dumbbell Set 20kg', 'Sports & Fitness', 'IronCore', 3999, 'steady', 'Pair of adjustable dumbbells with chrome handles and spin-lock collars.'],
  ['sports', 'Cricket Bat, Kashmir Willow', 'Sports & Fitness', 'Boundary', 2499, 'lookers', 'Full-size Kashmir willow bat with cane handle, ready to play.'],
  ['sports', 'Resistance Bands Set', 'Sports & Fitness', 'FlexFit', 599, 'steady', 'Five latex bands with handles, door anchor and ankle straps.'],
  ['sports', 'Badminton Racket Pair', 'Sports & Fitness', 'ShuttleX', 1499, 'atRisk', 'Aluminium rackets with full cover and 3 feather shuttles.'],
  ['sports', 'Whey Protein 1kg (Chocolate)', 'Health', 'MuscleFuel', 2299, 'slow', '24g protein per serving, lab tested, no added sugar.'],
  ['sports', 'Digital BP Monitor', 'Health', 'CareSense', 1899, 'dead', 'Automatic upper-arm blood pressure monitor with memory for two users.'],
  ['sports', 'Insulated Sports Bottle 1L', 'Sports & Fitness', 'HydroPeak', 549, 'steady', 'Double-wall vacuum insulated steel bottle, keeps cold for 24 hours.'],
  ['books', 'The Art of Clean Code (Paperback)', 'Books', 'Coders Press', 599, 'hot', 'Practical guide to writing readable, maintainable software.'],
  ['books', 'Data Structures Made Simple', 'Books', 'Coders Press', 749, 'steady', 'Illustrated introduction to arrays, trees, graphs and algorithms.'],
  ['books', "Children's Moral Stories Collection", 'Books', 'Little Owl', 399, 'steady', 'Fifty illustrated short stories for children aged 5 to 10.'],
  ['books', 'Wooden Jigsaw Puzzle 500 pcs', 'Toys & Games', 'PuzzleCraft', 699, 'slow', 'Laser-cut wooden puzzle of Indian landmarks, 500 pieces.'],
  ['books', 'Encyclopedia Set (Hardcover, 10 vols)', 'Books', 'Knowledge House', 8999, 'dead', 'Ten-volume illustrated general knowledge encyclopedia.'],
  ['books', 'A5 Spiral Notebooks Pack of 6', 'Office Supplies', 'NoteWell', 299, 'hot', 'Ruled 160-page notebooks with 70 GSM paper.'],
  ['books', 'Exam Prep Guide, Previous Edition', 'Books', 'ExamAce', 499, 'dead', 'Competitive exam guide with solved papers (previous syllabus).'],
  ['books', 'Strategy Board Game: Spice Route', 'Toys & Games', 'TableTop India', 1299, 'fresh', 'Trading strategy game for 2 to 5 players, ages 10 and up.'],
];

// ---------------------------------------------------------------- helpers
async function createUser(data) {
  return M.User.create(data); // create() runs the password hashing hook
}

function saleTimes(profile, listedDaysAgo) {
  const p = PROFILES[profile];
  const n = int(p.sales[0], p.sales[1]);
  const maxAgo = Math.min(p.window[1], listedDaysAgo - 1);
  const minAgo = p.window[0];
  const times = [];
  for (let i = 0; i < n; i += 1) times.push(between(minAgo, maxAgo));
  if (p.lastWithin != null && n > 0) times[0] = between(0.05, p.lastWithin); // guarantee a recent sale
  return times.map((d) => new Date(NOW - d * DAY)).sort((a, b) => a - b);
}

function statusFor(date) {
  const age = (NOW - date) / DAY;
  if (age > 12) return chance(0.05) ? 'cancelled' : 'delivered';
  if (age > 6) return chance(0.04) ? 'cancelled' : pick(['shipped', 'delivered', 'delivered']);
  if (age > 2) return pick(['confirmed', 'shipped', 'shipped']);
  return pick(['placed', 'placed', 'confirmed']);
}

function historyFor(status, createdAt, customerId, vendorId) {
  const flow = ['placed', 'confirmed', 'shipped', 'delivered'];
  const h = [{ status: 'placed', at: createdAt, by: customerId }];
  if (status === 'cancelled') {
    h.push({ status: 'cancelled', at: new Date(createdAt.getTime() + 5 * HOUR), by: customerId, note: 'Ordered by mistake' });
    return h;
  }
  const upto = flow.indexOf(status);
  for (let i = 1; i <= upto; i += 1) h.push({ status: flow[i], at: new Date(createdAt.getTime() + i * 22 * HOUR), by: vendorId });
  return h;
}

// ---------------------------------------------------------------- main
async function seed() {
  await connectDB();
  console.log(`Seeding ${env.mongoUri}`);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(M).map((model) => model.syncIndexes()));

  // Users -------------------------------------------------------------
  const admin = await createUser({ name: 'Platform Admin', email: 'admin@marketplace.test', password: 'Admin@123', role: 'admin', phone: '9000000001' });

  const vendorUsers = {};
  const stores = {};
  for (const v of VENDORS) {
    const u = await createUser({ name: v.name, email: v.email, password: 'Vendor@123', role: 'vendor', phone: `98${int(10000000, 99999999)}` });
    u.createdAt = ago(185);
    await u.save();
    vendorUsers[v.key] = u;
    stores[v.key] = await M.Vendor.create({ user: u._id, storeName: v.storeName, description: v.description, categories: v.categories, city: v.city, status: 'approved', approvedAt: ago(183) });
  }
  const pendingUser = await createUser({ name: PENDING_VENDOR.name, email: PENDING_VENDOR.email, password: 'Vendor@123', role: 'vendor' });
  const pendingStore = await M.Vendor.create({ user: pendingUser._id, ...PENDING_VENDOR, email: undefined, name: undefined, status: 'pending' });

  const customers = [];
  for (const [name, email, city, st, pin, line1] of CUSTOMERS) {
    customers.push(await createUser({ name, email, password: 'Customer@123', role: 'customer', phone: `97${int(10000000, 99999999)}`, address: { line1, city, state: st, postalCode: pin } }));
  }
  await createUser({ name: 'Rohan Gupta', email: 'rohan@marketplace.test', password: 'Customer@123', role: 'customer', isActive: false });
  const addr = (c) => ({ line1: c.address.line1, city: c.address.city, state: c.address.state, postalCode: c.address.postalCode });

  // Products ----------------------------------------------------------
  const products = [];
  for (const [vk, name, category, brand, price, profile, description] of PRODUCTS) {
    const prof = PROFILES[profile];
    const listedDaysAgo = int(prof.listed[0], prof.listed[1]);
    const doc = await M.Product.create({
      vendor: vendorUsers[vk]._id,
      store: stores[vk]._id,
      name, category, brand, price, description,
      sku: `${vk.slice(0, 3).toUpperCase()}-${String(products.length + 1).padStart(3, '0')}`,
      stock: int(prof.stock[0], prof.stock[1]),
      listedAt: ago(listedDaysAgo),
    });
    products.push({ doc, profile, vk, listedDaysAgo });
  }
  // Products of the pending vendor stay hidden until an admin approves the store.
  await M.Product.create([
    { vendor: pendingUser._id, store: pendingStore._id, name: 'Organic Jaggery Powder 500g', category: 'Groceries', brand: 'GreenLeaf', price: 180, stock: 60, listedAt: ago(3) },
    { vendor: pendingUser._id, store: pendingStore._id, name: 'Moringa Leaf Powder 200g', category: 'Health', brand: 'GreenLeaf', price: 260, stock: 40, listedAt: ago(3) },
  ]);
  const byName = (n) => products.find((p) => p.doc.name === n).doc;

  // Orders (cart purchases) ------------------------------------------
  const orderDocs = [];
  const expiredDealWindow = { product: byName('Wooden Jigsaw Puzzle 500 pcs'), from: ago(60), to: ago(46), pct: 20 };
  const expiredDealId = new mongoose.Types.ObjectId();
  for (const { doc, profile, listedDaysAgo } of products) {
    for (const t of saleTimes(profile, listedDaysAgo)) {
      const customer = pick(customers);
      const qty = profile === 'hot' || profile === 'slowCover' ? int(1, 2) : 1;
      let unitPrice = doc.price;
      let rescueDeal;
      if (doc._id.equals(expiredDealWindow.product._id) && t >= expiredDealWindow.from && t <= expiredDealWindow.to) {
        unitPrice = round2(doc.price * (1 - expiredDealWindow.pct / 100));
        rescueDeal = expiredDealId;
      }
      const status = statusFor(t);
      orderDocs.push({
        orderNumber: orderNo(t),
        checkoutGroup: crypto.randomUUID(),
        customer: customer._id,
        vendor: doc.vendor,
        store: doc.store,
        source: 'cart',
        items: [{ product: doc._id, name: doc.name, quantity: qty, unitPrice, originalUnitPrice: doc.price, rescueDeal, lineTotal: round2(unitPrice * qty) }],
        totalAmount: round2(unitPrice * qty),
        shippingAddress: addr(customer),
        paymentMethod: chance(0.6) ? 'cod' : 'simulated_online',
        status,
        statusHistory: historyFor(status, t, customer._id, doc.vendor),
        cancelReason: status === 'cancelled' ? 'Ordered by mistake' : undefined,
        createdAt: t,
        updatedAt: t,
      });
    }
  }

  // Requirements and offers (Reverse Marketplace) ----------------------
  const [priya, arjun, kavya, rahul, sneha, vikram, ananya, karthik] = customers;
  const reqDefs = [
    { c: priya, title: 'Insulated steel water bottles for office team', category: 'Sports & Fitness', quantity: 50, budget: 30000, requiredBy: ahead(20), created: ago(3), description: '1-litre insulated steel bottles for our office team. Plain or single-colour finish, delivered to Chennai.', offers: [['sports', 26500, 7, 'HydroPeak 1L bottles from stock. Custom logo printing available for ₹20 per bottle.', 'Insulated Sports Bottle 1L'], ['home', 24000, 14, 'Generic 1L steel bottles, assorted colours. Sourced from our Coimbatore supplier.']] },
    { c: arjun, title: 'Ergonomic mesh office chairs', category: 'Office Supplies', quantity: 12, budget: 72000, requiredBy: ahead(25), created: ago(4), description: 'High-back mesh chairs with lumbar support and adjustable armrests for a new office in Mumbai.', offers: [['tech', 69600, 10, 'Mesh chairs with 2-year warranty, assembled on delivery.'], ['books', 75000, 6, 'Premium chairs with headrest. Includes free installation.']] },
    { c: kavya, title: 'Cotton round-neck T-shirts with college logo print', category: 'Fashion', quantity: 120, budget: 36000, requiredBy: ahead(30), created: ago(2), description: '180 GSM cotton T-shirts, sizes S to XXL, single-colour logo print on front for a college fest.', offers: [['fashion', 33600, 12, 'Bio-washed cotton, screen printed logo, size mix as per your list.']] },
    { c: rahul, title: 'Noise-cancelling headsets for call centre', category: 'Electronics', quantity: 15, budget: 45000, requiredBy: ahead(18), created: ago(5), description: 'USB headsets with noise-cancelling microphone, comfortable for long shifts.', offers: [['tech', 41250, 5, 'USB stereo headsets with ENC mic, 1-year replacement warranty.']] },
    { c: sneha, title: "Children's story book sets for school library", category: 'Books', quantity: 30, budget: 12000, requiredBy: ahead(21), created: ago(1), description: 'Illustrated English story books for ages 6 to 10. Durable binding preferred.', offers: [] },
    { c: vikram, title: 'Dry fruit gift boxes for Diwali', category: 'Groceries', quantity: 40, budget: 32000, requiredBy: ahead(12), created: ago(2), description: 'Gift boxes with almonds, cashews and raisins (about 500g each) for client gifting.', offers: [['home', 30800, 6, '500g premium boxes with festive packaging, delivered in Delhi.']] },
  ];
  const requirementDocs = [];
  const offerDocs = [];
  for (const r of reqDefs) {
    const req = await M.Requirement.create({ customer: r.c._id, title: r.title, description: r.description, category: r.category, quantity: r.quantity, budget: r.budget, requiredBy: r.requiredBy, status: 'open', createdAt: r.created });
    requirementDocs.push(req);
    for (const [vk, price, days, details, productName] of r.offers) {
      const offerCreated = new Date(r.created.getTime() + between(4, 30) * HOUR);
      offerDocs.push(await M.Offer.create({
        requirement: req._id, vendor: vendorUsers[vk]._id, store: stores[vk]._id,
        product: productName ? byName(productName)._id : undefined,
        totalPrice: price, deliveryDays: days, expectedDeliveryDate: new Date(Date.now() + days * DAY), details, status: 'pending', createdAt: offerCreated,
      }));
    }
  }
  // Ensure the linked bottle offer can actually be fulfilled.
  await M.Product.updateOne({ _id: byName('Insulated Sports Bottle 1L')._id }, { $set: { stock: 85 } });

  // Awarded requirement → order (counts as sales of the linked yoga mat)
  const yogaMat = byName('Yoga Mat 6mm Anti-slip');
  const awardedReq = await M.Requirement.create({ customer: ananya._id, title: 'Yoga mats for community yoga class', description: 'Anti-slip yoga mats for a weekend community class of 25 people.', category: 'Sports & Fitness', quantity: 25, budget: 22000, requiredBy: ago(28), status: 'awarded', createdAt: ago(40), awardedAt: ago(37) });
  const accepted = await M.Offer.create({ requirement: awardedReq._id, vendor: vendorUsers.sports._id, store: stores.sports._id, product: yogaMat._id, totalPrice: 18750, deliveryDays: 5, expectedDeliveryDate: ago(32), details: '6mm FlexFit mats in assorted colours.', status: 'accepted', decidedAt: ago(37), createdAt: ago(39) });
  await M.Offer.create({ requirement: awardedReq._id, vendor: vendorUsers.fashion._id, store: stores.fashion._id, totalPrice: 21000, deliveryDays: 8, expectedDeliveryDate: ago(31), details: 'Eco jute-backed mats.', status: 'rejected', decidedAt: ago(37), createdAt: ago(39) });
  const awardOrderDate = ago(37);
  orderDocs.push({
    orderNumber: orderNo(awardOrderDate), customer: ananya._id, vendor: vendorUsers.sports._id, store: stores.sports._id, source: 'requirement',
    requirement: awardedReq._id, offer: accepted._id,
    items: [{ product: yogaMat._id, name: awardedReq.title, quantity: 25, unitPrice: 750, lineTotal: 18750 }],
    totalAmount: 18750, shippingAddress: addr(ananya), paymentMethod: 'simulated_online', status: 'delivered',
    statusHistory: historyFor('delivered', awardOrderDate, ananya._id, vendorUsers.sports._id), createdAt: awardOrderDate, updatedAt: awardOrderDate, _awardOrder: true,
  });
  await M.Requirement.create({ customer: karthik._id, title: 'Vintage film cameras for photography club', description: 'Working 35mm film cameras, any brand, for a college photography club.', category: 'Electronics', quantity: 5, budget: 25000, requiredBy: ago(5), status: 'expired', createdAt: ago(26) });
  const cancelledReq = await M.Requirement.create({ customer: priya._id, title: 'Bulk A4 printer paper', description: '75 GSM A4 paper, 50 reams, for office use.', category: 'Office Supplies', quantity: 50, budget: 12500, requiredBy: ago(2), status: 'cancelled', createdAt: ago(20) });
  await M.Offer.create({ requirement: cancelledReq._id, vendor: vendorUsers.books._id, store: stores.books._id, totalPrice: 12000, deliveryDays: 4, expectedDeliveryDate: ago(15), details: '75 GSM copier paper.', status: 'rejected', decidedAt: ago(18), createdAt: ago(19) });

  // Insert orders, derive product counters ----------------------------
  const inserted = await M.Order.insertMany(orderDocs.map(({ _awardOrder, ...o }) => o), { timestamps: false });
  const awardOrder = inserted.find((o) => o.source === 'requirement');
  await M.Requirement.updateOne({ _id: awardedReq._id }, { $set: { selectedOffer: accepted._id, order: awardOrder._id } });

  const counters = new Map();
  for (const o of inserted) {
    if (o.status === 'cancelled') continue;
    for (const it of o.items) {
      const k = String(it.product);
      const c = counters.get(k) || { units: 0, last: null };
      c.units += it.quantity;
      if (!c.last || o.createdAt > c.last) c.last = o.createdAt;
      counters.set(k, c);
    }
  }
  for (const { doc } of products) {
    const c = counters.get(String(doc._id));
    await M.Product.updateOne({ _id: doc._id }, { $set: { salesCount: c?.units || 0, lastSaleDate: c?.last || null } });
  }

  // Purchase events (Failed Purchase Learning) ------------------------
  const events = [];
  const pairState = new Map(); // `${customer}|${product}` → last cart action
  const touch = (cust, prod, action, t, qty = 1) => {
    const key = `${cust}|${prod}`;
    const prev = pairState.get(key);
    if (!prev || prev.t <= t) pairState.set(key, { action, t, qty, cust, prod });
  };
  const ev = (eventType, { user, sessionId, product, vendor, t, quantity, order, metadata }) =>
    events.push({ eventType, user, sessionId, product, vendor, timestamp: t, quantity, order, metadata });

  // 1) The real journey behind every order placed in the last 90 days.
  for (const o of inserted) {
    const t = o.createdAt;
    if (NOW - t > 90 * DAY) continue;
    for (const it of o.items) {
      const base = { user: o.customer, product: it.product, vendor: o.vendor };
      if (o.source === 'cart') {
        ev(EVENT_TYPES.VIEWED, { ...base, t: new Date(t - between(1, 30) * HOUR) });
        ev(EVENT_TYPES.ADDED, { ...base, t: new Date(t - between(10, 50) * 60000), quantity: it.quantity });
        ev(EVENT_TYPES.CHECKOUT, { ...base, t: new Date(t - between(2, 8) * 60000), quantity: it.quantity });
      }
      ev(EVENT_TYPES.PURCHASED, { ...base, t, quantity: it.quantity, order: o._id, metadata: { source: o.source, cancelled: o.status === 'cancelled' ? true : undefined } });
      touch(String(o.customer), String(it.product), 'purchased', t);
    }
  }

  // 2) Non-converting browsing, carts and checkouts.
  for (const { doc, profile, listedDaysAgo } of products) {
    const p = PROFILES[profile];
    const days = Math.min(90, listedDaysAgo);
    for (let d = 0; d < days; d += 1) {
      let views = Math.floor(p.views * between(0.4, 1.6) + rand());
      while (views > 0) {
        views -= 1;
        const t = new Date(NOW - (d + rand()) * DAY);
        if (t > NOW) continue;
        const loggedIn = chance(0.7);
        const cust = loggedIn ? pick(customers) : null;
        ev(EVENT_TYPES.VIEWED, { user: cust?._id, sessionId: cust ? undefined : `seed-${crypto.randomBytes(6).toString('hex')}`, product: doc._id, vendor: doc.vendor, t });
        if (!cust || !chance(p.addRate)) continue;
        const tAdd = new Date(t.getTime() + between(1, 15) * 60000);
        const qty = int(1, 2);
        ev(EVENT_TYPES.ADDED, { user: cust._id, product: doc._id, vendor: doc.vendor, t: tAdd, quantity: qty });
        touch(String(cust._id), String(doc._id), 'added', tAdd, qty);
        let tLast = tAdd;
        if (chance(0.15)) {
          tLast = new Date(tAdd.getTime() + between(1, 10) * 60000);
          ev(EVENT_TYPES.QTY_CHANGED, { user: cust._id, product: doc._id, vendor: doc.vendor, t: tLast, quantity: qty + 1, metadata: { fromQuantity: qty, toQuantity: qty + 1 } });
          touch(String(cust._id), String(doc._id), 'added', tLast, qty + 1);
        }
        if (chance(p.checkoutRate ?? 0.15)) {
          tLast = new Date(tLast.getTime() + between(2, 30) * 60000);
          ev(EVENT_TYPES.CHECKOUT, { user: cust._id, product: doc._id, vendor: doc.vendor, t: tLast, quantity: qty });
        }
        if (chance(p.removeRate ?? 0.4)) {
          const tRem = new Date(tLast.getTime() + between(5, 240) * 60000);
          if (tRem < NOW) {
            const reason = p.reasons && chance(0.7) ? pick(p.reasons) : chance(0.3) ? pick(REMOVAL_REASONS) : undefined;
            ev(EVENT_TYPES.REMOVED, { user: cust._id, product: doc._id, vendor: doc.vendor, t: tRem, quantity: qty, metadata: { reason } });
            touch(String(cust._id), String(doc._id), 'removed', tRem);
          }
        }
      }
    }
  }
  await M.PurchaseEvent.insertMany(events.filter((e) => e.timestamp <= new Date(NOW)));

  // Carts reflect the last cart action of each customer/product pair.
  const stockNow = new Map((await M.Product.find().select('stock').lean()).map((p) => [String(p._id), p.stock]));
  const carts = new Map();
  for (const s of pairState.values()) {
    if (s.action !== 'added') continue;
    const qty = Math.min(s.qty, stockNow.get(s.prod) || 0);
    if (qty < 1) continue;
    if (!carts.has(s.cust)) carts.set(s.cust, []);
    carts.get(s.cust).push({ product: s.prod, quantity: qty, addedAt: s.t });
  }
  for (const c of customers) await M.Cart.create({ user: c._id, items: carts.get(String(c._id)) || [] });

  // Rescue deals --------------------------------------------------------
  const jig = expiredDealWindow.product;
  const dealOrders = inserted.filter((o) => o.items.some((i) => String(i.rescueDeal) === String(expiredDealId)) && o.status !== 'cancelled');
  await M.RescueDeal.create({
    _id: expiredDealId, product: jig._id, vendor: jig.vendor, discountPercent: expiredDealWindow.pct, originalPrice: jig.price,
    dealPrice: round2(jig.price * (1 - expiredDealWindow.pct / 100)), startsAt: expiredDealWindow.from, endsAt: expiredDealWindow.to,
    status: 'expired', riskStatusAtCreation: 'slow_moving', stockAtCreation: 16,
    unitsSold: dealOrders.reduce((s, o) => s + o.items[0].quantity, 0), revenue: round2(dealOrders.reduce((s, o) => s + o.totalAmount, 0)), createdAt: expiredDealWindow.from,
  });
  for (const [name, pct, started, ends] of [['Woollen Winter Muffler', 40, 2, 12], ['Glass Storage Jars Set of 6', 30, 4, 6]]) {
    const p = await M.Product.findById(byName(name)._id);
    await M.RescueDeal.create({ product: p._id, vendor: p.vendor, discountPercent: pct, originalPrice: p.price, dealPrice: round2(p.price * (1 - pct / 100)), startsAt: ago(started), endsAt: ahead(ends), status: 'active', riskStatusAtCreation: 'dead_stock', stockAtCreation: p.stock, createdAt: ago(started) });
  }

  // Reports, notifications, activity -------------------------------------
  await M.Report.create([
    { reporter: rahul._id, category: 'product', subject: 'Listing photo does not match product', description: 'The keyboard I viewed shows a different layout in the description than in the specifications.', relatedId: 'Mechanical Keyboard (Blue Switch)', status: 'open', createdAt: ago(2) },
    { reporter: sneha._id, category: 'order', subject: 'Delivery delayed beyond estimate', description: 'My order has been in shipped status for six days without tracking updates.', status: 'in_review', adminNote: 'Contacted vendor for tracking details.', handledBy: admin._id, createdAt: ago(5) },
    { reporter: vendorUsers.home._id, category: 'technical', subject: 'Unable to upload product image URL', description: 'Image URL with query parameters was rejected when editing a product.', status: 'resolved', adminNote: 'URL validation fixed; please retry.', handledBy: admin._id, resolvedAt: ago(8), createdAt: ago(10) },
  ]);
  const notes = [];
  for (const r of requirementDocs) {
    const n = offerDocs.filter((o) => String(o.requirement) === String(r._id)).length;
    if (n) notes.push({ user: r.customer, type: 'offer', title: `${n} offer(s) received for "${r.title}"`, message: 'Compare offers side by side and select the best one.', link: `/requirements/${r._id}`, createdAt: ago(1) });
  }
  notes.push({ user: admin._id, type: 'account', title: 'New vendor registration: GreenLeaf Organics', message: 'Review and approve the store before it can sell.', link: '/admin/vendors', createdAt: ago(3) });
  await M.Notification.insertMany(notes);
  await M.ActivityLog.insertMany([
    { actor: admin._id, actorRole: 'admin', action: 'vendor.approved', entityType: 'Vendor', entityId: String(stores.tech._id), summary: 'TechNest Electronics', createdAt: ago(183) },
    { actor: pendingUser._id, actorRole: 'vendor', action: 'user.registered', entityType: 'User', entityId: String(pendingUser._id), summary: 'vendor: greenleaf@marketplace.test', createdAt: ago(3) },
    { actor: ananya._id, actorRole: 'customer', action: 'offer.selected', entityType: 'Requirement', entityId: String(awardedReq._id), summary: `${awardedReq.title} → ${awardOrder.orderNumber}`, createdAt: ago(37) },
    ...requirementDocs.map((r) => ({ actor: r.customer, actorRole: 'customer', action: 'requirement.posted', entityType: 'Requirement', entityId: String(r._id), summary: r.title, createdAt: r.createdAt })),
  ]);

  // Run the real intelligence services so insights, alerts and summaries exist.
  const insights = await analyzeInventory({ notifyChanges: true });
  for (const v of Object.values(vendorUsers)) await vendorSummary(v._id);

  const dist = insights.reduce((m, i) => ({ ...m, [i.riskStatus]: (m[i.riskStatus] || 0) + 1 }), {});
  console.log(`Users: ${await M.User.countDocuments()} | Products: ${await M.Product.countDocuments()} | Orders: ${inserted.length} | Events: ${await M.PurchaseEvent.countDocuments()}`);
  console.log(`Requirements: ${await M.Requirement.countDocuments()} | Offers: ${await M.Offer.countDocuments()} | Carts with items: ${carts.size}`);
  console.log('Inventory classification:', dist);
  console.log('\nDemo accounts');
  console.log('  Admin     admin@marketplace.test      / Admin@123');
  console.log('  Vendor    technest@marketplace.test   / Vendor@123  (also urbanthread, homecraft, fitzone, pageturner)');
  console.log('  Pending   greenleaf@marketplace.test  / Vendor@123');
  console.log('  Customer  priya@marketplace.test      / Customer@123 (also arjun, kavya, rahul, sneha, vikram, ananya, karthik)');
  await disconnectDB();
}

if (require.main === module) {
  seed().catch(async (err) => {
    console.error(err);
    await disconnectDB();
    process.exit(1);
  });
}

module.exports = { seed };
