const express = require('express');
const router = express.Router();
const groomingController = require('../controllers/groomingController');
const { authenticate, requireRole } = require('../middleware/auth');

// All Groomer routes require authentication and GROOMER or ADMIN role
router.use(authenticate);
router.use(requireRole(['GROOMER', 'ADMIN', 'SYSTEM_ADMIN']));

// Groomer Dashboard
router.get('/dashboard', groomingController.getDashboard);

// Grooming Session Details & Checklist
router.get('/sessions/:bookingId', groomingController.getSession);
router.post('/sessions/:bookingId/start', groomingController.startSession);
router.put('/sessions/:bookingId/checklist', groomingController.updateChecklist);
router.post('/sessions/:bookingId/complete', groomingController.completeSession);

module.exports = router;
