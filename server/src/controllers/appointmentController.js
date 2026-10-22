const { get, run, all } = require('../config/sqliteDb');

exports.createAppointment = async (req, res, next) => {
  try {
    const {
      service_id,
      customer_name,
      customer_email,
      customer_phone,
      pet_name,
      breed,
      age,
      appointment_date
    } = req.body;

    if (!service_id || !customer_name || !customer_email || !customer_phone || !pet_name || !breed || !age || !appointment_date) {
      return res.status(400).json({ success: false, message: 'All booking fields are required.' });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customer_email.trim())) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(appointment_date)) {
      return res.status(400).json({ success: false, message: 'Appointment date must be in YYYY-MM-DD format.' });
    }

    const sId = parseInt(service_id, 10);

    // Check service exists
    const service = await get('SELECT id, service_name, price FROM services WHERE id = ?', [sId]);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Selected service does not exist.' });
    }

    const result = await run(
      `INSERT INTO appointments (service_id, customer_name, customer_email, customer_phone, pet_name, breed, age, appointment_date, booking_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [
        sId,
        customer_name.trim(),
        customer_email.trim(),
        customer_phone.trim(),
        pet_name.trim(),
        breed.trim(),
        age.trim(),
        appointment_date
      ]
    );

    const newAppt = await get('SELECT * FROM appointments WHERE id = ?', [result.lastID]);
    return res.status(201).json({
      success: true,
      message: 'Appointment booked successfully.',
      appointment: newAppt
    });
  } catch (err) {
    next(err);
  }
};

exports.getAppointmentById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || id < 1) {
      return res.status(400).json({ success: false, message: 'Invalid appointment ID.' });
    }

    const sql = `
      SELECT
          a.id            AS booking_id,
          a.id,
          a.customer_name,
          a.customer_email,
          a.customer_phone,
          a.pet_name,
          a.breed,
          a.age,
          a.appointment_date,
          a.booking_status,
          a.created_at,
          s.service_name,
          s.category,
          s.target_pet_type,
          s.price         AS service_price,
          p.amount,
          p.payment_method,
          p.transaction_reference,
          p.payment_status,
          p.paid_at
       FROM appointments a
       JOIN services s ON s.id = a.service_id
       LEFT JOIN payments p ON p.booking_id = a.id
       WHERE a.id = ?
       LIMIT 1
    `;
    const appt = await get(sql, [id]);
    if (!appt) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }
    return res.json({ success: true, appointment: appt });
  } catch (err) {
    next(err);
  }
};

exports.getAppointments = async (req, res, next) => {
  try {
    const { status } = req.query;

    let conditions = [];
    let params = [];
    if (status && status !== 'all') {
      conditions.push('a.booking_status = ?');
      params.push(status);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const sql = `
      SELECT
          a.id,
          a.customer_name,
          a.customer_email,
          a.customer_phone,
          a.pet_name,
          a.breed,
          a.age,
          a.appointment_date,
          a.booking_status,
          a.created_at,
          s.service_name,
          s.price          AS service_price,
          p.payment_status,
          p.payment_method,
          p.amount         AS paid_amount,
          p.transaction_reference
      FROM appointments a
      JOIN services s ON a.service_id = s.id
      LEFT JOIN payments p ON a.id = p.booking_id
      ${where}
      ORDER BY a.created_at DESC
    `;
    const rows = await all(sql, params);
    return res.json({ success: true, appointments: rows });
  } catch (err) {
    next(err);
  }
};

exports.updateAppointmentStatus = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { booking_status } = req.body;

    const allowed = ['Pending', 'Confirmed', 'Completed', 'Cancelled'];
    if (!allowed.includes(booking_status)) {
      return res.status(400).json({ success: false, message: 'Invalid booking status.' });
    }

    const result = await run('UPDATE appointments SET booking_status = ? WHERE id = ?', [booking_status, id]);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }
    const updated = await get('SELECT * FROM appointments WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Booking status updated successfully.', appointment: updated });
  } catch (err) {
    next(err);
  }
};

