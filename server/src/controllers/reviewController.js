const { get, run, all } = require('../config/sqliteDb');

/**
 * GET /api/reviews/service/:serviceId
 * Retrieve verified customer reviews and aggregate rating statistics for a grooming service
 */
exports.getServiceReviews = async (req, res) => {
  try {
    const { serviceId } = req.params;

    const stats = await get(`
      SELECT
        COUNT(*) as total_reviews,
        COALESCE(AVG(rating), 0) as average_rating,
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as star_5,
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as star_4,
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as star_3,
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as star_2,
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as star_1
      FROM grooming_reviews
      WHERE service_id = ? AND review_status = 'APPROVED'
    `, [serviceId]);

    const reviews = await all(`
      SELECT r.id, r.booking_id, r.rating, r.review_text, r.created_at,
             u.name as reviewer_name,
             p.name as pet_name, p.breed as pet_breed, p.species as pet_species
      FROM grooming_reviews r
      JOIN users u ON r.customer_id = u.id
      JOIN pets p ON r.pet_id = p.id
      WHERE r.service_id = ? AND r.review_status = 'APPROVED'
      ORDER BY r.created_at DESC
    `, [serviceId]);

    return res.json({
      success: true,
      service_id: Number(serviceId),
      stats: {
        total_reviews: stats ? stats.total_reviews : 0,
        average_rating: stats ? Math.round(stats.average_rating * 10) / 10 : 0,
        breakdown: {
          5: stats ? stats.star_5 : 0,
          4: stats ? stats.star_4 : 0,
          3: stats ? stats.star_3 : 0,
          2: stats ? stats.star_2 : 0,
          1: stats ? stats.star_1 : 0
        }
      },
      reviews: reviews.map(r => ({
        id: r.id,
        booking_id: r.booking_id,
        rating: r.rating,
        review_text: r.review_text,
        created_at: r.created_at,
        reviewer_name: r.reviewer_name ? `${r.reviewer_name.split(' ')[0]} ${r.reviewer_name.split(' ')[1] ? r.reviewer_name.split(' ')[1][0] + '.' : ''}` : 'Pet Owner',
        pet_name: r.pet_name,
        pet_breed: r.pet_breed
      }))
    });
  } catch (err) {
    console.error('Get service reviews error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve reviews.' });
  }
};

/**
 * GET /api/reviews/eligible-bookings
 * Retrieves the authenticated customer's completed grooming bookings that are eligible for review
 */
exports.getEligibleGroomingBookings = async (req, res) => {
  try {
    const customerId = req.user.id;

    // Must be GROOMING booking, Completed status, owned by user
    const eligible = await all(`
      SELECT b.id, b.booking_number, b.service_id, b.pet_id, b.start_date, b.status,
             s.service_name, p.name as pet_name, p.species as pet_species,
             r.id as existing_review_id, r.rating as existing_rating, r.review_text as existing_review_text
      FROM bookings b
      JOIN services s ON b.service_id = s.id
      JOIN pets p ON b.pet_id = p.id
      LEFT JOIN grooming_reviews r ON r.booking_id = b.id
      WHERE b.owner_id = ?
        AND b.booking_type = 'GROOMING'
        AND b.status = 'Completed'
      ORDER BY b.start_date DESC
    `, [customerId]);

    return res.json({
      success: true,
      bookings: eligible
    });
  } catch (err) {
    console.error('Get eligible bookings error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve eligible bookings.' });
  }
};

/**
 * POST /api/reviews
 * Submits an authentic review and 1-5 star rating for a completed grooming booking
 */
exports.submitReview = async (req, res) => {
  try {
    const { booking_id, rating, review_text } = req.body;
    const customerId = req.user.id;

    if (!booking_id) {
      return res.status(400).json({ success: false, message: 'Booking ID is required.' });
    }

    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be an integer between 1 and 5 stars.' });
    }

    // Sanitize review text if provided
    let cleanText = review_text ? String(review_text).trim().slice(0, 1000) : '';

    // Validate booking exists and is authoritative
    const booking = await get(`
      SELECT * FROM bookings WHERE id = ?
    `, [booking_id]);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking record not found.' });
    }

    // Check ownership
    if (booking.owner_id !== customerId && req.user.role === 'PET_OWNER') {
      return res.status(403).json({ success: false, message: 'Unauthorized: You do not own this booking.' });
    }

    // Check service type is grooming
    if (booking.booking_type !== 'GROOMING') {
      return res.status(400).json({ success: false, message: 'Reviews are only applicable to Grooming services.' });
    }

    // Check session status is Completed
    if (booking.status !== 'Completed') {
      return res.status(400).json({
        success: false,
        message: `This grooming session cannot be reviewed because its current status is '${booking.status}'. Only 'Completed' sessions are eligible.`
      });
    }

    // Check if review already exists
    const existing = await get(`SELECT id FROM grooming_reviews WHERE booking_id = ?`, [booking_id]);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A review has already been submitted for this grooming booking.'
      });
    }

    const result = await run(`
      INSERT INTO grooming_reviews (
        booking_id, customer_id, service_id, pet_id, groomer_id, rating, review_text, review_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'APPROVED')
    `, [booking.id, customerId, booking.service_id, booking.pet_id, booking.staff_id, numRating, cleanText]);

    return res.status(201).json({
      success: true,
      message: 'Thank you! Your grooming review and rating have been recorded.',
      review_id: result.lastID,
      rating: numRating
    });
  } catch (err) {
    console.error('Submit review error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to submit review.' });
  }
};

/**
 * GET /api/reviews/my-reviews
 * Retrieve the authenticated customer's submitted reviews
 */
exports.getMyReviews = async (req, res) => {
  try {
    const customerId = req.user.id;
    const reviews = await all(`
      SELECT r.*, s.service_name, p.name as pet_name, b.booking_number
      FROM grooming_reviews r
      JOIN services s ON r.service_id = s.id
      JOIN pets p ON r.pet_id = p.id
      JOIN bookings b ON r.booking_id = b.id
      WHERE r.customer_id = ?
      ORDER BY r.created_at DESC
    `, [customerId]);

    return res.json({
      success: true,
      reviews
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve your reviews.' });
  }
};
