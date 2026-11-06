const DAY_MS = 24 * 60 * 60 * 1000;

const daysBetween = (from, to = new Date()) => Math.floor((to.getTime() - new Date(from).getTime()) / DAY_MS);
const daysAgo = (n, from = new Date()) => new Date(from.getTime() - n * DAY_MS);
const addDays = (date, n) => new Date(new Date(date).getTime() + n * DAY_MS);

module.exports = { DAY_MS, daysBetween, daysAgo, addDays };
