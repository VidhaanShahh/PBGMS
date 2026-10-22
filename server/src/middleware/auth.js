const jwt = require('jsonwebtoken');
const { get } = require('../config/sqliteDb');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pet_care_jwt_key_2026_production_change_this';

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.id) {
      return res.status(403).json({ success: false, message: 'Invalid authentication token.' });
    }

    // Load active user from database
    const user = await get(`SELECT id, name, email, phone, role, is_verified, notification_pref FROM users WHERE id = ?`, [decoded.id]);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User account no longer exists.' });
    }

    req.user = user;
    req.admin = user; // backwards compatibility with legacy routes
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Session expired or invalid token. Please log in again.' });
  }
}

// Role-based Access Control (RBAC) middleware generator
function requireRoles(...allowedRoles) {
  const flatRoles = allowedRoles.flat();
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    // SYSTEM_ADMIN and ADMIN have access to operational and administrative endpoints
    const role = req.user.role;
    if (flatRoles.includes(role) || (flatRoles.includes('ADMIN') && role === 'SYSTEM_ADMIN')) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Access denied. Role '${role}' lacks required permissions for this action.`
    });
  };
}

module.exports = {
  authenticate,
  authenticateAdmin: authenticate, // backwards compatibility
  requireRoles,
  requireRole: requireRoles,
  JWT_SECRET
};
