const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const petController = require('../controllers/petController');
const careLogController = require('../controllers/careLogController');
const { authenticate } = require('../middleware/auth');
const { get, run } = require('../config/sqliteDb');

// Configure safe disk storage for pet photos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.resolve(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `pet-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}${ext}`;
    cb(null, unique);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const extname = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowed.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only JPEG, PNG, and WebP images are allowed.'));
  }
});

router.use(authenticate);

router.get('/', petController.getMyPets);
router.post('/', petController.addPet);
router.get('/:id', petController.getPetById);
router.put('/:id', petController.updatePet);
router.delete('/:id', petController.deletePet);
router.get('/:id/vaccinations', petController.getVaccinations);
router.post('/:id/vaccinations', petController.addVaccination);
router.get('/:id/care-logs', careLogController.getPetCareLogs);

// POST /api/pets/:id/photo - Real file upload for pet photo
router.post('/:id/photo', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No photo uploaded.' });
    }

    const pet = await get(`SELECT id, owner_id FROM pets WHERE id = ?`, [req.params.id]);
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found.' });
    }

    if (req.user.role === 'PET_OWNER' && pet.owner_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    const photoUrl = `/uploads/${req.file.filename}`;
    await run(`UPDATE pets SET photo = ? WHERE id = ?`, [photoUrl, req.params.id]);

    return res.json({ success: true, message: 'Pet photo uploaded successfully.', photo: photoUrl });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to upload photo.' });
  }
});

module.exports = router;
