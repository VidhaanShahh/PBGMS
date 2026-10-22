const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Initialize SQLite database
require('./config/sqliteDb');

const authRoutes = require('./routes/authRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const petRoutes = require('./routes/petRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const reportsRoutes = require('./routes/reportsRoutes');
const careLogRoutes = require('./routes/careLogRoutes');
const frontDeskRoutes = require('./routes/frontDeskRoutes');
const groomingRoutes = require('./routes/groomingRoutes');

const app = express();

// Ensure uploads folder exists and serve statically
const uploadDir = process.env.UPLOADS_DIR || path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));


// Parse allowed origins from CLIENT_URL (supports comma-separated list or array)
const defaultAllowedOrigins = ['http://localhost:5173', 'https://pbgms.netlify.app'];
const configuredOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean)
  : defaultAllowedOrigins;

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server or curl requests with no origin
    if (!origin) return callback(null, true);
    const cleanOrigin = origin.replace(/\/$/, '');
    if (configuredOrigins.includes(cleanOrigin) || defaultAllowedOrigins.includes(cleanOrigin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy does not allow access from origin ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing with safe size limits (10MB for photo uploads via JSON/base64, multer handles multipart)
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check Endpoints (both /health and /api/health for host compatibility)
const healthHandler = (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Pet Boarding & Grooming Management System (PBGMS) API',
    database: 'SQLite (Relational Persistent)',
    currency: 'INR (₹)'
  });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);


// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/pets', petRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/care-logs', careLogRoutes);
app.use('/api/frontdesk', frontDeskRoutes);
app.use('/api/grooming', groomingRoutes);

// 404 Route handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: 'API route not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error occurred.'
  });
});

module.exports = app;
