const { get, run, all } = require('../config/sqliteDb');

/**
 * GET /api/grooming/dashboard
 * Live operational metrics for authenticated groomer
 */
exports.getDashboard = async (req, res) => {
  try {
    const groomerId = req.user.id;
    const isStaffGroomer = req.user.role === 'GROOMER';
    const today = new Date().toISOString().split('T')[0];

    // For GROOMER role: filter by assigned groomer OR unassigned appointments if permitted
    let groomerFilter = ``;
    const params = [];
    if (isStaffGroomer) {
      groomerFilter = ` AND (b.staff_id = ? OR b.staff_id IS NULL)`;
      params.push(groomerId);
    }

    // 1. Today's appointments
    const todayList = await all(`
      SELECT b.*,
             p.name as pet_name, p.species as pet_species, p.breed as pet_breed,
             p.allergies, p.behavioral_notes, p.dob,
             u.name as owner_name, u.phone as owner_phone,
             s.service_name, s.duration_minutes, s.description as service_desc,
             gs.id as session_id, gs.session_status, gs.started_at, gs.completed_at
      FROM bookings b
      JOIN pets p ON b.pet_id = p.id
      JOIN users u ON b.owner_id = u.id
      JOIN services s ON b.service_id = s.id
      LEFT JOIN grooming_sessions gs ON b.id = gs.booking_id
      WHERE b.booking_type = 'GROOMING' AND b.start_date = ? AND b.status != 'Cancelled'
      ${groomerFilter}
      ORDER BY b.start_time ASC
    `, [today, ...params]);

    // Calculate metrics
    const waitingForGrooming = todayList.filter(b => b.status === 'Checked-in' || b.session_status === 'Checked-in').length;
    const inService = todayList.filter(b => b.status === 'In Service' || b.session_status === 'In Service').length;
    const completedToday = todayList.filter(b => b.status === 'Completed' || b.status === 'Ready for Collection').length;
    const readyForCollection = todayList.filter(b => b.status === 'Ready for Collection' || b.session_status === 'Ready for Collection').length;

    // Safety alerts (allergies or behavioral precautions among today's guests)
    const safetyAlerts = todayList.filter(b => b.allergies || b.behavioral_notes);

    // Upcoming appointments (beyond today)
    const upcoming = await all(`
      SELECT b.id, b.booking_number, b.start_date, b.start_time, b.status,
             p.name as pet_name, p.breed as pet_breed, p.allergies,
             s.service_name, s.duration_minutes,
             u.name as owner_name
      FROM bookings b
      JOIN pets p ON b.pet_id = p.id
      JOIN users u ON b.owner_id = u.id
      JOIN services s ON b.service_id = s.id
      WHERE b.booking_type = 'GROOMING' AND b.start_date > ? AND b.status != 'Cancelled'
      ${groomerFilter}
      ORDER BY b.start_date ASC, b.start_time ASC
      LIMIT 20
    `, [today, ...params]);

    return res.json({
      success: true,
      data: {
        today_total: todayList.length,
        waiting_for_grooming: waitingForGrooming,
        in_service: inService,
        completed_today: completedToday,
        ready_for_collection: readyForCollection,
        safety_alerts_count: safetyAlerts.length,
        today_appointments: todayList,
        upcoming_appointments: upcoming,
        safety_alerts: safetyAlerts
      }
    });
  } catch (err) {
    console.error('Groomer dashboard error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load groomer dashboard.' });
  }
};

/**
 * GET /api/grooming/sessions/:bookingId
 * Retrieve or initialize grooming session with checklist
 */
