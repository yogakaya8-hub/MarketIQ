const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { Requirement, Offer, Vendor, Order, Product, User } = require('../models');
const { escapeRegex, getPagination, pageMeta } = require('../utils/pagination');
const { endOfDay, expireRequirements, cancelRequirement } = require('../services/reverseMarketplaceService');
const { notify } = require('../services/notificationService');
const { logActivity } = require('../services/activityService');
const { DAY_MS } = require('../utils/dates');

// Vendors see a masked customer: first name and city only.
const maskCustomer = (c) => (c ? { name: String(c.name || '').split(' ')[0], city: c.address?.city } : null);

exports.create = asyncHandler(async (req, res) => {
  const requiredBy = endOfDay(req.body.requiredBy);
  if (Number.isNaN(requiredBy.getTime())) throw ApiError.badRequest('Invalid required date');
  if (requiredBy < new Date()) throw ApiError.badRequest('Required date cannot be in the past');
  if (requiredBy > new Date(Date.now() + 365 * DAY_MS)) throw ApiError.badRequest('Required date must be within one year');

  const requirement = await Requirement.create({ ...req.body, requiredBy, customer: req.user._id });

  const vendors = await Vendor.find({ status: 'approved', categories: requirement.category }).select('user').lean();
  await notify(vendors.map((v) => v.user), {
    type: 'requirement',
    title: `New ${requirement.category} requirement: ${requirement.title}`,
    message: `Qty ${requirement.quantity}, budget ₹${requirement.budget.toLocaleString('en-IN')}`,
    link: `/vendor/requirements/${requirement._id}`,
  });
  await logActivity(req.user, 'requirement.posted', { entityType: 'Requirement', entityId: requirement._id, summary: requirement.title });
  res.status(201).json({ success: true, requirement });
});

async function offerCounts(ids) {
  const rows = await Offer.aggregate([
    { $match: { requirement: { $in: ids }, status: { $ne: 'withdrawn' } } },
    { $group: { _id: '$requirement', n: { $sum: 1 }, lowest: { $min: '$totalPrice' } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
}

exports.list = asyncHandler(async (req, res) => {
  await expireRequirements();
  const { role } = req.user;
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 20 });
  const filter = {};
  if (req.query.category) filter.category = req.query.category;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ title: rx }, { description: rx }];
  }

  if (role === 'customer') {
    filter.customer = req.user._id;
    if (req.query.status) filter.status = req.query.status;
  } else if (role === 'vendor') {
    // Requirement board: open requirements that can still be delivered.
    filter.status = 'open';
    filter.requiredBy = { $gte: new Date() };
    if (req.query.relevant === 'true') {
      const productCats = await Product.distinct('category', { vendor: req.user._id, isArchived: { $ne: true } });
      const cats = [...new Set([...(req.vendorProfile?.categories || []), ...productCats])];
      if (!req.query.category) filter.category = { $in: cats };
    }
  } else if (req.query.status) {
    filter.status = req.query.status;
  }

  const [items, total] = await Promise.all([
    Requirement.find(filter).sort(role === 'vendor' ? { requiredBy: 1 } : { createdAt: -1 }).skip(skip).limit(limit)
      .populate('customer', 'name email address').lean(),
    Requirement.countDocuments(filter),
  ]);
  const counts = await offerCounts(items.map((r) => r._id));
  let myOffers = new Map();
  if (role === 'vendor') {
    const mine = await Offer.find({ vendor: req.user._id, requirement: { $in: items.map((r) => r._id) } }).lean();
    myOffers = new Map(mine.map((o) => [String(o.requirement), o]));
  }
  const requirements = items.map((r) => ({
    ...r,
    customer: role === 'vendor' ? maskCustomer(r.customer) : r.customer,
    offerCount: counts.get(String(r._id))?.n || 0,
    ...(role !== 'vendor' ? { lowestOffer: counts.get(String(r._id))?.lowest ?? null } : {}),
    ...(role === 'vendor' ? { myOffer: myOffers.get(String(r._id)) || null } : {}),
  }));
  res.json({ success: true, requirements, ...pageMeta(total, page, limit) });
});

