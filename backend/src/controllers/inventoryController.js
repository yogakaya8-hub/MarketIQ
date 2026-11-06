const asyncHandler = require('../utils/asyncHandler');
const { Settings } = require('../models');
const { analyzeInventory } = require('../services/deadStockService');
const { RISK_LABELS } = require('../config/constants');

// GET /api/inventory/dead-stock?status=at_risk
// Runs the analysis on current data, stores InventoryInsight snapshots and returns every product
// with its classification, evidence and suggested actions. Vendors see their own products only.
exports.deadStock = asyncHandler(async (req, res) => {
  const vendorId = req.user.role === 'admin' ? req.query.vendor || null : req.user._id;
  const results = await analyzeInventory({ vendorId });
  const summary = Object.fromEntries(Object.keys(RISK_LABELS).map((k) => [k, 0]));
  for (const r of results) summary[r.riskStatus] += 1;
  const items = req.query.status ? results.filter((r) => r.riskStatus === req.query.status) : results;
  const { deadStock } = await Settings.get();
  res.json({ success: true, summary, thresholds: deadStock, labels: RISK_LABELS, items });
});
