const { get, run, all } = require('../config/sqliteDb');
const notificationService = require('../services/notificationService');

// Helper to generate unique human-readable booking numbers like BRD-2026-8921 or GRM-2026-3419
function generateBookingNumber(type) {
  const prefix = type === 'BOARDING' ? 'BRD' : 'GRM';
  const random = Math.floor(1000 + Math.random() * 9000);
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${random}`;
}

// Helper: check vaccination eligibility (BR-1: Mandatory for boarding)
async function verifyPetVaccination(petId) {
  const now = new Date().toISOString().split('T')[0];
  const validVaccine = await get(
    `SELECT id FROM vaccinations WHERE pet_id = ? AND expiration_date >= ?`,
    [petId, now]
  );
  return !!validVaccine;
}

// GET /api/bookings/rooms - Get all rooms with current availability status
exports.getRooms = async (req, res) => {
  try {
    const rooms = await all(`SELECT * FROM rooms ORDER BY room_type, room_number`);
    return res.json({ success: true, data: rooms });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve rooms.' });
  }
};

// GET /api/bookings/check-availability - Boarding Room Availability
exports.checkBoardingAvailability = async (req, res) => {
  try {
    const { room_type, start_date, end_date } = req.query;
    if (!start_date || !end_date) {
      return res.status(400).json({ success: false, message: 'Check-in and Check-out dates are required.' });
    }

    if (new Date(end_date) <= new Date(start_date)) {
      return res.status(400).json({ success: false, message: 'Check-out date must be after check-in date.' });
    }

    // Query available rooms of given type (or all) not overlapping active reservations
    let sql = `
      SELECT r.* FROM rooms r
      WHERE r.status = 'AVAILABLE'
      ${room_type ? `AND r.room_type = ?` : ''}
      AND r.id NOT IN (
        SELECT b.room_id FROM bookings b
        WHERE b.booking_type = 'BOARDING'
        AND b.room_id IS NOT NULL
        AND b.status IN ('Confirmed', 'Checked-in', 'Pending')
        AND NOT (b.end_date <= ? OR b.start_date >= ?)
      )
    `;

    const params = room_type ? [room_type, start_date, end_date] : [start_date, end_date];
    const availableRooms = await all(sql, params);

    return res.json({
      success: true,
      data: availableRooms,
      available_count: availableRooms.length
    });
  } catch (err) {
    console.error('Availability check error:', err);
    return res.status(500).json({ success: false, message: 'Error checking room availability.' });
  }
};

/**
 * POST /api/bookings/boarding - Book Boarding Stay
 * Follows SRS Boarding Sequence Diagram:
 * 1: bookBoarding(petId, dates, roomType)
 * 2: checkVaccinationStatus() -> 3: vaccinationOK
 * 4: checkAvailability(dates, roomType) -> 5: availableRooms
 * 6: calculatePrice() -> 7: bookingSummary(price)
 * 8: confirmBooking()
 * 9: processPayment(amount) -> 10: authorize(amount)
 * alt [payment authorized]:
 *   11: authorizationSuccess -> 12: paymentSuccess -> 13: reserveRoom -> 14: createNotification -> 16: bookingConfirmed
 * alt [payment declined]:
 *   17: authorizationFailed -> 18: paymentFailure -> 19: paymentError (no booking confirmed)
 */
exports.bookBoarding = async (req, res) => {
  try {
    const {
      pet_id,
      room_id,
      start_date,
      end_date,
      special_instructions,
      addons = [], // e.g. [{ name: 'Extra Playtime', price: 300 }]
      payment_method = 'UPI',
      payment_declined = false,
      card_number = ''
    } = req.body;

    if (!pet_id || !room_id || !start_date || !end_date) {
      return res.status(400).json({ success: false, message: 'Pet, room, and stay dates are required.' });
    }

    // Verify pet existence and owner data isolation
    const pet = await get(`SELECT * FROM pets WHERE id = ?`, [pet_id]);
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found.' });
    }
    if (req.user.role === 'PET_OWNER' && pet.owner_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Pet does not belong to the authenticated owner.' });
    }

    const checkIn = new Date(start_date);
    const checkOut = new Date(end_date);
    if (checkOut <= checkIn) {
      return res.status(400).json({ success: false, message: 'Check-out date must be strictly after check-in date.' });
    }

    // BR-2: No booking more than 12 months in advance
    const maxFuture = new Date();
    maxFuture.setFullYear(maxFuture.getFullYear() + 1);
    if (checkIn > maxFuture) {
      return res.status(400).json({ success: false, message: 'BR-2 Violation: Cannot book boarding more than 12 months into the future.' });
    }

    // BR-1: Vaccination verification
    const isVaccinated = await verifyPetVaccination(pet_id);
    if (!isVaccinated) {
      return res.status(400).json({
        success: false,
        message: 'BR-1 Violation: Pet does not have current active core vaccinations on file. Boarding booking is not permitted.'
      });
    }

    // Fetch room details
    const room = await get(`SELECT * FROM rooms WHERE id = ?`, [room_id]);
    if (!room || room.status !== 'AVAILABLE') {
      return res.status(400).json({ success: false, message: 'Selected room is currently under maintenance or invalid.' });
    }

    // Check concurrency / overlapping double-booking prevention
    const overlapping = await get(`
      SELECT id FROM bookings
      WHERE room_id = ?
      AND status IN ('Confirmed', 'Checked-in', 'Pending')
      AND NOT (end_date <= ? OR start_date >= ?)
    `, [room_id, start_date, end_date]);

    if (overlapping) {
      return res.status(409).json({
        success: false,
        message: 'Room is already reserved for the selected date range. Please choose another room or date.'
      });
    }

    // Calculation: Nights * Daily rate + Addons
    const nights = Math.max(1, Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
    const baseTotal = nights * room.daily_rate;
    const addonsTotal = addons.reduce((sum, item) => sum + Number(item.price || 0), 0);
    const grandTotal = baseTotal + addonsTotal;

    // SRS BR-6: Configurable deposit (20%)
    const depositPctRow = await get(`SELECT value FROM business_config WHERE key = 'deposit_percentage'`);
    const depositPct = depositPctRow ? Number(depositPctRow.value) : 20;
    const depositAmount = (grandTotal * depositPct) / 100;

    // Sequence Diagram Step 9-11: Payment Authorization
    const isDeclined = payment_declined || (card_number && card_number.endsWith('0002'));
    if (isDeclined) {
      // Sequence Diagram Steps 17-19: Payment Declined
      await notificationService.sendNotification({
        userId: req.user.id,
        channel: req.user.notification_pref || 'both',
        type: 'PaymentError',
        title: 'Payment Authorization Declined',
        message: `Your payment of ₹${depositAmount.toFixed(2)} for boarding reservation could not be authorized. Room was not reserved.`
      });

      return res.status(402).json({
        success: false,
        payment_error: 'Payment authorization declined by gateway. Insufficient funds or invalid payment token.',
        message: 'Payment declined. Your room reservation was not confirmed.'
      });
    }

    // Sequence Diagram Steps 12-16: Payment Success & Confirmation
    const bookingNumber = generateBookingNumber('BOARDING');

    const bookingResult = await run(`
      INSERT INTO bookings (
        booking_number, booking_type, owner_id, pet_id, room_id,
        start_date, end_date, special_instructions, status,
        total_price, deposit_amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      bookingNumber, 'BOARDING', req.user.id, pet_id, room_id,
      start_date, end_date, special_instructions || '', 'Confirmed',
      grandTotal, depositAmount
    ]);

    const bookingId = bookingResult.lastID;

    // Save addons
    for (const add of addons) {
      await run(`INSERT INTO booking_addons (booking_id, addon_name, price) VALUES (?, ?, ?)`, [bookingId, add.name, add.price]);
    }

    // Record deposit payment in INR
    const txnRef = `PAY-IN-${Math.floor(100000 + Math.random() * 900000)}`;
    await run(`
      INSERT INTO payments (booking_id, amount, payment_method, payment_type, payment_status, transaction_reference)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [bookingId, depositAmount, payment_method, 'Deposit', 'Paid', txnRef]);

    // Send notification via NotificationService
    const notifyRes = await notificationService.sendNotification({
      userId: req.user.id,
      channel: req.user.notification_pref || 'both',
      type: 'Confirmation',
      title: 'Boarding Booking Confirmed',
      message: `Booking #${bookingNumber} confirmed for ${nights} nights at PBGMS. Deposit of ₹${depositAmount.toFixed(2)} received.`
    });

    return res.status(201).json({
      success: true,
      message: 'Boarding stay reserved successfully!',
      data: {
        booking_id: bookingId,
        booking_number: bookingNumber,
        nights,
        total_price: grandTotal,
        deposit_paid: depositAmount,
        remaining_balance: grandTotal - depositAmount,
        notification: notifyRes
      }
    });
  } catch (err) {
    console.error('Boarding booking error:', err);
    return res.status(500).json({ success: false, message: 'Failed to process boarding reservation.' });
  }
};

