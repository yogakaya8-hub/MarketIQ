const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { Vendor } = require('../models');

exports.getProfile = asyncHandler(async (req, res) => {
  if (!req.vendorProfile) throw ApiError.notFound('Store profile not found');
  res.json({ success: true, vendor: req.vendorProfile });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  if (!req.vendorProfile) throw ApiError.notFound('Store profile not found');
  if (req.body.storeName && req.body.storeName !== req.vendorProfile.storeName) {
    const taken = await Vendor.exists({ storeName: req.body.storeName, _id: { $ne: req.vendorProfile._id } }).collation({ locale: 'en', strength: 2 });
    if (taken) throw ApiError.conflict('That store name is already taken');
  }
  Object.assign(req.vendorProfile, req.body);
  await req.vendorProfile.save();
  res.json({ success: true, vendor: req.vendorProfile });
});
