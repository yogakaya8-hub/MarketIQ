const { expireDueDeals } = require('./services/pricingService');
const { expireRequirements } = require('./services/reverseMarketplaceService');
const { analyzeInventory } = require('./services/deadStockService');

// Lightweight in-process scheduler. Deal expiry is also enforced on every price lookup,
// so a missed tick can never leave an expired deal active.
function startJobs() {
  const minute = setInterval(async () => {
    try {
      await expireDueDeals({ force: true });
      await expireRequirements();
    } catch (err) {
      console.warn('job: expiry sweep failed', err.message);
    }
  }, 60 * 1000);

  const sixHours = setInterval(async () => {
    try {
      await analyzeInventory({ notifyChanges: true });
    } catch (err) {
      console.warn('job: inventory analysis failed', err.message);
    }
  }, 6 * 60 * 60 * 1000);

  [minute, sixHours].forEach((t) => t.unref());
}

module.exports = { startJobs };