// GET /api/bookings/grooming-slots - Dynamic groomer slot availability
exports.getGroomingSlots = async (req, res) => {
  try {
    const { date, service_id } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required to view grooming slots.' });
    }

    // Standard business slots (9 AM to 6 PM)
    const baseSlots = ['09:00 AM', '10:30 AM', '12:00 PM', '02:00 PM', '03:30 PM', '05:00 PM'];
    
    // Find already booked slots on that date
    const booked = await all(`
      SELECT start_time FROM bookings
      WHERE booking_type = 'GROOMING'
      AND start_date = ?
      AND status IN ('Confirmed', 'Scheduled', 'In Service')
    `, [date]);

    const bookedTimes = new Set(booked.map(b => b.start_time));
    const availableSlots = baseSlots.filter(s => !bookedTimes.has(s));

    // Get available groomers
    const groomers = await all(`SELECT id, name FROM users WHERE role = 'GROOMER'`);

    return res.json({
      success: true,
      date,
      available_slots: availableSlots,
      groomers
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to calculate grooming time slots.' });
  }
};

// POST /api/bookings/grooming - Book Grooming Appointment
exports.bookGrooming = async (req, res) => {
  try {
    const {
      pet_id,
      service_id,
      staff_id, // preferred groomer
      start_date,
      start_time,
      special_instructions,
      payment_method = 'UPI',
      payment_declined = false,
      card_number = ''
    } = req.body;

    if (!pet_id || !service_id || !start_date || !start_time) {
      return res.status(400).json({ success: false, message: 'Pet, service, date, and time slot are required.' });
    }

    // Verify pet existence and owner data isolation
    const pet = await get(`SELECT * FROM pets WHERE id = ?`, [pet_id]);
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found.' });
    }
    if (req.user.role === 'PET_OWNER' && pet.owner_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Pet does not belong to the authenticated owner.' });
    }

    const service = await get(`SELECT * FROM services WHERE id = ?`, [service_id]);
    if (!service) return res.status(404).json({ success: false, message: 'Grooming service not found.' });

    // Concurrency check: Ensure slot is not booked for this groomer or general capacity
    let conflictQuery = `
      SELECT id FROM bookings
      WHERE booking_type = 'GROOMING'
      AND start_date = ?
      AND start_time = ?
      AND status IN ('Confirmed', 'Scheduled', 'In Service')
    `;
    let conflictParams = [start_date, start_time];
    if (staff_id) {
      conflictQuery += ` AND staff_id = ?`;
      conflictParams.push(staff_id);
    }

    const conflict = await get(conflictQuery, conflictParams);
    if (conflict) {
      return res.status(409).json({ success: false, message: 'This grooming slot has just been reserved. Please pick another available time.' });
    }

    const grandTotal = service.price;

    // Check payment authorization
    const isDeclined = payment_declined || (card_number && card_number.endsWith('0002'));
    if (isDeclined) {
      await notificationService.sendNotification({
        userId: req.user.id,
        channel: req.user.notification_pref || 'both',
        type: 'PaymentError',
        title: 'Grooming Payment Declined',
        message: `Your payment of ₹${grandTotal.toFixed(2)} for ${service.service_name} was declined. Appointment was not booked.`
      });

      return res.status(402).json({
        success: false,
        payment_error: 'Payment authorization declined by gateway.',
        message: 'Payment declined. Your grooming appointment was not booked.'
      });
    }

    const bookingNumber = generateBookingNumber('GROOMING');
    const txnRef = `PAY-IN-${Math.floor(100000 + Math.random() * 900000)}`;

    const bookingResult = await run(`
      INSERT INTO bookings (
        booking_number, booking_type, owner_id, pet_id, service_id, staff_id,
        start_date, start_time, special_instructions, status,
        total_price, deposit_amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      bookingNumber, 'GROOMING', req.user.id, pet_id, service_id, staff_id || null,
      start_date, start_time, special_instructions || '', 'Confirmed',
      grandTotal, grandTotal
    ]);

    const bookingId = bookingResult.lastID;

    await run(`
      INSERT INTO payments (booking_id, amount, payment_method, payment_type, payment_status, transaction_reference)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [bookingId, grandTotal, payment_method, 'Full Payment', 'Paid', txnRef]);

    const notifyRes = await notificationService.sendNotification({
      userId: req.user.id,
      channel: req.user.notification_pref || 'both',
      type: 'Confirmation',
      title: 'Grooming Appointment Confirmed',
      message: `Appointment #${bookingNumber} for ${service.service_name} on ${start_date} at ${start_time} confirmed. Payment of ₹${grandTotal.toFixed(2)} received.`
    });

    return res.status(201).json({
      success: true,
      message: 'Grooming appointment booked successfully!',
      data: {
        booking_id: bookingId,
        booking_number: bookingNumber,
        total_price: grandTotal,
        notification: notifyRes
      }
    });
  } catch (err) {
    console.error('Grooming booking error:', err);
    return res.status(500).json({ success: false, message: 'Failed to schedule grooming appointment.' });
  }
};

