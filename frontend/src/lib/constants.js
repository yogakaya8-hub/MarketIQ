export const APP_NAME = 'Bazaario';

export const CATEGORIES = [
  'Electronics', 'Fashion', 'Home & Kitchen', 'Books', 'Sports & Fitness',
  'Beauty & Personal Care', 'Groceries', 'Toys & Games', 'Office Supplies', 'Health',
];

export const RISK = {
  healthy: { label: 'Healthy', cls: 'bg-market-light text-market-dark', dot: '#0F766E' },
  slow_moving: { label: 'Slow-moving', cls: 'bg-amber-50 text-amber-800', dot: '#B7791F' },
  at_risk: { label: 'At-risk', cls: 'bg-orange-50 text-orange-800', dot: '#DD6B20' },
  dead_stock: { label: 'Potential dead stock', cls: 'bg-red-50 text-red-800', dot: '#B42318' },
  insufficient_data: { label: 'Insufficient data', cls: 'bg-slate-100 text-slate-700', dot: '#64748B' },
};
export const RISK_ORDER = ['dead_stock', 'at_risk', 'slow_moving', 'healthy', 'insufficient_data'];

export const ORDER_STATUS = {
  placed: { label: 'Placed', cls: 'bg-sky-50 text-sky-800' },
  confirmed: { label: 'Confirmed', cls: 'bg-indigo-50 text-indigo-800' },
  shipped: { label: 'Shipped', cls: 'bg-violet-50 text-violet-800' },
  delivered: { label: 'Delivered', cls: 'bg-market-light text-market-dark' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-600' },
};
export const NEXT_STATUS = { placed: ['confirmed'], confirmed: ['shipped'], shipped: ['delivered'], delivered: [], cancelled: [] };

export const REQUIREMENT_STATUS = {
  open: { label: 'Open', cls: 'bg-market-light text-market-dark' },
  awarded: { label: 'Offer selected', cls: 'bg-indigo-50 text-indigo-800' },
  expired: { label: 'Expired', cls: 'bg-slate-100 text-slate-600' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-600' },
};
export const OFFER_STATUS = {
  pending: { label: 'Awaiting decision', cls: 'bg-sky-50 text-sky-800' },
  accepted: { label: 'Accepted', cls: 'bg-market-light text-market-dark' },
  rejected: { label: 'Not selected', cls: 'bg-slate-100 text-slate-600' },
  withdrawn: { label: 'Withdrawn', cls: 'bg-slate-100 text-slate-600' },
};
export const VENDOR_STATUS = {
  pending: { label: 'Pending review', cls: 'bg-amber-50 text-amber-800' },
  approved: { label: 'Approved', cls: 'bg-market-light text-market-dark' },
  rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-800' },
  suspended: { label: 'Suspended', cls: 'bg-slate-100 text-slate-600' },
};
export const REPORT_STATUS = {
  open: { label: 'Open', cls: 'bg-amber-50 text-amber-800' },
  in_review: { label: 'In review', cls: 'bg-sky-50 text-sky-800' },
  resolved: { label: 'Resolved', cls: 'bg-market-light text-market-dark' },
  dismissed: { label: 'Dismissed', cls: 'bg-slate-100 text-slate-600' },
};

export const REMOVAL_REASONS = [
  'Found a better price elsewhere',
  'Delivery takes too long',
  'Changed my mind',
  'Need more product information',
  'Only saving for later',
  'Other',
];
