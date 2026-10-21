const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateAdmin } = require('../middleware/auth');

router.get('/stats', authenticateAdmin, dashboardController.getStats);

module.exports = router;
