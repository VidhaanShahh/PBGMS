const { get, run, all } = require('../config/sqliteDb');

/**
 * GET /api/frontdesk/stats
 * Real database-backed operational metrics (Zero mock data or hardcoded numbers)
 */
exports.getStats = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. Today's boarding arrivals (Confirmed boarding starting today)
    const arrivalsRow = await get(`
      SELECT COUNT(*) as count FROM bookings
      WHERE booking_type = 'BOARDING' AND start_date = ? AND status = 'Confirmed'
    `, [today]);

    // 2. Today's boarding departures (Checked-in boarding ending today)
    const departuresRow = await get(`
      SELECT COUNT(*) as count FROM bookings
      WHERE booking_type = 'BOARDING' AND end_date = ? AND status = 'Checked-in'
    `, [today]);

    // 3. Pending bookings
    const pendingRow = await get(`
      SELECT COUNT(*) as count FROM bookings WHERE status = 'Pending'
    `);

    // 4. Confirmed bookings
    const confirmedRow = await get(`
      SELECT COUNT(*) as count FROM bookings WHERE status = 'Confirmed'
    `);

    // 5. Today's grooming appointments
    const groomingTodayRow = await get(`
      SELECT COUNT(*) as count FROM bookings
      WHERE booking_type = 'GROOMING' AND start_date = ? AND status != 'Cancelled'
    `, [today]);

    // 6. Appointments awaiting check-in today
    const awaitingCheckInRow = await get(`
      SELECT COUNT(*) as count FROM bookings
      WHERE start_date = ? AND status = 'Confirmed'
    `, [today]);

    // 7. Pets ready for collection
    const readyCollectionRow = await get(`
      SELECT COUNT(*) as count FROM bookings WHERE status = 'Ready for Collection'
    `);

    // 8. Currently checked in / in service
    const inHouseRow = await get(`
      SELECT COUNT(*) as count FROM bookings WHERE status IN ('Checked-in', 'In Service')
    `);

    // 9. Payment failures requiring attention
    const payFailuresRow = await get(`
      SELECT COUNT(*) as count FROM payments WHERE payment_status = 'Failed'
    `);

    // 10. Outstanding customer balances calculation
    const activeBookings = await all(`
      SELECT b.id, b.total_price, b.late_checkout_fee
      FROM bookings b
      WHERE b.status IN ('Confirmed', 'Checked-in', 'In Service')
    `);

    let totalOutstanding = 0;
    for (const b of activeBookings) {
      const paySum = await get(
        `SELECT SUM(amount) as paid FROM payments WHERE booking_id = ? AND payment_status = 'Paid'`,
        [b.id]
      );
      const paid = paySum && paySum.paid ? paySum.paid : 0;
      const balance = Math.max(0, (b.total_price + (b.late_checkout_fee || 0)) - paid);
      totalOutstanding += balance;
    }

    // 11. Recent bookings
    const recentBookings = await all(`
      SELECT b.id, b.booking_number, b.booking_type, b.status, b.total_price, b.created_at,
             p.name as pet_name, u.name as customer_name
      FROM bookings b
      JOIN pets p ON b.pet_id = p.id
      JOIN users u ON b.owner_id = u.id
      ORDER BY b.id DESC LIMIT 5
    `);

    return res.json({
      success: true,
      data: {
        today_arrivals: arrivalsRow.count,
        today_departures: departuresRow.count,
        pending_bookings: pendingRow.count,
        confirmed_bookings: confirmedRow.count,
        grooming_today: groomingTodayRow.count,
        awaiting_check_in: awaitingCheckInRow.count,
        ready_for_collection: readyCollectionRow.count,
        in_house_guests: inHouseRow.count,
        payment_failures: payFailuresRow.count,
        outstanding_balances: totalOutstanding,
        recent_bookings: recentBookings
      }
    });
  } catch (err) {
    console.error('Front Desk stats error:', err);
    return res.status(500).json({ success: false, message: 'Failed to calculate operational statistics.' });
  }
};

/**
 * GET /api/frontdesk/bookings
 * Search & filter all operational bookings
 */
