const { Requirement, Offer, Product, Order, Vendor } = require('../models');
const ApiError = require('../utils/ApiError');
const { round2 } = require('../utils/money');
const { addDays } = require('../utils/dates');
const { reserveStock, releaseStock, newOrderNumber, PURCHASABLE } = require('./orderService');
const { recordPurchases } = require('./trackingService');
const { notify } = require('./notificationService');
const { logActivity } = require('./activityService');

// "Required by" is inclusive: a requirement stays open until the end of that day (UTC).
const endOfDay = (dateStr) => new Date(`${String(dateStr).slice(0, 10)}T23:59:59.999Z`);

async function expireRequirements() {
  await Requirement.updateMany({ status: 'open', requiredBy: { $lt: new Date() } }, { $set: { status: 'expired' } });
}

function assertOpen(requirement) {
  if (requirement.status !== 'open') throw ApiError.conflict(`This requirement is ${requirement.status} and no longer accepts changes`);
  if (requirement.requiredBy < new Date()) throw ApiError.conflict('The required date for this requirement has passed');
}

async function validateOfferTerms(requirement, vendorUser, { totalPrice, deliveryDays, productId }) {
  const expectedDeliveryDate = addDays(new Date(), deliveryDays);
  if (expectedDeliveryDate > requirement.requiredBy) {
    const latest = Math.floor((requirement.requiredBy - Date.now()) / 86400000);
    throw ApiError.badRequest(
      latest >= 1
        ? `Delivery must arrive by the required date. Offer at most ${latest} day(s) delivery.`
        : 'There is not enough time left to deliver before the required date'
    );
  }
  if (!(totalPrice > 0)) throw ApiError.badRequest('Price must be greater than zero');

  let product = null;
  if (productId) {
    product = await Product.findOne({ _id: productId, vendor: vendorUser._id, ...PURCHASABLE });
    if (!product) throw ApiError.badRequest('Linked product not found in your active catalogue');
    if (product.stock < requirement.quantity) {
      throw ApiError.badRequest(`Linked product has only ${product.stock} in stock but ${requirement.quantity} are required`);
    }
  }
  return { expectedDeliveryDate, product };
}

async function submitOffer(vendorUser, vendorProfile, input) {
  const requirement = await Requirement.findById(input.requirementId);
  if (!requirement) throw ApiError.notFound('Requirement not found');
  assertOpen(requirement);

  const existing = await Offer.findOne({ requirement: requirement._id, vendor: vendorUser._id });
  if (existing) throw ApiError.conflict('You have already submitted an offer for this requirement. Revise your existing offer instead.');

  const { expectedDeliveryDate, product } = await validateOfferTerms(requirement, vendorUser, input);
  const offer = await Offer.create({
    requirement: requirement._id,
    vendor: vendorUser._id,
    store: vendorProfile._id,
    product: product?._id,
    totalPrice: round2(input.totalPrice),
    deliveryDays: input.deliveryDays,
    expectedDeliveryDate,
    details: input.details,
  });

  await notify(requirement.customer, {
    type: 'offer',
    title: `New offer for "${requirement.title}"`,
    message: `${vendorProfile.storeName} offered ₹${offer.totalPrice.toLocaleString('en-IN')} with ${offer.deliveryDays}-day delivery`,
    link: `/requirements/${requirement._id}`,
  });
  await logActivity(vendorUser, 'offer.submitted', { entityType: 'Offer', entityId: offer._id, summary: requirement.title });
  return offer;
}

async function reviseOffer(vendorUser, offerId, input) {
  const offer = await Offer.findById(offerId);
  if (!offer) throw ApiError.notFound('Offer not found');
  if (String(offer.vendor) !== String(vendorUser._id)) throw ApiError.forbidden('You can only revise your own offers');
  if (!['pending', 'withdrawn'].includes(offer.status)) throw ApiError.conflict(`An ${offer.status} offer cannot be revised`);
  const requirement = await Requirement.findById(offer.requirement);
  assertOpen(requirement);

  const terms = {
    totalPrice: input.totalPrice ?? offer.totalPrice,
    deliveryDays: input.deliveryDays ?? offer.deliveryDays,
    productId: input.productId === undefined ? offer.product : input.productId,
  };
  const { expectedDeliveryDate, product } = await validateOfferTerms(requirement, vendorUser, terms);

  const updated = await Offer.findOneAndUpdate(
    { _id: offer._id, status: { $in: ['pending', 'withdrawn'] } },
    {
      $set: {
        totalPrice: round2(terms.totalPrice),
        deliveryDays: terms.deliveryDays,
        expectedDeliveryDate,
        product: product?._id ?? null,
        details: input.details ?? offer.details,
        status: 'pending',
      },
    },
    { new: true }
  );
  if (!updated) throw ApiError.conflict('Offer was decided while you were editing it');
  await notify(requirement.customer, {
    type: 'offer',
    title: `An offer for "${requirement.title}" was updated`,
    link: `/requirements/${requirement._id}`,
  });
  await logActivity(vendorUser, 'offer.revised', { entityType: 'Offer', entityId: offer._id, summary: requirement.title });
  return updated;
}

async function withdrawOffer(vendorUser, offerId) {
  const updated = await Offer.findOneAndUpdate(
    { _id: offerId, vendor: vendorUser._id, status: 'pending' },
    { $set: { status: 'withdrawn' } },
    { new: true }
  );
  if (!updated) throw ApiError.conflict('Only your own pending offers can be withdrawn');
  await logActivity(vendorUser, 'offer.withdrawn', { entityType: 'Offer', entityId: offerId });
  return updated;
}

