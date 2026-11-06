const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { Report, User } = require('../models');
const { notify } = require('../services/notificationService');
const { logActivity } = require('../services/activityService');

exports.create = asyncHandler(async (req, res) => {
  const report = await Report.create({ ...req.body, reporter: req.user._id });
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id').lean();
  await notify(admins.map((a) => a._id), { type: 'report', title: `New issue reported: ${report.subject}`, link: '/admin/reports' });
  await logActivity(req.user, 'report.created', { entityType: 'Report', entityId: report._id, summary: report.subject });
  res.status(201).json({ success: true, report });
});

exports.mine = asyncHandler(async (req, res) => {
  const reports = await Report.find({ reporter: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, reports });
});

exports.all = asyncHandler(async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  const reports = await Report.find(filter).sort({ createdAt: -1 }).populate('reporter', 'name email role').populate('handledBy', 'name').lean();
  res.json({ success: true, reports });
});

exports.update = asyncHandler(async (req, res) => {
  const report = await Report.findById(req.params.id);
  if (!report) throw ApiError.notFound('Report not found');
  report.status = req.body.status;
  if (req.body.adminNote !== undefined) report.adminNote = req.body.adminNote;
  report.handledBy = req.user._id;
  report.resolvedAt = ['resolved', 'dismissed'].includes(report.status) ? new Date() : undefined;
  await report.save();
  await notify(report.reporter, {
    type: 'report',
    title: `Your report "${report.subject}" is ${report.status.replace('_', ' ')}`,
    message: report.adminNote,
    link: '/reports',
  });
  await logActivity(req.user, 'report.updated', { entityType: 'Report', entityId: report._id, summary: `${report.subject} → ${report.status}` });
  res.json({ success: true, report });
});