exports.getBookings = async (req, res) => {
  try {
    const { search, type, status, date } = req.query;

    let sql = `
      SELECT b.*,
             p.name as pet_name, p.species as pet_species, p.breed as pet_breed,
             p.allergies, p.behavioral_notes, p.feeding_instructions, p.medication_instructions,
             u.name as owner_name, u.phone as owner_phone, u.email as owner_email,
             s.service_name, r.room_number, r.room_type,
             g.name as staff_name
      FROM bookings b
      JOIN pets p ON b.pet_id = p.id
      JOIN users u ON b.owner_id = u.id
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN rooms r ON b.room_id = r.id
      LEFT JOIN users g ON b.staff_id = g.id
      WHERE 1=1
    `;
    const params = [];

    if (type) {
      sql += ` AND b.booking_type = ?`;
      params.push(type.toUpperCase());
    }

    if (status) {
      sql += ` AND b.status = ?`;
      params.push(status);
    }

    if (date) {
      sql += ` AND (b.start_date = ? OR b.end_date = ?)`;
      params.push(date, date);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      sql += ` AND (b.booking_number LIKE ? OR p.name LIKE ? OR u.name LIKE ? OR u.phone LIKE ?)`;
      params.push(term, term, term, term);
    }

    sql += ` ORDER BY b.id DESC LIMIT 100`;

    const bookings = await all(sql, params);

    for (const b of bookings) {
      const pays = await all(`SELECT * FROM payments WHERE booking_id = ?`, [b.id]);
      b.payments = pays;
      b.paid_amount = pays.filter(p => p.payment_status === 'Paid').reduce((sum, p) => sum + p.amount, 0);
      b.remaining_balance = Math.max(0, (b.total_price + (b.late_checkout_fee || 0)) - b.paid_amount);
    }

    return res.json({ success: true, count: bookings.length, data: bookings });
  } catch (err) {
    console.error('Front Desk bookings fetch error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load bookings.' });
  }
};

/**
 * POST /api/frontdesk/check-in
 * Complete Boarding Check-in Workflow
 */
exports.checkIn = async (req, res) => {
  try {
    const { booking_id, room_id, arrival_observations, belongings, feeding_notes, medication_notes } = req.body;

    if (!booking_id) {
      return res.status(400).json({ success: false, message: 'Booking ID is required.' });
    }

    const booking = await get(`SELECT * FROM bookings WHERE id = ?`, [booking_id]);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    if (booking.status !== 'Confirmed') {
      return res.status(400).json({
        success: false,
        message: `Only Confirmed bookings can be checked in. Current status is '${booking.status}'.`
      });
    }

    // Verify mandatory vaccination on arrival (BR-1)
    const today = new Date().toISOString().split('T')[0];
    const vaccine = await get(`
      SELECT id FROM vaccinations WHERE pet_id = ? AND expiration_date >= ?
    `, [booking.pet_id, today]);

    if (!vaccine) {
      return res.status(400).json({
        success: false,
        message: 'Vaccination Verification Failed: Pet does not have an active core vaccination on file. Check-in blocked.'
      });
    }

    const assignedRoomId = room_id || booking.room_id;
    if (booking.booking_type === 'BOARDING' && !assignedRoomId) {
      return res.status(400).json({ success: false, message: 'Room assignment is required for boarding check-in.' });
    }

    // Update room status
    if (assignedRoomId) {
      await run(`UPDATE rooms SET status = 'MAINTENANCE' WHERE id = ?`, [assignedRoomId]);
    }

    // Update booking
    await run(`
      UPDATE bookings SET
        status = 'Checked-in',
        room_id = ?,
        actual_check_in = CURRENT_TIMESTAMP,
        checked_in_by = ?,
        checkin_notes = ?,
        belongings = ?
      WHERE id = ?
    `, [
      assignedRoomId || null,
      req.user.id,
      arrival_observations || null,
      belongings || null,
      booking.id
    ]);

    // Record initial check-in care log
    const initialCareNotes = `Checked in by Front Desk (${req.user.name || 'Staff'}). ${arrival_observations ? `Observations: ${arrival_observations}.` : 'Pet in good spirits.'} ${belongings ? `Belongings: ${belongings}.` : ''}`.trim();
    await run(`
      INSERT INTO care_activities (pet_id, booking_id, attendant_id, activity_type, notes, is_owner_visible)
      VALUES (?, ?, ?, 'Check-in Observation', ?, 1)
    `, [booking.pet_id, booking.id, req.user.id, initialCareNotes]);

    return res.json({
      success: true,
      message: `Pet successfully checked in for Booking #${booking.booking_number}. Room #${assignedRoomId || 'N/A'} occupied.`
    });
  } catch (err) {
    console.error('Check-in error:', err);
    return res.status(500).json({ success: false, message: 'Check-in processing failed.' });
  }
};

/**
 * POST /api/frontdesk/check-out
 * Complete Boarding Check-out & Settlement Workflow
 */