// GET /api/bookings/my-bookings - Consolidated bookings list for owner or all for staff
exports.getBookings = async (req, res) => {
  try {
    let sql = `
      SELECT b.*,
             p.name as pet_name, p.species as pet_species, p.breed as pet_breed,
             p.allergies, p.behavioral_notes,
             u.name as owner_name, u.phone as owner_phone, u.email as owner_email,
             s.service_name, r.room_number, r.room_type,
             g.name as groomer_name
      FROM bookings b
      JOIN pets p ON b.pet_id = p.id
      JOIN users u ON b.owner_id = u.id
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN rooms r ON b.room_id = r.id
      LEFT JOIN users g ON b.staff_id = g.id
    `;
    const params = [];

    if (req.user.role === 'PET_OWNER') {
      sql += ` WHERE b.owner_id = ?`;
      params.push(req.user.id);
    } else if (req.query.type) {
      sql += ` WHERE b.booking_type = ?`;
      params.push(req.query.type.toUpperCase());
    }

    sql += ` ORDER BY b.id DESC`;

    const bookings = await all(sql, params);

    for (const b of bookings) {
      b.payments = await all(`SELECT * FROM payments WHERE booking_id = ?`, [b.id]);
      b.paid_amount = b.payments.reduce((acc, curr) => curr.payment_status === 'Paid' ? acc + curr.amount : acc, 0);
      b.remaining_balance = Math.max(0, b.total_price + (b.late_checkout_fee || 0) - b.paid_amount);
      b.addons = await all(`SELECT * FROM booking_addons WHERE booking_id = ?`, [b.id]);
    }

    return res.json({ success: true, data: bookings });
  } catch (err) {
    console.error('Fetch bookings error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve bookings.' });
  }
};

