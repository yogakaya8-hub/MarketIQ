const { Notification } = require('../models');

async function notify(userIds, { type = 'system', title, message, link }) {
  const ids = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean).map(String))];
  if (!ids.length) return;
  try {
    await Notification.insertMany(ids.map((user) => ({ user, type, title, message, link })));
  } catch (err) {
    console.warn('notification failed:', err.message);
  }
}

module.exports = { notify };
