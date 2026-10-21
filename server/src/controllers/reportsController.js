const { get, run, all } = require('../config/sqliteDb');

// GET /api/reports/occupancy
exports.getOccupancyReport = async (req, res) => {
  try {
    const totalRooms = await get(`SELECT COUNT(*) as total FROM rooms`);
    const occupiedRooms = await get(`
      SELECT COUNT(DISTINCT room_id) as occupied FROM bookings
      WHERE booking_type = 'BOARDING' AND status IN ('Checked-in', 'Confirmed')
    `);
    
    const byType = await all(`
      SELECT room_type, COUNT(*) as total_rooms,
             SUM(CASE WHEN status = 'MAINTENANCE' THEN 1 ELSE 0 END) as under_maintenance
      FROM rooms GROUP BY room_type
    `);

    const occupancyRate = totalRooms.total > 0 ? ((occupiedRooms.occupied / totalRooms.total) * 100).toFixed(1) : 0;

    return res.json({
      success: true,
      data: {
        total_capacity: totalRooms.total,
        currently_occupied: occupiedRooms.occupied,
        occupancy_percentage: `${occupancyRate}%`,
        room_types: byType
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to generate occupancy report.' });
  }
};

// GET /api/reports/revenue (In Indian Rupees ₹)
exports.getRevenueReport = async (req, res) => {
  try {
    const totalRevenueRow = await get(`SELECT SUM(amount) as total FROM payments WHERE payment_status = 'Paid'`);
    const boardingRevRow = await get(`
      SELECT SUM(p.amount) as total FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      WHERE p.payment_status = 'Paid' AND b.booking_type = 'BOARDING'
    `);
    const groomingRevRow = await get(`
      SELECT SUM(p.amount) as total FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      WHERE p.payment_status = 'Paid' AND b.booking_type = 'GROOMING'
    `);

    const byMethod = await all(`
      SELECT payment_method, SUM(amount) as total, COUNT(*) as count
      FROM payments WHERE payment_status = 'Paid'
      GROUP BY payment_method
    `);

    const recentTransactions = await all(`
      SELECT p.*, b.booking_number, b.booking_type, u.name as customer_name
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      JOIN users u ON b.owner_id = u.id
      ORDER BY p.id DESC LIMIT 10
    `);

    return res.json({
      success: true,
      currency: 'INR',
      data: {
        total_revenue: totalRevenueRow.total || 0,
        boarding_revenue: boardingRevRow.total || 0,
        grooming_revenue: groomingRevRow.total || 0,
        by_method: byMethod,
        recent_transactions: recentTransactions
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to generate revenue report.' });
  }
};

// GET /api/reports/stats
exports.getDashboardStats = async (req, res) => {
  try {
    const totalPets = await get(`SELECT COUNT(*) as count FROM pets`);
    const totalUsers = await get(`SELECT COUNT(*) as count FROM users WHERE role = 'PET_OWNER'`);
    const totalBookings = await get(`SELECT COUNT(*) as count FROM bookings`);
    const activeCheckedIn = await get(`SELECT COUNT(*) as count FROM bookings WHERE status = 'Checked-in'`);
    const todayArrivals = await get(`SELECT COUNT(*) as count FROM bookings WHERE start_date = date('now') AND status = 'Confirmed'`);
    const todayDepartures = await get(`SELECT COUNT(*) as count FROM bookings WHERE end_date = date('now') AND status = 'Checked-in'`);
    const revenue = await get(`SELECT SUM(amount) as total FROM payments WHERE payment_status = 'Paid'`);

    return res.json({
      success: true,
      data: {
        total_pets: totalPets.count,
        total_customers: totalUsers.count,
        total_bookings: totalBookings.count,
        active_checked_in: activeCheckedIn.count,
        today_arrivals: todayArrivals.count,
        today_departures: todayDepartures.count,
        total_revenue_inr: revenue.total || 0
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats.' });
  }
};

// GET /api/reports/notifications
exports.getNotifications = async (req, res) => {
  try {
    const notes = await all(`SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 20`, [req.user.id]);
    return res.json({ success: true, data: notes });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to load notifications.' });
  }
};

// GET /api/reports/export/revenue-csv - Admin CSV Export of Revenue
exports.exportRevenueCSV = async (req, res) => {
  try {
    const payments = await all(`
      SELECT p.id, p.transaction_reference, p.amount, p.payment_method, p.payment_type, p.payment_status, p.paid_at,
             b.booking_number, b.booking_type, u.name as customer_name, u.email as customer_email
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      JOIN users u ON b.owner_id = u.id
      ORDER BY p.id DESC
    `);

    let csv = 'Payment ID,Transaction Reference,Booking Number,Booking Type,Customer Name,Customer Email,Amount (INR),Payment Method,Payment Type,Status,Date\n';
    for (const p of payments) {
      csv += `"${p.id}","${p.transaction_reference}","${p.booking_number}","${p.booking_type}","${p.customer_name}","${p.customer_email}","${p.amount}","${p.payment_method}","${p.payment_type}","${p.payment_status}","${p.paid_at}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="pbgms_revenue_report.csv"');
    return res.status(200).send(csv);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to generate revenue CSV.' });
  }
};

// GET /api/reports/export/bookings-csv - Admin / Front Desk CSV Export of Bookings
exports.exportBookingsCSV = async (req, res) => {
  try {
    const bookings = await all(`
      SELECT b.id, b.booking_number, b.booking_type, b.status, b.start_date, b.end_date, b.start_time, b.total_price, b.deposit_amount, b.late_checkout_fee,
             p.name as pet_name, p.species as pet_species,
             u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
             r.room_number, s.service_name
      FROM bookings b
      JOIN pets p ON b.pet_id = p.id
      JOIN users u ON b.owner_id = u.id
      LEFT JOIN rooms r ON b.room_id = r.id
      LEFT JOIN services s ON b.service_id = s.id
      ORDER BY b.id DESC
    `);

    let csv = 'Booking Number,Type,Status,Customer Name,Email,Phone,Pet Name,Species,Room,Service,Start Date,End Date,Time,Total (INR),Deposit (INR),Late Fee (INR)\n';
    for (const b of bookings) {
      csv += `"${b.booking_number}","${b.booking_type}","${b.status}","${b.customer_name}","${b.customer_email}","${b.customer_phone}","${b.pet_name}","${b.pet_species}","${b.room_number || 'N/A'}","${b.service_name || 'N/A'}","${b.start_date}","${b.end_date || 'N/A'}","${b.start_time || 'N/A'}","${b.total_price}","${b.deposit_amount}","${b.late_checkout_fee || 0}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="pbgms_bookings_report.csv"');
    return res.status(200).send(csv);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to generate bookings CSV.' });
  }
};

// GET /api/reports/config - System Admin view business configuration
exports.getConfig = async (req, res) => {
  try {
    const configs = await all(`SELECT * FROM business_config`);
    return res.json({ success: true, data: configs });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to load configuration.' });
  }
};

// PUT /api/reports/config - System Admin update business configuration
exports.updateConfig = async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ success: false, message: 'Configuration key and value are required.' });
    }

    await run(`UPDATE business_config SET value = ? WHERE key = ?`, [String(value), key]);
    const updated = await get(`SELECT * FROM business_config WHERE key = ?`, [key]);
    return res.json({ success: true, message: `Configuration '${key}' updated.`, data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update configuration.' });
  }
};
