const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { authenticateAdmin } = require('../middleware/auth');

// Public booking & confirmation
router.post('/', appointmentController.createAppointment);
router.get('/:id', appointmentController.getAppointmentById);

// Protected Admin Routes
router.get('/', authenticateAdmin, appointmentController.getAppointments);
router.patch('/:id/status', authenticateAdmin, appointmentController.updateAppointmentStatus);

module.exports = router;
