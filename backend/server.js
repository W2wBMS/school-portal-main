const app = require('./src/app');
const { connectDB } = require('./src/config/db');
const { seedAdmin } = require('./src/utils/seed');
const { seedPortalData } = require('./src/utils/seedData');
const { getJwtSecret } = require('./src/utils/jwtSecret');

const PORT = process.env.PORT || 5000;

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function initializeDatabase() {
  let attempt = 0;
  while (true) {
    try {
      await connectDB();
      await seedAdmin();
      await seedPortalData();
      console.log('Database initialization completed');
      return;
    } catch (error) {
      const retryDelay = Math.min(5000 * (2 ** attempt), 60000);
      attempt += 1;
      console.error(`Database startup is unavailable (${error.name}); retrying in ${Math.round(retryDelay / 1000)} seconds`);
      await delay(retryDelay);
    }
  }
}

async function startServer() {
  getJwtSecret();
  app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
  initializeDatabase();
}

startServer().catch((error) => {
  console.error('Server startup failed:', error);
  process.exit(1);
});