async function vendorStats(vendorIds) {
  const rows = await Order.aggregate([
    { $match: { vendor: { $in: vendorIds } } },
    {
      $group: {
        _id: '$vendor',
        delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
        total: { $sum: 1 },
      },
    },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
}

// Adds comparison data so customers can weigh offers on price, delivery and vendor record.
async function buildComparison(requirement, offers) {
  const stats = await vendorStats(offers.map((o) => o.vendor));
  const live = offers.filter((o) => o.status === 'pending');
  const minPrice = live.length ? Math.min(...live.map((o) => o.totalPrice)) : null;
  const minDays = live.length ? Math.min(...live.map((o) => o.deliveryDays)) : null;
  return offers.map((o) => {
    const s = stats.get(String(o.vendor)) || { delivered: 0, cancelled: 0, total: 0 };
    const tags = [];
    if (o.status === 'pending' && o.totalPrice === minPrice) tags.push('Lowest price');
    if (o.status === 'pending' && o.deliveryDays === minDays) tags.push('Fastest delivery');
    if (o.totalPrice <= requirement.budget) tags.push('Within budget');
    return {
      ...o,
      unitPrice: Math.round((o.totalPrice / requirement.quantity) * 100) / 100,
      overBudget: o.totalPrice > requirement.budget,
      budgetDifference: Math.round((o.totalPrice - requirement.budget) * 100) / 100,
      meetsRequiredDate: new Date(o.expectedDeliveryDate) <= new Date(requirement.requiredBy),
      vendorRecord: {
        deliveredOrders: s.delivered,
        totalOrders: s.total,
        fulfilmentRate: s.total ? Math.round((s.delivered / s.total) * 100) : null,
        cancelledOrders: s.cancelled,
      },
      tags,
    };
  });
}

exports.getOne = asyncHandler(async (req, res) => {
  await expireRequirements();
  const requirement = await Requirement.findById(req.params.id).populate('customer', 'name email address').populate('order', 'orderNumber status totalAmount').lean();
  if (!requirement) throw ApiError.notFound('Requirement not found');
  const { role } = req.user;
  const isOwner = String(requirement.customer._id) === String(req.user._id);

  if (role === 'customer' && !isOwner) throw ApiError.notFound('Requirement not found');

  if (role === 'vendor') {
    const myOffer = await Offer.findOne({ requirement: requirement._id, vendor: req.user._id }).populate('product', 'name stock price').lean();
    if (requirement.status !== 'open' && !myOffer) throw ApiError.notFound('Requirement not found');
    const offerCount = await Offer.countDocuments({ requirement: requirement._id, status: { $ne: 'withdrawn' } });
    const myProducts = await Product.find({ vendor: req.user._id, isArchived: { $ne: true }, isActive: true, isBlocked: false, category: requirement.category })
      .select('name stock price').lean();
    return res.json({
      success: true,
      requirement: { ...requirement, customer: maskCustomer(requirement.customer), order: myOffer?.status === 'accepted' ? requirement.order : undefined },
      offerCount,
      myOffer,
      myMatchingProducts: myProducts,
    });
  }

  const offers = await Offer.find({ requirement: requirement._id, status: { $ne: 'withdrawn' } })
    .populate('store', 'storeName city createdAt')
    .populate('product', 'name')
    .sort({ totalPrice: 1 })
    .lean();
  res.json({ success: true, requirement, offers: await buildComparison(requirement, offers) });
});

exports.cancel = asyncHandler(async (req, res) => {
  const requirement = await cancelRequirement(req.user, req.params.id);
  res.json({ success: true, requirement });
});

exports.maskCustomer = maskCustomer;
