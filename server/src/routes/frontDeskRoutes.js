const express = require('express');
const router = express.Router();
const frontDeskController = require('../controllers/frontDeskController');
const { authenticate, requireRole } = require('../middleware/auth');

// All Front Desk routes require authentication and FRONT_DESK or ADMIN role
router.use(authenticate);
router.use(requireRole(['FRONT_DESK', 'ADMIN', 'SYSTEM_ADMIN']));

// Real operational metrics & dashboard
router.get('/stats', frontDeskController.getStats);

// Bookings management
router.get('/bookings', frontDeskController.getBookings);

// Boarding check-in & checkout workflows
router.post('/check-in', frontDeskController.checkIn);
router.post('/check-out', frontDeskController.checkOut);

// Customer & Pet directory
router.get('/customers', frontDeskController.getCustomers);

// Grooming coordination
router.get('/grooming-coordination', frontDeskController.getGroomingCoordination);
router.post('/grooming-handover', frontDeskController.handoverGrooming);

module.exports = router;
