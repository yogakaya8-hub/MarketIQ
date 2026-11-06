const asyncHandler = require('../utils/asyncHandler');
const { computeDropoff } = require('../services/purchaseAnalyticsService');
const { vendorSummary, platformSummary } = require('../services/salesAnalyticsService');

const clampDays = (d) => Math.min(365, Math.max(1, parseInt(d, 10) || 30));

exports.purchaseDropoff = asyncHandler(async (req, res) => {
  const vendorId = req.user.role === 'admin' ? req.query.vendor || null : req.user._id;
  res.json({ success: true, ...(await computeDropoff({ vendorId, days: clampDays(req.query.days) })) });
});

exports.vendorSummary = asyncHandler(async (req, res) => {
  res.json({ success: true, summary: await vendorSummary(req.user._id) });
});

exports.platform = asyncHandler(async (req, res) => {
  res.json({ success: true, summary: await platformSummary() });
});
