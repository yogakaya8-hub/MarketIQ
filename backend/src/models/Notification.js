const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['order', 'offer', 'requirement', 'dead_stock', 'rescue_deal', 'account', 'report', 'system'],
      default: 'system',
    },
    title: { type: String, required: true, maxlength: 140 },
    message: { type: String, maxlength: 600 },
    link: String,
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
