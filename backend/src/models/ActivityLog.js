const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  actorRole: String,
  action: { type: String, required: true }, // e.g. order.placed, offer.selected
  entityType: String,
  entityId: String,
  summary: String,
  createdAt: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model('ActivityLog', activityLogSchema);
