const { get, run, all } = require('../config/sqliteDb');

// GET /api/services - Retrieve signature services from persistent SQLite DB
exports.getServices = async (req, res, next) => {
  try {
    const { search, category, pet_type } = req.query;

    let conditions = [];
    let params = [];

    if (search) {
      conditions.push('(service_name LIKE ? OR description LIKE ?)');
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }
    if (category) {
      conditions.push('category = ?');
      params.push(category.trim());
    }
    if (pet_type) {
      conditions.push('target_pet_type = ?');
      params.push(pet_type.trim());
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const rows = await all(
      `SELECT id, service_name, category, target_pet_type, description, price, duration_minutes, image, created_at, updated_at
       FROM services ${where} ORDER BY id ASC`,
      params
    );

    const catRows = await all('SELECT DISTINCT category FROM services ORDER BY category');
    const petRows = await all('SELECT DISTINCT target_pet_type FROM services ORDER BY target_pet_type');

    return res.json({
      success: true,
      data: rows,
      services: rows, // Backwards compatibility for both frontend conventions
      categories: catRows.map(c => c.category),
      petTypes: petRows.map(p => p.target_pet_type)
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/services/:id
exports.getServiceById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || id < 1) {
      return res.status(400).json({ success: false, message: 'Invalid service ID.' });
    }

    const service = await get('SELECT * FROM services WHERE id = ? LIMIT 1', [id]);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found.' });
    }

    return res.json({ success: true, service, data: service });
  } catch (err) {
    next(err);
  }
};

// POST /api/services - Admin create new service in SQLite
exports.createService = async (req, res, next) => {
  try {
    const { service_name, category, target_pet_type, description, price, duration_minutes, image } = req.body;
    if (!service_name || !category || !target_pet_type || !description || price === undefined) {
      return res.status(400).json({ success: false, message: 'All required fields must be provided.' });
    }

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return res.status(400).json({ success: false, message: 'Price must be a non-negative number.' });
    }

    const duration = parseInt(duration_minutes, 10) || 60;

    const result = await run(
      `INSERT INTO services (service_name, category, target_pet_type, description, price, duration_minutes, image)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [service_name.trim(), category.trim(), target_pet_type.trim(), description.trim(), numPrice, duration, image || null]
    );

    const newRow = await get('SELECT * FROM services WHERE id = ?', [result.lastID]);
    return res.status(201).json({
      success: true,
      message: 'Service created successfully.',
      service: newRow,
      data: newRow
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/services/:id - Admin update service in SQLite
exports.updateService = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || id < 1) {
      return res.status(400).json({ success: false, message: 'Invalid service ID.' });
    }

    const { service_name, category, target_pet_type, description, price, duration_minutes, image } = req.body;
    const numPrice = price !== undefined ? parseFloat(price) : undefined;
    if (numPrice !== undefined && (isNaN(numPrice) || numPrice < 0)) {
      return res.status(400).json({ success: false, message: 'Price must be a non-negative number.' });
    }

    const existing = await get('SELECT * FROM services WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Service not found.' });
    }

    await run(
      `UPDATE services
       SET service_name = COALESCE(?, service_name),
           category = COALESCE(?, category),
           target_pet_type = COALESCE(?, target_pet_type),
           description = COALESCE(?, description),
           price = COALESCE(?, price),
           duration_minutes = COALESCE(?, duration_minutes),
           image = COALESCE(?, image),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        service_name ? service_name.trim() : null,
        category ? category.trim() : null,
        target_pet_type ? target_pet_type.trim() : null,
        description ? description.trim() : null,
        numPrice !== undefined ? numPrice : null,
        duration_minutes !== undefined ? parseInt(duration_minutes, 10) : null,
        image || null,
        id
      ]
    );

    const updated = await get('SELECT * FROM services WHERE id = ?', [id]);
    return res.json({
      success: true,
      message: 'Service updated successfully.',
      service: updated,
      data: updated
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/services/:id - Admin delete service
exports.deleteService = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || id < 1) {
      return res.status(400).json({ success: false, message: 'Invalid service ID.' });
    }

    const existing = await get('SELECT * FROM services WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Service not found.' });
    }

    // Check if any active booking uses this service
    const activeBooking = await get(
      `SELECT id FROM bookings WHERE service_id = ? AND status IN ('Confirmed', 'Scheduled', 'In Service')`,
      [id]
    );
    if (activeBooking) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete service with active upcoming bookings.'
      });
    }

    await run('DELETE FROM services WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Service removed successfully.' });
  } catch (err) {
    next(err);
  }
};