// GET /api/bookings/:id - Booking Details
exports.getBookingById = async (req, res) => {
  try {
    const booking = await get(`
      SELECT b.*,
             p.name as pet_name, p.species as pet_species, p.breed as pet_breed,
             p.allergies, p.behavioral_notes, p.feeding_instructions, p.medication_instructions,
             u.name as owner_name, u.phone as owner_phone, u.email as owner_email,
             s.service_name, r.room_number, r.room_type, r.daily_rate,
             g.name as groomer_name
      FROM bookings b
      JOIN pets p ON b.pet_id = p.id
      JOIN users u ON b.owner_id = u.id
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN rooms r ON b.room_id = r.id
      LEFT JOIN users g ON b.staff_id = g.id
      WHERE b.id = ?
    `, [req.params.id]);

    if (!booking) return res.status(404).json({ success: false, message: 'Booking record not found.' });

    if (req.user.role === 'PET_OWNER' && booking.owner_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized to view this booking.' });
    }

    booking.payments = await all(`SELECT * FROM payments WHERE booking_id = ?`, [booking.id]);
    booking.addons = await all(`SELECT * FROM booking_addons WHERE booking_id = ?`, [booking.id]);
    booking.care_logs = await all(`
      SELECT ca.*, u.name as attendant_name
      FROM care_activities ca
      JOIN users u ON ca.attendant_id = u.id
      WHERE ca.booking_id = ?
      ORDER BY ca.logged_at DESC
    `, [booking.id]);

    booking.paid_amount = booking.payments.reduce((acc, curr) => curr.payment_status === 'Paid' ? acc + curr.amount : acc, 0);
    booking.remaining_balance = Math.max(0, booking.total_price + (booking.late_checkout_fee || 0) - booking.paid_amount);

    return res.json({ success: true, data: booking });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to load booking details.' });
  }
};

