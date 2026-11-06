const { ActivityLog } = require('../models');

async function logActivity(actor, action, { entityType, entityId, summary } = {}) {
  try {
    await ActivityLog.create({
      actor: actor?._id,
      actorRole: actor?.role,
      action,
      entityType,
      entityId: entityId ? String(entityId) : undefined,
      summary,
    });
  } catch (err) {
    // Activity logging must never break the business operation.
    console.warn('activity log failed:', err.message);
  }
}

module.exports = { logActivity };
