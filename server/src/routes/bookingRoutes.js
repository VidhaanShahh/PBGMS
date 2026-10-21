const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const careLogController = require('../controllers/careLogController');
const { authenticate, requireRoles } = require('../middleware/auth');

// Public availability check
router.get('/rooms', bookingController.getRooms);
router.get('/check-availability', bookingController.checkBoardingAvailability);
router.get('/grooming-slots', bookingController.getGroomingSlots);

// Authenticated booking endpoints
router.use(authenticate);
router.post('/boarding', bookingController.bookBoarding);
router.post('/grooming', bookingController.bookGrooming);
router.get('/my-bookings', bookingController.getBookings);
router.get('/:id', bookingController.getBookingById);
router.get('/:id/care-logs', careLogController.getBookingCareLogs);
router.post('/:id/cancel', bookingController.cancelBooking);

// Staff Workflows
router.post('/:id/check-in', requireRoles('ADMIN', 'FRONT_DESK'), bookingController.processCheckIn);
router.post('/:id/check-out', requireRoles('ADMIN', 'FRONT_DESK'), bookingController.processCheckOut);
router.post('/:id/grooming-status', requireRoles('ADMIN', 'GROOMER', 'FRONT_DESK'), bookingController.updateGroomingStatus);
router.post('/:id/care-activity', requireRoles('ADMIN', 'BOARDING_ATTENDANT', 'FRONT_DESK', 'GROOMER'), bookingController.addCareActivity);

module.exports = router;
