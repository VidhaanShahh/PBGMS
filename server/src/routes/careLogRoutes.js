const express = require('express');
const router = express.Router();
const careLogController = require('../controllers/careLogController');
const { authenticate, requireRoles } = require('../middleware/auth');

router.use(authenticate);

// GET /api/care-logs - Retrieve care logs (filtered by role and optional query params)
router.get('/', careLogController.getAllCareLogs);

// POST /api/care-logs - Create a shared care log record (Staff/Admin)
router.post(
  '/',
  requireRoles('ADMIN', 'SYSTEM_ADMIN', 'FRONT_DESK', 'BOARDING_ATTENDANT', 'GROOMER'),
  careLogController.createCareLog
);

module.exports = router;
