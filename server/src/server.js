const app = require('./app');
const { db } = require('./config/sqliteDb');

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log(`🐾 Pet Care System API Server running on port ${PORT} (${HOST})`);
  console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown handling for container and hosting platforms
function gracefulShutdown(signal) {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  server.close(() => {
    console.log('HTTP server closed.');
    if (db && typeof db.close === 'function') {
      db.close((err) => {
        if (err) {
          console.error('Error closing SQLite database:', err.message);
          process.exit(1);
        }
        console.log('SQLite database connection closed cleanly.');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });

  // Force shutdown after 10 seconds timeout
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