exports.getSession = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await get(`
      SELECT b.*,
             p.name as pet_name, p.species as pet_species, p.breed as pet_breed, p.dob, p.weight,
             p.allergies, p.behavioral_notes, p.feeding_instructions,
             u.name as owner_name, u.phone as owner_phone,
             s.service_name, s.duration_minutes, s.description as service_desc
      FROM bookings b
      JOIN pets p ON b.pet_id = p.id
      JOIN users u ON b.owner_id = u.id
      JOIN services s ON b.service_id = s.id
      WHERE b.id = ? AND b.booking_type = 'GROOMING'
    `, [bookingId]);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Grooming appointment not found.' });
    }

    let session = await get(`SELECT * FROM grooming_sessions WHERE booking_id = ?`, [bookingId]);

    // If session doesn't exist yet, initialize it
    if (!session) {
      const groomerId = req.user.role === 'GROOMER' ? req.user.id : (booking.staff_id || req.user.id);
      const initResult = await run(`
        INSERT INTO grooming_sessions (
          booking_id, groomer_id, session_status, safety_alerts
        ) VALUES (?, ?, ?, ?)
      `, [
        bookingId,
        groomerId,
        booking.status || 'Scheduled',
        booking.allergies ? `Alert: ${booking.allergies}` : null
      ]);

      session = await get(`SELECT * FROM grooming_sessions WHERE id = ?`, [initResult.lastID]);
    }

    // Historical grooming sessions for this pet
    const history = await all(`
      SELECT gs.*, b.booking_number, b.start_date, s.service_name, u.name as groomer_name
      FROM grooming_sessions gs
      JOIN bookings b ON gs.booking_id = b.id
      JOIN services s ON b.service_id = s.id
      JOIN users u ON gs.groomer_id = u.id
      WHERE b.pet_id = ? AND b.id != ? AND gs.session_status IN ('Completed', 'Ready for Collection', 'Collected')
      ORDER BY gs.id DESC LIMIT 5
    `, [booking.pet_id, bookingId]);

    return res.json({
      success: true,
      booking,
      session,
      history
    });
  } catch (err) {
    console.error('Fetch grooming session error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load grooming session.' });
  }
};

/**
 * POST /api/grooming/sessions/:bookingId/start
 * Groomer starts session (sets started_at, status = In Service)
 */
