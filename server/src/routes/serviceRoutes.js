const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { authenticateAdmin } = require('../middleware/auth');

// Public
router.get('/', serviceController.getServices);
router.get('/:id', serviceController.getServiceById);

// Protected Admin Routes
router.post('/', authenticateAdmin, serviceController.createService);
router.put('/:id', authenticateAdmin, serviceController.updateService);
router.delete('/:id', authenticateAdmin, serviceController.deleteService);

module.exports = router;
