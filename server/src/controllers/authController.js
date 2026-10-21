const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { get, run, all } = require('../config/sqliteDb');
const { JWT_SECRET } = require('../middleware/auth');

exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, notification_pref } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Full name is required.' });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    // Password validation (min 6 chars)
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    // Notification preference validation
    const validPrefs = ['both', 'email', 'sms'];
    const chosenPref = validPrefs.includes(notification_pref) ? notification_pref : 'both';

    // Public registration ALWAYS assigns PET_OWNER to prevent privilege escalation
    const role = 'PET_OWNER';

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await get(`SELECT id FROM users WHERE email = ?`, [normalizedEmail]);
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email address already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await run(
      `INSERT INTO users (name, email, phone, password, role, is_verified, notification_pref) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name.trim(), normalizedEmail, phone ? phone.trim() : '', hashedPassword, role, 1, chosenPref]
    );

    const token = jwt.sign(
      { id: result.lastID, email: email.toLowerCase().trim(), role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Record welcome notification
    await run(
      `INSERT INTO notifications (user_id, channel, type, title, message) VALUES (?, ?, ?, ?, ?)`,
      [result.lastID, chosenPref, 'Confirmation', 'Welcome to PBGMS India', `Welcome ${name}! Your Pet Boarding and Grooming account has been activated.`]
    );

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      token,
      user: {
        id: result.lastID,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone || '',
        role,
        is_verified: 1,
        notification_pref
      }
    });
  } catch (err) {
    console.error('Registration Error:', err);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const identifier = (email || username || '').toLowerCase().trim();

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Email/username and password are required.' });
    }

    // Lookup user by email or name/username
    let user = await get(`SELECT * FROM users WHERE email = ?`, [identifier]);
    if (!user && identifier === 'admin') {
      user = await get(`SELECT * FROM users WHERE email = 'admin@pbgms.in'`);
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. User not found.' });
    }

    // Check account lockout per SRS Section 3.1 Account.Login (15 minutes after 5 consecutive failures)
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remainingMinutes = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(429).json({
        success: false,
        message: `Account is locked due to 5 consecutive failed login attempts. Please try again in ${remainingMinutes} minute(s).`
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      const newAttempts = (user.failed_attempts || 0) + 1;
      let lockSql = `UPDATE users SET failed_attempts = ? WHERE id = ?`;
      let lockParams = [newAttempts, user.id];

      if (newAttempts >= 5) {
        const lockoutTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        lockSql = `UPDATE users SET failed_attempts = 0, locked_until = ? WHERE id = ?`;
        lockParams = [lockoutTime, user.id];
      }

      await run(lockSql, lockParams);

      return res.status(401).json({
        success: false,
        message: newAttempts >= 5
          ? 'Maximum login attempts exceeded. Account is locked for 15 minutes.'
          : `Invalid password. Attempt ${newAttempts} of 5 before 15-min lockout.`
      });
    }

    // Reset failed attempts on success
    await run(`UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?`, [user.id]);

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        is_verified: user.is_verified,
        notification_pref: user.notification_pref
      },
      admin: {
        id: user.id,
        username: user.email === 'admin@pbgms.in' ? 'admin' : user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

exports.getMe = async (req, res) => {
  return res.json({
    success: true,
    user: req.user
  });
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, notification_pref } = req.body;
    await run(
      `UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), notification_pref = COALESCE(?, notification_pref) WHERE id = ?`,
      [name, phone, notification_pref, req.user.id]
    );

    const updated = await get(`SELECT id, name, email, phone, role, is_verified, notification_pref FROM users WHERE id = ?`, [req.user.id]);
    return res.json({ success: true, message: 'Profile updated successfully.', user: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
};

exports.getAllStaff = async (req, res) => {
  try {
    const staff = await all(`SELECT id, name, email, phone, role, created_at FROM users WHERE role != 'PET_OWNER' ORDER BY role ASC`);
    return res.json({ success: true, data: staff });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve staff list.' });
  }
};
