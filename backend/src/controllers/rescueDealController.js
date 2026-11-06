const asyncHandler = require('../utils/asyncHandler');
const { RescueDeal, Vendor, Settings } = require('../models');
const { expireDueDeals } = require('../services/pricingService');
const { createDeal, cancelDeal } = require('../services/rescueDealService');

// Public Rescue Deals page: only deals that are active right now on visible, in-stock products.
exports.publicList = asyncHandler(async (req, res) => {
  await expireDueDeals();
  const now = new Date();
  const approved = new Set((await Vendor.find({ status: 'approved' }).distinct('_id')).map(String));
  const deals = await RescueDeal.find({ status: 'active', startsAt: { $lte: now }, endsAt: { $gt: now } })
    .sort({ discountPercent: -1 })
    .populate({ path: 'product', populate: { path: 'store', select: 'storeName city' } })
    .lean();
  const visible = deals.filter(
    (d) => d.product && d.product.isActive && !d.product.isBlocked && !d.product.isArchived && d.product.stock > 0 && approved.has(String(d.product.store?._id))
  );
  res.json({
    success: true,
    deals: visible.map((d) => ({
      _id: d._id,
      discountPercent: d.discountPercent,
      dealPrice: d.dealPrice,
      originalPrice: d.originalPrice,
      endsAt: d.endsAt,
      product: { ...d.product, effectivePrice: d.dealPrice, deal: { discountPercent: d.discountPercent, dealPrice: d.dealPrice, endsAt: d.endsAt } },
    })),
  });
});

exports.mine = asyncHandler(async (req, res) => {
  await expireDueDeals({ force: true });
  const deals = await RescueDeal.find({ vendor: req.user._id }).sort({ createdAt: -1 }).populate('product', 'name stock price imageUrl category').lean();
  const { rescue } = await Settings.get();
  res.json({ success: true, deals, limits: rescue });
});

exports.create = asyncHandler(async (req, res) => {
  const deal = await createDeal(req.user, req.body);
  res.status(201).json({ success: true, deal });
});

exports.cancel = asyncHandler(async (req, res) => {
  const deal = await cancelDeal(req.user, req.params.id, { asAdmin: req.user.role === 'admin' });
  res.json({ success: true, deal });
});
