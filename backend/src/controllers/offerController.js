const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { Offer } = require('../models');
const { getPagination, pageMeta } = require('../utils/pagination');
const svc = require('../services/reverseMarketplaceService');

exports.submit = asyncHandler(async (req, res) => {
  const offer = await svc.submitOffer(req.user, req.vendorProfile, req.body);
  res.status(201).json({ success: true, offer });
});

exports.mine = asyncHandler(async (req, res) => {
  await svc.expireRequirements();
  const filter = { vendor: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  const offers = await Offer.find(filter)
    .sort({ updatedAt: -1 })
    .populate('requirement', 'title category quantity budget requiredBy status order')
    .populate('product', 'name')
    .lean();
  res.json({ success: true, offers });
});

exports.all = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 25 });
  const [offers, total] = await Promise.all([
    Offer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
      .populate('requirement', 'title quantity budget status')
      .populate('store', 'storeName')
      .lean(),
    Offer.countDocuments(filter),
  ]);
  res.json({ success: true, offers, ...pageMeta(total, page, limit) });
});

// PUT /api/offers/:id with { action: "select" | "update" | "withdraw" }
exports.act = asyncHandler(async (req, res) => {
  const { action } = req.body;
  const { role } = req.user;
  if (action === 'select') {
    if (role !== 'customer') throw ApiError.forbidden('Only customers can select offers');
    const result = await svc.selectOffer(req.user, req.params.id, req.body);
    return res.json({ success: true, ...result });
  }
  if (role !== 'vendor') throw ApiError.forbidden('Only vendors can change offers');
  if (req.vendorProfile?.status !== 'approved') throw ApiError.forbidden('Only approved vendors can change offers');
  if (action === 'update') {
    const offer = await svc.reviseOffer(req.user, req.params.id, req.body);
    return res.json({ success: true, offer });
  }
  const offer = await svc.withdrawOffer(req.user, req.params.id);
  res.json({ success: true, offer });
});
