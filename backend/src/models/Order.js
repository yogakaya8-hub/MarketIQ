const mongoose = require('mongoose');
const { ORDER_STATUS } = require('../config/constants');

// ER: OrderItem is stored as an embedded sub-document of Order.
const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  originalUnitPrice: { type: Number, min: 0 },
  rescueDeal: { type: mongoose.Schema.Types.ObjectId, ref: 'RescueDeal' },
  lineTotal: { type: Number, required: true, min: 0 },
});

const statusEntrySchema = new mongoose.Schema(
  {
    status: { type: String, enum: ORDER_STATUS },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: String,
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    checkoutGroup: { type: String, index: true }, // one checkout may create one order per vendor
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    source: { type: String, enum: ['cart', 'requirement'], default: 'cart' },
    requirement: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement' },
    offer: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
    items: { type: [orderItemSchema], validate: (v) => v.length > 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    shippingAddress: {
      line1: { type: String, required: true },
      city: { type: String, required: true },
      state: String,
      postalCode: { type: String, required: true },
    },
    paymentMethod: { type: String, enum: ['cod', 'simulated_online'], default: 'cod' },
    status: { type: String, enum: ORDER_STATUS, default: 'placed', index: true },
    statusHistory: [statusEntrySchema],
    cancelReason: String,
  },
  { timestamps: true }
);

orderSchema.index({ vendor: 1, createdAt: -1 });
orderSchema.index({ 'items.product': 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