// POST /api/bookings/:id/cancel - Cancellation with BR-4 policy
exports.cancelBooking = async (req, res) => {
  try {
    const booking = await get(`SELECT * FROM bookings WHERE id = ?`, [req.params.id]);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    if (req.user.role === 'PET_OWNER' && booking.owner_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    if (['Checked-in', 'In Service', 'Completed', 'Cancelled'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: `Cannot cancel a booking currently in state '${booking.status}'.` });
    }

    // BR-4: 48-hour cancellation policy
    const startTime = new Date(`${booking.start_date} ${booking.start_time || '09:00:00'}`);
    const now = new Date();
    const hoursNotice = (startTime - now) / (1000 * 60 * 60);

    let refundAmount = 0;
    let cancellationFee = 0;
    const payments = await all(`SELECT * FROM payments WHERE booking_id = ? AND payment_status = 'Paid'`, [booking.id]);
    const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);

    if (hoursNotice >= 48) {
      refundAmount = totalPaid;
    } else {
      // Fee = 1 night daily rate (boarding) or full grooming price
      if (booking.booking_type === 'BOARDING') {
        const room = await get(`SELECT daily_rate FROM rooms WHERE id = ?`, [booking.room_id]);
        cancellationFee = room ? room.daily_rate : 1200;
      } else {
        cancellationFee = booking.total_price;
      }
      refundAmount = Math.max(0, totalPaid - cancellationFee);
    }

    await run(`UPDATE bookings SET status = 'Cancelled' WHERE id = ?`, [booking.id]);

    // Record refund if applicable
    if (refundAmount > 0) {
      await run(`
        INSERT INTO payments (booking_id, amount, payment_method, payment_type, payment_status, transaction_reference)
        VALUES (?, ?, 'Refund', 'Full Refund', 'Refunded', ?)
      `, [booking.id, refundAmount, `REF-IN-${Math.floor(100000 + Math.random() * 900000)}`]);
    }

    // Send cancellation notification
    await notificationService.sendNotification({
      userId: booking.owner_id,
      channel: 'both',
      type: 'Cancellation',
      title: 'Booking Cancelled',
      message: `Booking #${booking.booking_number} was cancelled. Cancellation fee: ₹${cancellationFee.toFixed(2)}, Refund processed: ₹${refundAmount.toFixed(2)}.`
    });

    return res.json({
      success: true,
      message: `Booking #${booking.booking_number} cancelled successfully.`,
      cancellation_fee: cancellationFee,
      refund_issued: refundAmount
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Cancellation failed.' });
  }
};

// Staff Check-in (Front Desk / Admin)
exports.processCheckIn = async (req, res) => {
  try {
    const { id } = req.params;
    const { room_id } = req.body;
    const booking = await get(`SELECT * FROM bookings WHERE id = ?`, [id]);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    if (booking.status !== 'Confirmed') {
      return res.status(400).json({ success: false, message: `Only 'Confirmed' bookings can be checked in. Current status: ${booking.status}` });
    }

    await run(`
      UPDATE bookings SET
        status = 'Checked-in',
        actual_check_in = CURRENT_TIMESTAMP,
        checked_in_by = ?,
        room_id = COALESCE(?, room_id)
      WHERE id = ?
    `, [req.user.id, room_id || null, id]);

    return res.json({ success: true, message: `Check-in completed successfully for Booking #${booking.booking_number}.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to process check-in.' });
  }
};

// Staff Check-out & Settlement (Front Desk / Admin)
exports.processCheckOut = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_method = 'Cash', late_fee = 0 } = req.body;
    const booking = await get(`SELECT * FROM bookings WHERE id = ?`, [id]);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    const payments = await all(`SELECT * FROM payments WHERE booking_id = ? AND payment_status = 'Paid'`, [id]);
    const paidSoFar = payments.reduce((acc, p) => acc + p.amount, 0);
    const totalDue = booking.total_price + Number(late_fee);
    const balance = Math.max(0, totalDue - paidSoFar);

    if (balance > 0) {
      const txnRef = `SETTLE-${Math.floor(100000 + Math.random() * 900000)}`;
      await run(`
        INSERT INTO payments (booking_id, amount, payment_method, payment_type, payment_status, transaction_reference)
        VALUES (?, ?, ?, 'Remaining Balance', 'Paid', ?)
      `, [id, balance, payment_method, txnRef]);
    }

    await run(`
      UPDATE bookings SET
        status = 'Completed',
        late_checkout_fee = ?,
        actual_check_out = CURRENT_TIMESTAMP,
        checked_out_by = ?
      WHERE id = ?
    `, [Number(late_fee), req.user.id, id]);

    return res.json({
      success: true,
      message: `Checkout & settlement completed for Booking #${booking.booking_number}.`,
      settled_amount: balance
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to process check-out.' });
  }
};

// Groomer Start & Complete
exports.updateGroomingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, service_notes } = req.body; // 'In Service' or 'Completed'
    if (!['In Service', 'Completed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Valid groomer statuses are In Service or Completed.' });
    }

    await run(`
      UPDATE bookings SET
        status = ?,
        service_notes = COALESCE(?, service_notes)
      WHERE id = ?
    `, [status, service_notes || null, id]);

    return res.json({ success: true, message: `Grooming appointment marked as '${status}'.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update grooming status.' });
  }
};

// Attendant Daily Care Activity Log
exports.addCareActivity = async (req, res) => {
  try {
    const { id } = req.params; // booking_id
    const { activity_type, notes, is_owner_visible } = req.body;
    if (!activity_type || !notes || !notes.trim()) {
      return res.status(400).json({ success: false, message: 'Activity type and care notes are required.' });
    }

    const booking = await get(`SELECT id, pet_id, owner_id FROM bookings WHERE id = ?`, [id]);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const visibleFlag = is_owner_visible !== undefined ? (is_owner_visible ? 1 : 0) : 1;

    const result = await run(`
      INSERT INTO care_activities (pet_id, booking_id, attendant_id, activity_type, notes, is_owner_visible)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [booking.pet_id, id, req.user.id, activity_type.trim(), notes.trim(), visibleFlag]);

    const savedLog = await get(`
      SELECT ca.*,
             p.name as pet_name, p.species as pet_species, p.breed as pet_breed,
             u.name as attendant_name, u.role as attendant_role,
             b.booking_number,
             o.name as owner_name, o.id as owner_id
      FROM care_activities ca
      LEFT JOIN pets p ON ca.pet_id = p.id
      LEFT JOIN users u ON ca.attendant_id = u.id
      LEFT JOIN bookings b ON ca.booking_id = b.id
      LEFT JOIN users o ON (b.owner_id = o.id OR p.owner_id = o.id)
      WHERE ca.id = ?
    `, [result.lastID]);

    return res.status(201).json({ success: true, message: 'Daily care activity logged.', data: savedLog });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to log care activity.' });
  }
};
