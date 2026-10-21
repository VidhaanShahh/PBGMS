const { get, run, all } = require('../config/sqliteDb');

// GET /api/pets - Get all pets for the authenticated user, or all pets if staff/admin
exports.getMyPets = async (req, res) => {
  try {
    let sql = `SELECT * FROM pets WHERE owner_id = ? ORDER BY id DESC`;
    let params = [req.user.id];

    if (['ADMIN', 'FRONT_DESK', 'BOARDING_ATTENDANT', 'GROOMER'].includes(req.user.role) && req.query.all === 'true') {
      sql = `SELECT p.*, u.name as owner_name, u.phone as owner_phone, u.email as owner_email FROM pets p JOIN users u ON p.owner_id = u.id ORDER BY p.id DESC`;
      params = [];
    }

    const pets = await all(sql, params);

    // Attach active vaccinations to each pet
    for (const pet of pets) {
      pet.vaccinations = await all(`SELECT * FROM vaccinations WHERE pet_id = ? ORDER BY expiration_date DESC`, [pet.id]);
      const now = new Date().toISOString().split('T')[0];
      pet.has_active_vaccine = pet.vaccinations.some(v => v.expiration_date >= now);
    }

    return res.json({ success: true, data: pets });
  } catch (err) {
    console.error('Fetch pets error:', err);
    return res.status(500).json({ success: false, message: 'Could not fetch pets.' });
  }
};

// GET /api/pets/:id
exports.getPetById = async (req, res) => {
  try {
    const pet = await get(`SELECT p.*, u.name as owner_name, u.phone as owner_phone FROM pets p JOIN users u ON p.owner_id = u.id WHERE p.id = ?`, [req.params.id]);
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found.' });
    }

    // Role ownership check
    if (req.user.role === 'PET_OWNER' && pet.owner_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied to this pet record.' });
    }

    pet.vaccinations = await all(`SELECT * FROM vaccinations WHERE pet_id = ?`, [pet.id]);
    pet.bookings = await all(`SELECT * FROM bookings WHERE pet_id = ? ORDER BY id DESC`, [pet.id]);

    return res.json({ success: true, data: pet });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve pet details.' });
  }
};

