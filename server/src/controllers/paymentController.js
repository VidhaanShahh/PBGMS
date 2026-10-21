const db = require('../config/db');
const store = require('../data/store');

exports.processPayment = async (req, res, next) => {
  try {
    const { appointment_id, payment_method, card_name, card_number, card_expiry, card_cvv } = req.body;

    if (!appointment_id || !payment_method) {
      return res.status(400).json({ success: false, message: 'Appointment ID and Payment Method are required.' });
    }

    const apptId = parseInt(appointment_id, 10);
    const validMethods = ['Credit Card', 'Debit Card', 'Cash on Arrival', 'Bank Transfer'];
    if (!validMethods.includes(payment_method)) {
      return res.status(400).json({ success: false, message: 'Invalid payment method selected.' });
    }

    if (['Credit Card', 'Debit Card'].includes(payment_method)) {
      if (!card_name || !card_number || !card_expiry || !card_cvv) {
        return res.status(400).json({ success: false, message: 'All card details are required for card payments.' });
      }
      const cleanNum = card_number.replace(/\s+/g, '');
      if (!/^\d{16}$/.test(cleanNum)) {
        return res.status(400).json({ success: false, message: 'Card number must be 16 digits.' });
      }
      if (!/^\d{3,4}$/.test(card_cvv.trim())) {
        return res.status(400).json({ success: false, message: 'CVV must be 3 or 4 digits.' });
      }
    }

    const txRef = 'TXN-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(1000 + Math.random() * 9000);

    if (db.isDbConnected()) {
      // Fetch appointment and service price
      const [apptRows] = await db.query(
        `SELECT a.id, a.booking_status, s.price
         FROM appointments a
         JOIN services s ON a.service_id = s.id
         WHERE a.id = ? LIMIT 1`,
        [apptId]
      );

      if (apptRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Appointment not found.' });
      }

      const appt = apptRows[0];

      // Check if already paid
      const [payRows] = await db.query(
        'SELECT id FROM payments WHERE appointment_id = ? AND payment_status = "Paid" LIMIT 1',
        [apptId]
      );
      if (payRows.length > 0) {
        return res.json({
          success: true,
          message: 'Payment already completed.',
          appointment_id: apptId,
          transaction_reference: txRef
        });
      }

      // Insert payment record
      await db.query(
        `INSERT INTO payments (appointment_id, amount, payment_method, transaction_reference, payment_status, paid_at)
         VALUES (?, ?, ?, ?, 'Paid', NOW())`,
        [apptId, appt.price, payment_method, txRef]
      );

      // Confirm appointment status
      await db.query('UPDATE appointments SET booking_status = "Confirmed" WHERE id = ?', [apptId]);

      return res.status(201).json({
        success: true,
        message: 'Payment recorded successfully.',
        appointment_id: apptId,
        transaction_reference: txRef
      });
    } else {
      const appt = store.getAppointmentById(apptId);
      if (!appt) {
        return res.status(404).json({ success: false, message: 'Appointment not found.' });
      }

      const payment = store.createPayment({
        appointment_id: apptId,
        amount: appt.service_price,
        payment_method,
        transaction_reference: txRef
      });

      store.updateAppointmentStatus(apptId, 'Confirmed');

      return res.status(201).json({
        success: true,
        message: 'Payment recorded successfully.',
        appointment_id: apptId,
        transaction_reference: txRef
      });
    }
  } catch (err) {
    next(err);
  }
};
