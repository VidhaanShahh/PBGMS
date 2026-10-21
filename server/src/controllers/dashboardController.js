const db = require('../config/db');
const store = require('../data/store');

exports.getStats = async (req, res, next) => {
  try {
    if (db.isDbConnected()) {
      const [[svcCount]] = await db.query('SELECT COUNT(*) AS totalServices FROM services');
      const [[apptCount]] = await db.query('SELECT COUNT(*) AS totalAppointments FROM appointments');
      const [[paidCount]] = await db.query("SELECT COUNT(*) AS paidBookings FROM payments WHERE payment_status = 'Paid'");
      const [[pendingCount]] = await db.query("SELECT COUNT(*) AS pendingPayments FROM payments WHERE payment_status = 'Pending'");

      return res.json({
        success: true,
        stats: {
          totalServices: svcCount.totalServices || 0,
          totalAppointments: apptCount.totalAppointments || 0,
          paidBookings: paidCount.paidBookings || 0,
          pendingPayments: pendingCount.pendingPayments || 0
        }
      });
    } else {
      return res.json({
        success: true,
        stats: store.getStats()
      });
    }
  } catch (err) {
    next(err);
  }
};