exports.checkOut = async (req, res) => {
  try {
    const { booking_id, payment_method = 'Cash', late_fee = 0, handover_notes } = req.body;

    if (!booking_id) {
      return res.status(400).json({ success: false, message: 'Booking ID is required.' });
    }

    const booking = await get(`SELECT * FROM bookings WHERE id = ?`, [booking_id]);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    if (booking.status !== 'Checked-in') {
      return res.status(400).json({
        success: false,
        message: `Only 'Checked-in' guests can be checked out. Current status: '${booking.status}'.`
      });
    }

    // Calculate settlement
    const payments = await all(`SELECT * FROM payments WHERE booking_id = ? AND payment_status = 'Paid'`, [booking.id]);
    const paidSoFar = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalDue = booking.total_price + Number(late_fee || 0);
    const balance = Math.max(0, totalDue - paidSoFar);

    if (balance > 0) {
      const settleTxn = `SETTLE-FD-${Math.floor(100000 + Math.random() * 900000)}`;
      await run(`
        INSERT INTO payments (
          booking_id, amount, payment_method, payment_type, payment_status, transaction_reference
        ) VALUES (?, ?, ?, 'Remaining Balance', 'Paid', ?)
      `, [booking.id, balance, payment_method, settleTxn]);
    }

    // Update booking
    await run(`
      UPDATE bookings SET
        status = 'Completed',
        late_checkout_fee = ?,
        actual_check_out = CURRENT_TIMESTAMP,
        checked_out_by = ?,
        handover_notes = ?
      WHERE id = ?
    `, [Number(late_fee || 0), req.user.id, handover_notes || null, booking.id]);

    // Release room back to AVAILABLE
    if (booking.room_id) {
      await run(`UPDATE rooms SET status = 'AVAILABLE' WHERE id = ?`, [booking.room_id]);
    }

    // Record checkout care log
    const checkoutNotes = `Check-out completed by Front Desk. Guest handed over to customer. ${handover_notes ? `Handover note: ${handover_notes}.` : ''} All balances settled.`.trim();
    await run(`
      INSERT INTO care_activities (pet_id, booking_id, attendant_id, activity_type, notes, is_owner_visible)
      VALUES (?, ?, ?, 'Check-out Handover', ?, 1)
    `, [booking.pet_id, booking.id, req.user.id, checkoutNotes]);

    return res.json({
      success: true,
      message: `Checkout and settlement completed for Booking #${booking.booking_number}. Room released.`,
      settled_amount: balance
    });
  } catch (err) {
    console.error('Check-out error:', err);
    return res.status(500).json({ success: false, message: 'Check-out processing failed.' });
  }
};

/**
 * GET /api/frontdesk/customers
 * Customer Directory with registered pets and booking counts
 */
exports.getCustomers = async (req, res) => {
  try {
    const { search } = req.query;
    let sql = `
      SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at,
             COUNT(DISTINCT p.id) as pet_count,
             COUNT(DISTINCT b.id) as booking_count
      FROM users u
      LEFT JOIN pets p ON u.id = p.owner_id
      LEFT JOIN bookings b ON u.id = b.owner_id
      WHERE u.role = 'PET_OWNER'
    `;
    const params = [];

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      sql += ` AND (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)`;
      params.push(term, term, term);
    }

    sql += ` GROUP BY u.id ORDER BY u.id DESC`;

    const customers = await all(sql, params);

    for (const c of customers) {
      c.pets = await all(`SELECT id, name, species, breed, dob, weight, allergies FROM pets WHERE owner_id = ?`, [c.id]);
    }

    return res.json({ success: true, count: customers.length, data: customers });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve customer directory.' });
  }
};

/**
 * GET /api/frontdesk/grooming-coordination
 * Grooming Appointment queue and collection status
 */
exports.getGroomingCoordination = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const groomingBookings = await all(`
      SELECT b.*,
             p.name as pet_name, p.species as pet_species, p.breed as pet_breed, p.allergies,
             u.name as owner_name, u.phone as owner_phone,
             s.service_name,
             g.name as groomer_name,
             gs.session_status, gs.started_at, gs.completed_at, gs.handover_notes, gs.safety_alerts
      FROM bookings b
      JOIN pets p ON b.pet_id = p.id
      JOIN users u ON b.owner_id = u.id
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN users g ON b.staff_id = g.id
      LEFT JOIN grooming_sessions gs ON b.id = gs.booking_id
      WHERE b.booking_type = 'GROOMING' AND b.status != 'Cancelled'
      ORDER BY b.start_date DESC, b.start_time ASC
      LIMIT 100
    `);

    return res.json({ success: true, data: groomingBookings });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to load grooming coordination.' });
  }
};

/**
 * POST /api/frontdesk/grooming-handover
 * Mark pet as Collected by Owner
 */
exports.handoverGrooming = async (req, res) => {
  try {
    const { booking_id } = req.body;
    if (!booking_id) return res.status(400).json({ success: false, message: 'Booking ID is required.' });

    const booking = await get(`SELECT * FROM bookings WHERE id = ?`, [booking_id]);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    await run(`UPDATE bookings SET status = 'Completed' WHERE id = ?`, [booking_id]);
    await run(`UPDATE grooming_sessions SET session_status = 'Collected', updated_at = CURRENT_TIMESTAMP WHERE booking_id = ?`, [booking_id]);

    return res.json({ success: true, message: `Pet handover completed for Booking #${booking.booking_number}. Marked Collected.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Handover failed.' });
  }
};
