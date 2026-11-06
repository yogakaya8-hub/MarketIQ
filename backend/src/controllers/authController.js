const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { User, Vendor } = require('../models');
const { signToken } = require('../middleware/auth');
const { notify } = require('../services/notificationService');
const { logActivity } = require('../services/activityService');

async function sessionPayload(user) {
  const vendor = user.role === 'vendor' ? await Vendor.findOne({ user: user._id }).lean() : null;
  return { user: user.toJSON(), vendor };
}

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, storeName, storeDescription, categories, city } = req.body;
  if (await User.exists({ email })) throw ApiError.conflict('An account with this email already exists');
  if (role === 'vendor' && (await Vendor.exists({ storeName }).collation({ locale: 'en', strength: 2 }))) {
    throw ApiError.conflict('That store name is already taken');
  }

  const user = await User.create({ name, email, password, role, phone });
  if (role === 'vendor') {
    try {
      await Vendor.create({ user: user._id, storeName, description: storeDescription, categories: categories || [], city, phone });
    } catch (err) {
      await User.deleteOne({ _id: user._id });
      throw err;
    }
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id').lean();
    await notify(admins.map((a) => a._id), {
      type: 'account',
      title: `New vendor registration: ${storeName}`,
      message: 'Review and approve the store before it can sell.',
      link: '/admin/vendors',
    });
  }
  await logActivity(user, 'user.registered', { entityType: 'User', entityId: user._id, summary: `${role}: ${email}` });
  res.status(201).json({ success: true, token: signToken(user), ...(await sessionPayload(user)) });
});

exports.login = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+password');
  if (!user || !(await user.comparePassword(req.body.password))) throw ApiError.unauthorized('Invalid email or password');
  if (!user.isActive) throw ApiError.forbidden('This account has been suspended. Contact the administrator.');
  user.lastLoginAt = new Date();
  await user.save();
  res.json({ success: true, token: signToken(user), ...(await sessionPayload(user)) });
});

exports.me = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await sessionPayload(req.user)) });
});

exports.updateMe = asyncHandler(async (req, res) => {
  Object.assign(req.user, req.body);
  await req.user.save();
  res.json({ success: true, ...(await sessionPayload(req.user)) });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(req.body.currentPassword))) throw ApiError.badRequest('Current password is incorrect');
  user.password = req.body.newPassword;
  await user.save();
  res.json({ success: true, message: 'Password updated' });
});