// POST /api/pets - Register new pet
exports.addPet = async (req, res) => {
  try {
    const {
      name,
      species,
      breed,
      dob,
      weight,
      sex,
      feeding_instructions,
      medication_instructions,
      behavioral_notes,
      allergies
    } = req.body;

    if (!name || !species) {
      return res.status(400).json({ success: false, message: 'Pet name and species are mandatory.' });
    }

    const result = await run(
      `INSERT INTO pets (owner_id, name, species, breed, dob, weight, sex, feeding_instructions, medication_instructions, behavioral_notes, allergies)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        name.trim(),
        species.trim(),
        breed ? breed.trim() : 'Mixed Breed',
        dob || null,
        Number(weight) || null,
        sex || 'Unknown',
        feeding_instructions || '',
        medication_instructions || '',
        behavioral_notes || '',
        allergies || ''
      ]
    );

    const newPet = await get(`SELECT * FROM pets WHERE id = ?`, [result.lastID]);
    newPet.vaccinations = [];

    return res.status(201).json({ success: true, message: 'Pet registered successfully.', data: newPet });
  } catch (err) {
    console.error('Add pet error:', err);
    return res.status(500).json({ success: false, message: 'Failed to add pet profile.' });
  }
};

// PUT /api/pets/:id - Update pet profile
exports.updatePet = async (req, res) => {
  try {
    const pet = await get(`SELECT * FROM pets WHERE id = ?`, [req.params.id]);
    if (!pet) return res.status(404).json({ success: false, message: 'Pet not found.' });

    if (req.user.role === 'PET_OWNER' && pet.owner_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Cannot edit pet belonging to another customer.' });
    }

    const {
      name,
      species,
      breed,
      dob,
      weight,
      sex,
      feeding_instructions,
      medication_instructions,
      behavioral_notes,
      allergies
    } = req.body;

    const updatedName = name !== undefined ? name : pet.name;
    const updatedSpecies = species !== undefined ? species : pet.species;
    const updatedBreed = breed !== undefined ? breed : pet.breed;
    const updatedDob = dob !== undefined ? dob : pet.dob;
    const updatedWeight = weight !== undefined && weight !== '' ? Number(weight) : (weight === '' ? null : pet.weight);
    const updatedSex = sex !== undefined ? sex : pet.sex;
    const updatedFeeding = feeding_instructions !== undefined ? feeding_instructions : pet.feeding_instructions;
    const updatedMedication = medication_instructions !== undefined ? medication_instructions : pet.medication_instructions;
    const updatedBehavior = behavioral_notes !== undefined ? behavioral_notes : pet.behavioral_notes;
    const updatedAllergies = allergies !== undefined ? allergies : pet.allergies;

    await run(
      `UPDATE pets SET
        name = ?,
        species = ?,
        breed = ?,
        dob = ?,
        weight = ?,
        sex = ?,
        feeding_instructions = ?,
        medication_instructions = ?,
        behavioral_notes = ?,
        allergies = ?
       WHERE id = ?`,
      [
        updatedName,
        updatedSpecies,
        updatedBreed,
        updatedDob,
        updatedWeight,
        updatedSex,
        updatedFeeding,
        updatedMedication,
        updatedBehavior,
        updatedAllergies,
        req.params.id
      ]
    );

    const updated = await get(`SELECT * FROM pets WHERE id = ?`, [req.params.id]);
    return res.json({ success: true, message: 'Pet details updated.', data: updated, pet: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update pet.' });
  }
};

// DELETE /api/pets/:id - SRS Rule: Cannot delete pet with active, in-progress, or future booking
exports.deletePet = async (req, res) => {
  try {
    const pet = await get(`SELECT * FROM pets WHERE id = ?`, [req.params.id]);
    if (!pet) return res.status(404).json({ success: false, message: 'Pet not found.' });

    if (req.user.role === 'PET_OWNER' && pet.owner_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    // Check active bookings
    const activeBooking = await get(
      `SELECT id, status FROM bookings WHERE pet_id = ? AND status IN ('Pending', 'Confirmed', 'Checked-in', 'In Service')`,
      [req.params.id]
    );

    if (activeBooking) {
      return res.status(400).json({
        success: false,
        message: 'SRS Violation: Pet cannot be deleted because it has an active, confirmed, or in-service booking.'
      });
    }

    await run(`DELETE FROM pets WHERE id = ?`, [req.params.id]);
    return res.json({ success: true, message: 'Pet profile removed successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to delete pet.' });
  }
};

// POST /api/pets/:id/vaccinations - Add vaccination record
exports.addVaccination = async (req, res) => {
  try {
    const { vaccine_name, date_administered, expiration_date, document_url } = req.body;
    if (!vaccine_name || !expiration_date) {
      return res.status(400).json({ success: false, message: 'Vaccine name and expiration date are required.' });
    }

    const pet = await get(`SELECT * FROM pets WHERE id = ?`, [req.params.id]);
    if (!pet) return res.status(404).json({ success: false, message: 'Pet not found.' });

    if (req.user.role === 'PET_OWNER' && pet.owner_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    const result = await run(
      `INSERT INTO vaccinations (pet_id, vaccine_name, date_administered, expiration_date, document_url) VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, vaccine_name, date_administered || new Date().toISOString().split('T')[0], expiration_date, document_url || null]
    );

    const vac = await get(`SELECT * FROM vaccinations WHERE id = ?`, [result.lastID]);
    return res.status(201).json({ success: true, message: 'Vaccination record added.', data: vac });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to add vaccination record.' });
  }
};

// GET /api/pets/:id/vaccinations
exports.getVaccinations = async (req, res) => {
  try {
    const pet = await get(`SELECT * FROM pets WHERE id = ?`, [req.params.id]);
    if (!pet) return res.status(404).json({ success: false, message: 'Pet not found.' });

    if (req.user.role === 'PET_OWNER' && pet.owner_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    const vaccinations = await all(
      `SELECT * FROM vaccinations WHERE pet_id = ? ORDER BY expiration_date DESC`,
      [req.params.id]
    );

    const now = new Date().toISOString().split('T')[0];
    const hasActive = vaccinations.some(v => v.expiration_date >= now);

    return res.json({
      success: true,
      data: vaccinations,
      has_active_vaccine: hasActive
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve vaccinations.' });
  }
};

