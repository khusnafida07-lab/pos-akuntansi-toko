const express = require('express');
const cors = require('cors');
const path = require('node:path');
const config = require('./config/config');
const apiRoutes = require('./routes/index');
const { errorHandler } = require('./middleware/error.middleware');
const { initializeDatabase } = require('./database/init-db');

const app = express();

// Middleware dasar
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend dashboard
app.use(express.static(path.join(__dirname, '..', 'public')));

// Mount API routes
app.use('/api', apiRoutes);

// Fallback untuk SPA (Single Page Application) - Kompatibel dengan Express 5
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
  next();
});

// Centralized error handler
app.use(errorHandler);

// Inisialisasi Database MySQL dan Jalankan Server
if (require.main === module) {
  (async () => {
    try {
      await initializeDatabase();
      app.listen(config.PORT, () => {
        console.log(`=======================================================`);
        console.log(`🚀 SISTEM POS & AKUNTANSI TOKO BERJALAN`);
        console.log(`🗄️ Database   : MySQL (Laragon - ${config.DB_NAME})`);
        console.log(`🌐 Server URL : http://localhost:${config.PORT}`);
        console.log(`📡 API Base   : http://localhost:${config.PORT}/api`);
        console.log(`=======================================================`);
      });
    } catch (err) {
      console.error('Fatal error starting application:', err);
      process.exit(1);
    }
  })();
}

module.exports = app;
