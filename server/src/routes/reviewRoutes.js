const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { authenticate } = require('../middleware/auth');

// Public route: View aggregate ratings and verified reviews for a grooming service
router.get('/service/:serviceId', reviewController.getServiceReviews);

// Authenticated routes: Pet owner reviews
router.get('/eligible-bookings', authenticate, reviewController.getEligibleGroomingBookings);
router.post('/', authenticate, reviewController.submitReview);
router.get('/my-reviews', authenticate, reviewController.getMyReviews);

module.exports = router;
