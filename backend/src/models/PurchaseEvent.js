const mongoose = require('mongoose');
const { EVENT_TYPES } = require('../config/constants');

const purchaseEventSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // null for anonymous browsing
  sessionId: { type: String, maxlength: 64 }, // anonymous visitor key for view de-duplication
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  eventType: { type: String, enum: Object.values(EVENT_TYPES), required: true },
  quantity: { type: Number, min: 0 },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  metadata: {
    fromQuantity: Number,
    toQuantity: Number,
    reason: String, // only set when the customer explicitly chose a reason
    source: String,
    cancelled: Boolean, // set on purchase_completed events whose order was later cancelled
  },
  timestamp: { type: Date, default: Date.now },
});

purchaseEventSchema.index({ vendor: 1, timestamp: -1 });
purchaseEventSchema.index({ product: 1, eventType: 1, timestamp: -1 });
purchaseEventSchema.index({ eventType: 1, timestamp: -1 });

module.exports = mongoose.model('PurchaseEvent', purchaseEventSchema);
