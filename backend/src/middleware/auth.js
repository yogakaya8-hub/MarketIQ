const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { User, Vendor } = require('../models');
const { ROLES } = require('../config/constants');

const signToken = (user) => jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

async function resolveUser(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const payload = jwt.verify(header.slice(7), env.jwtSecret);
  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  if (!user.isActive) throw ApiError.forbidden('This account has been suspended. Contact the administrator.');
  return user;
}

// Requires a valid token. Role is always read from the database, never trusted from the token alone.
async function protect(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) throw ApiError.unauthorized();
    req.user = user;
    if (user.role === ROLES.VENDOR) req.vendorProfile = await Vendor.findOne({ user: user._id });
    next();
  } catch (err) {
    next(err);
  }
}

// Attaches the user when a valid token is present, otherwise continues anonymously.
async function optionalAuth(req, res, next) {
  try {
    req.user = await resolveUser(req);
  } catch {
    req.user = null;
  }
  next();
}

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) return next(ApiError.forbidden(`This action requires role: ${roles.join(' or ')}`));
  next();
};

// Vendor actions that affect the marketplace need an approved store.
function requireApprovedVendor(req, res, next) {
  if (req.user?.role !== ROLES.VENDOR) return next(ApiError.forbidden('Vendor account required'));
  if (!req.vendorProfile) return next(ApiError.forbidden('Vendor store profile not found'));
  if (req.vendorProfile.status !== 'approved') {
    return next(ApiError.forbidden(`Your store is ${req.vendorProfile.status}. Only approved vendors can do this.`));
  }
  next();
}

module.exports = { protect, optionalAuth, authorize, requireApprovedVendor, signToken };
