const env = require('./config/env');
const { connectDB } = require('./config/db');
const app = require('./app');
const { startJobs } = require('./jobs');
const { analyzeInventory } = require('./services/deadStockService');

(async () => {
  try {
    await connectDB();
    console.log('MongoDB connected');
    app.listen(env.port, () => console.log(`API listening on http://localhost:${env.port}/api`));
    startJobs();
    // Refresh inventory insights once at startup (alerts for newly at-risk products).
    analyzeInventory().catch((err) => console.warn('initial inventory analysis failed', err.message));
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
})();
