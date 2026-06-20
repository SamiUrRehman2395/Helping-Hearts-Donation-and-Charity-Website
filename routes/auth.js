const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db       = require('../config/db');
const { authUser } = require('../middleware/auth');

const router = express.Router();

// ── POST /api/auth/signup ────────────────────────────────────
router.post('/signup', [
  body('first_name').trim().notEmpty().withMessage('First name required'),
  body('last_name').trim().notEmpty().withMessage('Last name required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('phone').optional().trim(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(422).json({ success: false, errors: errors.array() });

    const { first_name, last_name, email, phone, password } = req.body;

    const [existing] = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.length > 0)
      return res.status(409).json({ success: false, message: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 12);
    const [rows] = await db.query(
      `INSERT INTO users (first_name, last_name, email, phone, password)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, first_name, last_name, email, phone, created_at`,
      [first_name, last_name, email, phone || null, hashed]
    );
    const newUser = rows[0];

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, first_name: newUser.first_name, last_name: newUser.last_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: newUser,
    });
  } catch (err) {
    console.error('Signup error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Signup failed: ' + err.message,
      code: err.code || null,
    });
  }
});

// ── POST /api/auth/login ─────────────────────────────────────
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(422).json({ success: false, errors: errors.array() });

    const { email, password } = req.body;

    const [rows] = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (rows.length === 0)
      return res.status(401).json({ success: false, message: 'Invalid email or password' });

    const user = rows[0];
    if (!user.is_active)
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact support.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ success: false, message: 'Invalid email or password' });

    const token = jwt.sign(
      { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id:         user.id,
        first_name: user.first_name,
        last_name:  user.last_name,
        email:      user.email,
        phone:      user.phone,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Login failed: ' + err.message,
      code: err.code || null,
    });
  }
});

// ── GET /api/auth/me  (requires login token) ─────────────────
router.get('/me', authUser, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, first_name, last_name, email, phone, avatar_url, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: 'User not found' });

    return res.json({ success: true, user: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── PATCH /api/auth/me — update profile (name, phone, avatar) ─
router.patch('/me', authUser, [
  body('first_name').optional().trim().notEmpty(),
  body('last_name').optional().trim().notEmpty(),
  body('phone').optional().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(422).json({ success: false, errors: errors.array() });

    const { first_name, last_name, phone, avatar_url } = req.body;
    const fields = [];
    const values = [];
    let i = 1;

    if (first_name !== undefined) { fields.push(`first_name = $${i++}`); values.push(first_name); }
    if (last_name  !== undefined) { fields.push(`last_name = $${i++}`);  values.push(last_name); }
    if (phone      !== undefined) { fields.push(`phone = $${i++}`);      values.push(phone); }
    if (avatar_url !== undefined) { fields.push(`avatar_url = $${i++}`); values.push(avatar_url); }

    if (fields.length === 0)
      return res.status(400).json({ success: false, message: 'No fields to update' });

    values.push(req.user.id);
    const [rows] = await db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${i}
       RETURNING id, first_name, last_name, email, phone, avatar_url, created_at`,
      values
    );

    return res.json({ success: true, message: 'Profile updated', user: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