exports.startSession = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const groomerId = req.user.id;

    const booking = await get(`SELECT * FROM bookings WHERE id = ? AND booking_type = 'GROOMING'`, [bookingId]);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    // Assign groomer if unassigned
    await run(`UPDATE bookings SET status = 'In Service', staff_id = COALESCE(staff_id, ?) WHERE id = ?`, [groomerId, bookingId]);

    // Ensure session record exists
    let session = await get(`SELECT * FROM grooming_sessions WHERE booking_id = ?`, [bookingId]);
    if (session) {
      await run(`
        UPDATE grooming_sessions SET
          session_status = 'In Service',
          groomer_id = ?,
          started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [groomerId, session.id]);
    } else {
      await run(`
        INSERT INTO grooming_sessions (booking_id, groomer_id, session_status, started_at)
        VALUES (?, ?, 'In Service', CURRENT_TIMESTAMP)
      `, [bookingId, groomerId]);
    }

    // Log care activity
    await run(`
      INSERT INTO care_activities (pet_id, booking_id, attendant_id, activity_type, notes, is_owner_visible)
      VALUES (?, ?, ?, 'Grooming', 'Grooming spa treatment started by Master Groomer.', 1)
    `, [booking.pet_id, bookingId, groomerId]);

    return res.json({ success: true, message: 'Grooming session started. Status set to In Service.' });
  } catch (err) {
    console.error('Start grooming session error:', err);
    return res.status(500).json({ success: false, message: 'Failed to start session.' });
  }
};

/**
 * PUT /api/grooming/sessions/:bookingId/checklist
 * Save checklist progress, observations, and recommendations
 */
exports.updateChecklist = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const {
      checklist_bathing,
      checklist_drying,
      checklist_brushing,
      checklist_nail_trimming,
      checklist_ear_cleaning,
      checklist_hair_trimming,
      checklist_coat_inspection,
      checklist_final_inspection,
      coat_condition,
      skin_condition,
      behavior_notes,
      incident_notes,
      products_used,
      recommendations,
      handover_notes
    } = req.body;

    const session = await get(`SELECT * FROM grooming_sessions WHERE booking_id = ?`, [bookingId]);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Grooming session record not found.' });
    }

    await run(`
      UPDATE grooming_sessions SET
        checklist_bathing = COALESCE(?, checklist_bathing),
        checklist_drying = COALESCE(?, checklist_drying),
        checklist_brushing = COALESCE(?, checklist_brushing),
        checklist_nail_trimming = COALESCE(?, checklist_nail_trimming),
        checklist_ear_cleaning = COALESCE(?, checklist_ear_cleaning),
        checklist_hair_trimming = COALESCE(?, checklist_hair_trimming),
        checklist_coat_inspection = COALESCE(?, checklist_coat_inspection),
        checklist_final_inspection = COALESCE(?, checklist_final_inspection),
        coat_condition = COALESCE(?, coat_condition),
        skin_condition = COALESCE(?, skin_condition),
        behavior_notes = COALESCE(?, behavior_notes),
        incident_notes = COALESCE(?, incident_notes),
        products_used = COALESCE(?, products_used),
        recommendations = COALESCE(?, recommendations),
        handover_notes = COALESCE(?, handover_notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE booking_id = ?
    `, [
      checklist_bathing !== undefined ? (checklist_bathing ? 1 : 0) : null,
      checklist_drying !== undefined ? (checklist_drying ? 1 : 0) : null,
      checklist_brushing !== undefined ? (checklist_brushing ? 1 : 0) : null,
      checklist_nail_trimming !== undefined ? (checklist_nail_trimming ? 1 : 0) : null,
      checklist_ear_cleaning !== undefined ? (checklist_ear_cleaning ? 1 : 0) : null,
      checklist_hair_trimming !== undefined ? (checklist_hair_trimming ? 1 : 0) : null,
      checklist_coat_inspection !== undefined ? (checklist_coat_inspection ? 1 : 0) : null,
      checklist_final_inspection !== undefined ? (checklist_final_inspection ? 1 : 0) : null,
      coat_condition || null,
      skin_condition || null,
      behavior_notes || null,
      incident_notes || null,
      products_used || null,
      recommendations || null,
      handover_notes || null,
      bookingId
    ]);

    const updated = await get(`SELECT * FROM grooming_sessions WHERE booking_id = ?`, [bookingId]);
    return res.json({ success: true, message: 'Grooming checklist and notes saved.', session: updated });
  } catch (err) {
    console.error('Update grooming checklist error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update checklist.' });
  }
};

/**
 * POST /api/grooming/sessions/:bookingId/complete
 * Groomer completes session and marks pet Ready for Collection
 */
exports.completeSession = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { handover_notes, recommendations } = req.body;
    const groomerId = req.user.id;

    const booking = await get(`SELECT * FROM bookings WHERE id = ? AND booking_type = 'GROOMING'`, [bookingId]);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    // Set status to Ready for Collection
    await run(`
      UPDATE bookings SET
        status = 'Ready for Collection',
        handover_notes = ?,
        service_notes = COALESCE(?, service_notes)
      WHERE id = ?
    `, [handover_notes || null, recommendations || null, bookingId]);

    await run(`
      UPDATE grooming_sessions SET
        session_status = 'Ready for Collection',
        completed_at = CURRENT_TIMESTAMP,
        handover_notes = COALESCE(?, handover_notes),
        recommendations = COALESCE(?, recommendations),
        updated_at = CURRENT_TIMESTAMP
      WHERE booking_id = ?
    `, [handover_notes || null, recommendations || null, bookingId]);

    // Create owner-visible care log update
    const publicNotes = `Grooming complete! Pet is styled, fresh, and ready for pickup at the Front Desk. ${recommendations ? `Care tip: ${recommendations}` : ''}`.trim();
    await run(`
      INSERT INTO care_activities (pet_id, booking_id, attendant_id, activity_type, notes, is_owner_visible)
      VALUES (?, ?, ?, 'Grooming Complete', ?, 1)
    `, [booking.pet_id, bookingId, groomerId, publicNotes]);

    return res.json({
      success: true,
      message: `Grooming completed! Pet marked 'Ready for Collection'. Front desk notified.`
    });
  } catch (err) {
    console.error('Complete grooming session error:', err);
    return res.status(500).json({ success: false, message: 'Failed to complete grooming session.' });
  }
};