// Customer selects an offer: closes the requirement, accepts one offer, rejects the rest and
// creates the order. Each step is a conditional atomic update, with compensation on failure,
// so two parallel selections can never both succeed.
async function selectOffer(customer, offerId, { shippingAddress, paymentMethod }) {
  const offer = await Offer.findById(offerId);
  if (!offer) throw ApiError.notFound('Offer not found');
  const requirement = await Requirement.findById(offer.requirement);
  if (!requirement) throw ApiError.notFound('Requirement not found');
  if (String(requirement.customer) !== String(customer._id)) throw ApiError.forbidden('Only the customer who posted this requirement can select an offer');
  assertOpen(requirement);
  if (offer.status !== 'pending') throw ApiError.conflict(`This offer is ${offer.status} and cannot be selected`);

  const store = await Vendor.findById(offer.store);
  if (!store || store.status !== 'approved') throw ApiError.conflict('This vendor is not currently active on the marketplace');

  const claimed = await Requirement.findOneAndUpdate(
    { _id: requirement._id, customer: customer._id, status: 'open' },
    { $set: { status: 'awarded', selectedOffer: offer._id, awardedAt: new Date() } },
    { new: true }
  );
  if (!claimed) throw ApiError.conflict('This requirement has already been closed');

  const undoRequirement = () =>
    Requirement.updateOne({ _id: requirement._id }, { $set: { status: 'open' }, $unset: { selectedOffer: 1, awardedAt: 1 } });

  const accepted = await Offer.findOneAndUpdate(
    { _id: offer._id, status: 'pending' },
    { $set: { status: 'accepted', decidedAt: new Date() } },
    { new: true }
  );
  if (!accepted) {
    await undoRequirement();
    throw ApiError.conflict('This offer was withdrawn or changed. Please refresh.');
  }
  const undoOffer = () => Offer.updateOne({ _id: offer._id }, { $set: { status: 'pending' }, $unset: { decidedAt: 1 } });

  let reserved = [];
  let order;
  try {
    if (accepted.product) reserved = await reserveStock([{ productId: accepted.product, quantity: requirement.quantity }]);
    order = await Order.create({
      orderNumber: newOrderNumber(),
      customer: customer._id,
      vendor: accepted.vendor,
      store: accepted.store,
      source: 'requirement',
      requirement: requirement._id,
      offer: accepted._id,
      items: [
        {
          product: accepted.product,
          name: requirement.title,
          quantity: requirement.quantity,
          unitPrice: round2(accepted.totalPrice / requirement.quantity),
          lineTotal: accepted.totalPrice,
        },
      ],
      totalAmount: accepted.totalPrice,
      shippingAddress,
      paymentMethod,
      statusHistory: [{ status: 'placed', by: customer._id, note: 'Created from accepted requirement offer' }],
    });
  } catch (err) {
    if (reserved.length) await releaseStock(reserved);
    await undoOffer();
    await undoRequirement();
    throw err;
  }

  await Requirement.updateOne({ _id: requirement._id }, { $set: { order: order._id } });
  const others = await Offer.find({ requirement: requirement._id, _id: { $ne: accepted._id }, status: 'pending' }).select('vendor').lean();
  await Offer.updateMany(
    { requirement: requirement._id, _id: { $ne: accepted._id }, status: 'pending' },
    { $set: { status: 'rejected', decidedAt: new Date() } }
  );
  if (accepted.product) await recordPurchases(order, 'requirement');

  await notify(accepted.vendor, {
    type: 'offer',
    title: `Your offer was accepted: "${requirement.title}"`,
    message: `Order ${order.orderNumber} created for ₹${order.totalAmount.toLocaleString('en-IN')}`,
    link: `/vendor/orders/${order._id}`,
  });
  await notify(others.map((o) => o.vendor), {
    type: 'offer',
    title: `Offer not selected: "${requirement.title}"`,
    message: 'The customer selected another offer.',
    link: '/vendor/offers',
  });
  await logActivity(customer, 'offer.selected', { entityType: 'Requirement', entityId: requirement._id, summary: `${requirement.title} → ${order.orderNumber}` });
  return { requirement: await Requirement.findById(requirement._id), offer: accepted, order };
}

async function cancelRequirement(customer, requirementId) {
  const updated = await Requirement.findOneAndUpdate(
    { _id: requirementId, customer: customer._id, status: 'open' },
    { $set: { status: 'cancelled' } },
    { new: true }
  );
  if (!updated) throw ApiError.conflict('Only your own open requirements can be cancelled');
  const pending = await Offer.find({ requirement: updated._id, status: 'pending' }).select('vendor').lean();
  await Offer.updateMany({ requirement: updated._id, status: 'pending' }, { $set: { status: 'rejected', decidedAt: new Date() } });
  await notify(pending.map((o) => o.vendor), {
    type: 'requirement',
    title: `Requirement cancelled: "${updated.title}"`,
    message: 'The customer cancelled this requirement.',
    link: '/vendor/offers',
  });
  await logActivity(customer, 'requirement.cancelled', { entityType: 'Requirement', entityId: updated._id, summary: updated.title });
  return updated;
}

module.exports = { endOfDay, expireRequirements, submitOffer, reviseOffer, withdrawOffer, selectOffer, cancelRequirement };
