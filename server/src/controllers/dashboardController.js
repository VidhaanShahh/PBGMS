const { get } = require('../config/sqliteDb');

exports.getStats = async (req, res, next) => {
  try {
    const svcCount = await get('SELECT COUNT(*) AS totalServices FROM services');
    const bookingCount = await get('SELECT COUNT(*) AS totalAppointments FROM bookings');
    const paidCount = await get("SELECT COUNT(*) AS paidBookings FROM payments WHERE payment_status = 'Paid'");
    const pendingCount = await get("SELECT COUNT(*) AS pendingPayments FROM payments WHERE payment_status = 'Pending'");

    return res.json({
      success: true,
      stats: {
        totalServices: svcCount ? svcCount.totalServices : 0,
        totalAppointments: bookingCount ? bookingCount.totalAppointments : 0,
        paidBookings: paidCount ? paidCount.paidBookings : 0,
        pendingPayments: pendingCount ? pendingCount.pendingPayments : 0
      }
    });
  } catch (err) {
    next(err);
  }
};

