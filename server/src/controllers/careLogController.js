const { all, get, run } = require('../config/sqliteDb');

// GET /api/care-logs - Shared Care Log query endpoint
exports.getAllCareLogs = async (req, res) => {
  try {
    const { pet_id, booking_id, limit = 100 } = req.query;
    const userRole = req.user.role;
    const userId = req.user.id;

    let sql = `
      SELECT ca.id, ca.pet_id, ca.booking_id, ca.attendant_id, ca.activity_type, ca.notes,
             ca.is_owner_visible, ca.logged_at,
             p.name AS pet_name, p.species AS pet_species, p.breed AS pet_breed,
             u.name AS attendant_name, u.role AS attendant_role,
             b.booking_number,
             o.name AS owner_name, o.id AS owner_id
      FROM care_activities ca
      LEFT JOIN pets p ON ca.pet_id = p.id
      LEFT JOIN users u ON ca.attendant_id = u.id
      LEFT JOIN bookings b ON ca.booking_id = b.id
      LEFT JOIN users o ON (b.owner_id = o.id OR p.owner_id = o.id)
      WHERE 1=1
    `;
    const params = [];

    // Authorization filtering
    if (userRole === 'PET_OWNER') {
      // Pet owners can ONLY view logs for their own pets that are marked owner-visible
      sql += ` AND (p.owner_id = ? OR b.owner_id = ?) AND ca.is_owner_visible = 1`;
      params.push(userId, userId);

      if (pet_id) {
        const pet = await get(`SELECT id, owner_id FROM pets WHERE id = ?`, [pet_id]);
        if (!pet || pet.owner_id !== userId) {
          return res.status(403).json({ success: false, message: 'Cannot access care logs for another owner\'s pet.' });
        }
        sql += ` AND ca.pet_id = ?`;
        params.push(pet_id);
      }

      if (booking_id) {
        const booking = await get(`SELECT id, owner_id FROM bookings WHERE id = ?`, [booking_id]);
        if (!booking || booking.owner_id !== userId) {
          return res.status(403).json({ success: false, message: 'Cannot access care logs for another owner\'s booking.' });
        }
        sql += ` AND ca.booking_id = ?`;
        params.push(booking_id);
      }
    } else {
      // Staff (FRONT_DESK, BOARDING_ATTENDANT, GROOMER, ADMIN, SYSTEM_ADMIN)
      if (pet_id) {
        sql += ` AND ca.pet_id = ?`;
        params.push(pet_id);
      }
      if (booking_id) {
        sql += ` AND ca.booking_id = ?`;
        params.push(booking_id);
      }
    }

    sql += ` ORDER BY ca.logged_at DESC LIMIT ?`;
    params.push(Number(limit) || 100);

    const logs = await all(sql, params);
    return res.json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    console.error('Error fetching care logs:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve care logs.' });
  }
};

