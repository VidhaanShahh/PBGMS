const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const { authenticate, requireRoles } = require('../middleware/auth');

router.use(authenticate);

// Operational notifications
router.get('/notifications', reportsController.getNotifications);

// Operational metrics for all staff roles (Front Desk, Groomer, Attendant, Admin, System Admin)
router.get('/stats', requireRoles('ADMIN', 'FRONT_DESK', 'GROOMER', 'BOARDING_ATTENDANT'), reportsController.getDashboardStats);

// Boarding occupancy report
router.get('/occupancy', requireRoles('ADMIN', 'FRONT_DESK', 'BOARDING_ATTENDANT'), reportsController.getOccupancyReport);

// Financial revenue report (Admin only)
router.get('/revenue', requireRoles('ADMIN'), reportsController.getRevenueReport);

// CSV Export endpoints (Admin & Front Desk)
router.get('/export/revenue-csv', requireRoles('ADMIN'), reportsController.exportRevenueCSV);
router.get('/export/bookings-csv', requireRoles('ADMIN', 'FRONT_DESK'), reportsController.exportBookingsCSV);

// System Configuration endpoints (System Admin & Admin)
router.get('/config', requireRoles('SYSTEM_ADMIN', 'ADMIN'), reportsController.getConfig);
router.put('/config', requireRoles('SYSTEM_ADMIN', 'ADMIN'), reportsController.updateConfig);

module.exports = router;