// POST /api/care-logs - Create a shared care log record
exports.createCareLog = async (req, res) => {
  try {
    const { pet_id, booking_id, activity_type, notes, is_owner_visible } = req.body;

    if (!activity_type || !notes || !notes.trim()) {
      return res.status(400).json({ success: false, message: 'Activity type and care notes description are required.' });
    }

    let resolvedPetId = pet_id;
    let resolvedBookingId = booking_id || null;

    if (resolvedBookingId) {
      const booking = await get(`SELECT id, pet_id, owner_id FROM bookings WHERE id = ?`, [resolvedBookingId]);
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Associated booking not found.' });
      }
      if (!resolvedPetId) {
        resolvedPetId = booking.pet_id;
      }
    }

    if (!resolvedPetId) {
      return res.status(400).json({ success: false, message: 'Pet ID or Booking ID is required to log care.' });
    }

    const pet = await get(`SELECT id, name, owner_id FROM pets WHERE id = ?`, [resolvedPetId]);
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found.' });
    }

    // If no booking was specified, check if there is an active stay for this pet
    if (!resolvedBookingId) {
      const activeBooking = await get(
        `SELECT id FROM bookings WHERE pet_id = ? AND status IN ('Checked-in', 'In Service', 'Confirmed') ORDER BY id DESC LIMIT 1`,
        [resolvedPetId]
      );
      if (activeBooking) {
        resolvedBookingId = activeBooking.id;
      }
    }

    if (!resolvedBookingId) {
      return res.status(400).json({
        success: false,
        message: 'A valid active Booking ID is required to log a daily boarding/grooming care activity for this pet.'
      });
    }

    const visibleFlag = is_owner_visible !== undefined ? (is_owner_visible ? 1 : 0) : 1;

    const insertResult = await run(
      `INSERT INTO care_activities (pet_id, booking_id, attendant_id, activity_type, notes, is_owner_visible)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [resolvedPetId, resolvedBookingId, req.user.id, activity_type.trim(), notes.trim(), visibleFlag]
    );

    const savedLog = await get(
      `SELECT ca.*,
              p.name AS pet_name, p.species AS pet_species, p.breed AS pet_breed,
              u.name AS attendant_name, u.role AS attendant_role,
              b.booking_number,
              o.name AS owner_name, o.id AS owner_id
       FROM care_activities ca
       LEFT JOIN pets p ON ca.pet_id = p.id
       LEFT JOIN users u ON ca.attendant_id = u.id
       LEFT JOIN bookings b ON ca.booking_id = b.id
       LEFT JOIN users o ON (b.owner_id = o.id OR p.owner_id = o.id)
       WHERE ca.id = ?`,
      [insertResult.lastID]
    );

    return res.status(201).json({
      success: true,
      message: `Care activity logged for ${pet.name}.`,
      data: savedLog
    });
  } catch (err) {
    console.error('Error creating care log:', err);
    return res.status(500).json({ success: false, message: 'Failed to record care activity.' });
  }
};

// GET /api/pets/:id/care-logs - Specific Pet care log history
exports.getPetCareLogs = async (req, res) => {
  try {
    const petId = req.params.id;
    const pet = await get(`SELECT id, name, owner_id FROM pets WHERE id = ?`, [petId]);
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found.' });
    }

    if (req.user.role === 'PET_OWNER' && pet.owner_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Cannot view another customer\'s pet care logs.' });
    }

    let sql = `
      SELECT ca.*,
             p.name AS pet_name,
             u.name AS attendant_name, u.role AS attendant_role,
             b.booking_number
      FROM care_activities ca
      JOIN pets p ON ca.pet_id = p.id
      LEFT JOIN users u ON ca.attendant_id = u.id
      LEFT JOIN bookings b ON ca.booking_id = b.id
      WHERE ca.pet_id = ?
    `;
    const params = [petId];

    if (req.user.role === 'PET_OWNER') {
      sql += ` AND ca.is_owner_visible = 1`;
    }

    sql += ` ORDER BY ca.logged_at DESC`;

    const logs = await all(sql, params);
    return res.json({ success: true, pet_name: pet.name, count: logs.length, data: logs });
  } catch (err) {
    console.error('Error fetching pet care logs:', err);
    return res.status(500).json({ success: false, message: 'Failed to load pet care logs.' });
  }
};

// GET /api/bookings/:id/care-logs - Specific Booking care log history
exports.getBookingCareLogs = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const booking = await get(`SELECT id, pet_id, owner_id, booking_number FROM bookings WHERE id = ?`, [bookingId]);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    if (req.user.role === 'PET_OWNER' && booking.owner_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Cannot view another customer\'s booking logs.' });
    }

    let sql = `
      SELECT ca.*,
             p.name AS pet_name,
             u.name AS attendant_name, u.role AS attendant_role,
             b.booking_number
      FROM care_activities ca
      LEFT JOIN pets p ON ca.pet_id = p.id
      LEFT JOIN users u ON ca.attendant_id = u.id
      LEFT JOIN bookings b ON ca.booking_id = b.id
      WHERE ca.booking_id = ?
    `;
    const params = [bookingId];

    if (req.user.role === 'PET_OWNER') {
      sql += ` AND ca.is_owner_visible = 1`;
    }

    sql += ` ORDER BY ca.logged_at DESC`;

    const logs = await all(sql, params);
    return res.json({ success: true, booking_number: booking.booking_number, count: logs.length, data: logs });
  } catch (err) {
    console.error('Error fetching booking care logs:', err);
    return res.status(500).json({ success: false, message: 'Failed to load booking care logs.' });
  }
};
