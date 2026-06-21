const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db       = require('../config/db');
const { authAdmin, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();

// ── POST /api/admin/login ────────────────────────────────────
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(422).json({ success: false, errors: errors.array() });

    const { email, password } = req.body;

    const [rows] = await db.query('SELECT * FROM admins WHERE email = $1', [email]);
    if (rows.length === 0)
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const admin = rows[0];
    if (!admin.is_active)
      return res.status(403).json({ success: false, message: 'Account deactivated' });

    const match = await bcrypt.compare(password, admin.password);
    if (!match)
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    await db.query('UPDATE admins SET last_login = NOW() WHERE id = $1', [admin.id]);

    const token = jwt.sign(
      { id: admin.id, email: admin.email, username: admin.username, role: admin.role },
      process.env.JWT_ADMIN_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      success: true,
      message: 'Admin login successful',
      token,
      admin: { id: admin.id, username: admin.username, email: admin.email, role: admin.role },
    });
  } catch (err) {
    console.error('Admin login error:', err.message);
    return res.status(500).json({ success: false, message: err.message, code: err.code || null });
  }
});

// ── GET /api/admin/dashboard ─────────────────────────────────
router.get('/dashboard', authAdmin, async (req, res) => {
  try {
    const [totalsRows] = await db.query(`
      SELECT
        COUNT(*)                                                              AS total_donations,
        COALESCE(SUM(amount), 0)                                             AS total_amount,
        COUNT(DISTINCT donor_email)                                          AS unique_donors,
        COALESCE(SUM(CASE WHEN payment_status='completed' THEN amount END), 0) AS confirmed_amount
      FROM donations
    `);
    const totals = totalsRows[0] || { total_donations:0, total_amount:0, unique_donors:0, confirmed_amount:0 };

    const [usersRows] = await db.query('SELECT COUNT(*) AS total_users FROM users');
    const users = usersRows[0];

    const [byCampaign] = await db.query(`
      SELECT c.title, COUNT(d.id) AS donation_count,
             COALESCE(SUM(d.amount),0) AS total_raised, c.goal_amount
      FROM campaigns c
      LEFT JOIN donations d ON d.campaign_id = c.id AND d.payment_status='completed'
      GROUP BY c.id, c.title, c.goal_amount ORDER BY total_raised DESC
    `);
    const [byMethod] = await db.query(`
      SELECT payment_method, COUNT(*) AS count, COALESCE(SUM(amount),0) AS total
      FROM donations GROUP BY payment_method
    `);
    const [recent] = await db.query(`
      SELECT d.id, d.donor_first_name, d.donor_last_name, d.donor_email,
             d.amount, d.currency, d.payment_method, d.payment_status, d.created_at,
             c.title AS campaign
      FROM donations d
      LEFT JOIN campaigns c ON c.id = d.campaign_id
      ORDER BY d.created_at DESC LIMIT 10
    `);
    return res.json({
      success: true,
      stats: { ...totals, total_users: users.total_users },
      byCampaign, byMethod, recentDonations: recent,
    });
  } catch (err) {
    console.error('Dashboard error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/admin/donations ─────────────────────────────────
router.get('/donations', authAdmin, async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search}%` : null;
    const status = req.query.status || null;
    const method = req.query.method || null;

    let where  = 'WHERE 1=1';
    const params = [];
    let i = 1;
    if (search) {
      where += ` AND (d.donor_email ILIKE $${i} OR d.donor_first_name ILIKE $${i+1} OR d.donor_last_name ILIKE $${i+2} OR d.transaction_ref ILIKE $${i+3})`;
      params.push(search, search, search, search); i += 4;
    }
    if (status) { where += ` AND d.payment_status = $${i}`; params.push(status); i++; }
    if (method) { where += ` AND d.payment_method = $${i}`; params.push(method); i++; }

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total FROM donations d ${where}`, params
    );
    const total = parseInt(countRows[0].total);

    const [rows] = await db.query(
      `SELECT d.*, c.title AS campaign_title, u.first_name AS user_first, u.last_name AS user_last
       FROM donations d
       LEFT JOIN campaigns c ON c.id = d.campaign_id
       LEFT JOIN users u ON u.id = d.user_id
       ${where} ORDER BY d.created_at DESC LIMIT $${i} OFFSET $${i+1}`,
      [...params, limit, offset]
    );
    return res.json({ success: true, total, page, limit, donations: rows });
  } catch (err) {
    console.error('Admin donations error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── PATCH /api/admin/donations/:id/status ────────────────────
router.patch('/donations/:id/status', authAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending','completed','failed','refunded'].includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status' });
    await db.query('UPDATE donations SET payment_status=$1 WHERE id=$2', [status, req.params.id]);
    return res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  USERS — view, add, edit, ban, delete
// ════════════════════════════════════════════════════════════

// ── GET /api/admin/users ─────────────────────────────────────
router.get('/users', authAdmin, async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const [countRows] = await db.query('SELECT COUNT(*) AS total FROM users');
    const total = parseInt(countRows[0].total);

    const [rows] = await db.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.avatar_url, u.is_active, u.created_at,
              COUNT(d.id) AS total_donations, COALESCE(SUM(d.amount),0) AS total_donated
       FROM users u
       LEFT JOIN donations d ON d.user_id = u.id
       GROUP BY u.id ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return res.json({ success: true, total, page, limit, users: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/admin/users — admin manually adds a user ───────
router.post('/users', authAdmin, [
  body('first_name').trim().notEmpty(),
  body('last_name').trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(422).json({ success: false, errors: errors.array() });

    const { first_name, last_name, email, phone, password } = req.body;
    const [existing] = await db.query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.length > 0)
      return res.status(409).json({ success: false, message: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 12);
    const [rows] = await db.query(
      `INSERT INTO users (first_name,last_name,email,phone,password)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, first_name, last_name, email, phone, created_at`,
      [first_name, last_name, email, phone || null, hashed]
    );
    return res.status(201).json({ success: true, message: 'User created', user: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── PATCH /api/admin/users/:id/status — ban/unban (superadmin) ─
router.patch('/users/:id/status', authAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const { is_active } = req.body;
    await db.query('UPDATE users SET is_active=$1 WHERE id=$2', [is_active ? true : false, req.params.id]);
    return res.json({ success: true, message: 'User status updated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/admin/users/:id — remove user (superadmin) ───
router.delete('/users/:id', authAdmin, requireSuperAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    return res.json({ success: true, message: 'User removed' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  CAMPAIGNS — view, add, edit, remove
// ════════════════════════════════════════════════════════════

// ── GET /api/admin/campaigns ──────────────────────────────────
router.get('/campaigns', authAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.*, COUNT(d.id) AS donation_count
       FROM campaigns c
       LEFT JOIN donations d ON d.campaign_id = c.id
       GROUP BY c.id ORDER BY c.created_at DESC`
    );
    return res.json({ success: true, campaigns: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/admin/campaigns — add a new campaign ────────────
router.post('/campaigns', authAdmin, [
  body('slug').trim().notEmpty().matches(/^[a-z0-9-]+$/).withMessage('Slug must be lowercase letters, numbers, hyphens only'),
  body('title').trim().notEmpty(),
  body('goal_amount').isFloat({ gt: 0 }).withMessage('Goal amount must be greater than 0'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(422).json({ success: false, errors: errors.array() });

    const { slug, title, description, goal_amount, image_url } = req.body;

    const [existing] = await db.query('SELECT id FROM campaigns WHERE slug=$1', [slug]);
    if (existing.length > 0)
      return res.status(409).json({ success: false, message: 'A campaign with this slug already exists' });

    const [rows] = await db.query(
      `INSERT INTO campaigns (slug, title, description, goal_amount, image_url)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [slug, title, description || null, goal_amount, image_url || null]
    );
    return res.status(201).json({ success: true, message: 'Campaign created', campaign: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── PATCH /api/admin/campaigns/:id — edit a campaign ──────────
router.patch('/campaigns/:id', authAdmin, async (req, res) => {
  try {
    const { title, description, goal_amount, image_url, is_active } = req.body;
    const fields = []; const values = []; let i = 1;

    if (title       !== undefined) { fields.push(`title = $${i++}`);        values.push(title); }
    if (description  !== undefined) { fields.push(`description = $${i++}`);  values.push(description); }
    if (goal_amount  !== undefined) { fields.push(`goal_amount = $${i++}`);   values.push(goal_amount); }
    if (image_url    !== undefined) { fields.push(`image_url = $${i++}`);    values.push(image_url); }
    if (is_active    !== undefined) { fields.push(`is_active = $${i++}`);    values.push(is_active); }

    if (fields.length === 0)
      return res.status(400).json({ success: false, message: 'No fields to update' });

    values.push(req.params.id);
    const [rows] = await db.query(
      `UPDATE campaigns SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: 'Campaign not found' });

    return res.json({ success: true, message: 'Campaign updated', campaign: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/admin/campaigns/:id — remove a campaign ───────
router.delete('/campaigns/:id', authAdmin, async (req, res) => {
  try {
    const [rows] = await db.query('DELETE FROM campaigns WHERE id=$1 RETURNING id', [req.params.id]);
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    return res.json({ success: true, message: 'Campaign removed' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  MESSAGES
// ════════════════════════════════════════════════════════════

router.get('/messages', authAdmin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM contact_messages ORDER BY created_at DESC');
    const [unreadRows] = await db.query('SELECT COUNT(*) AS unread FROM contact_messages WHERE is_read = FALSE');
    return res.json({ success: true, messages: rows, unread: parseInt(unreadRows[0].unread) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/messages/:id/read', authAdmin, async (req, res) => {
  try {
    await db.query('UPDATE contact_messages SET is_read = TRUE WHERE id=$1', [req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/messages/:id', authAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM contact_messages WHERE id=$1', [req.params.id]);
    return res.json({ success: true, message: 'Message deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/admin/change-password ──────────────────────────
router.post('/change-password', authAdmin, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password || new_password.length < 8)
      return res.status(400).json({ success: false, message: 'Invalid input' });
    const [rows] = await db.query('SELECT * FROM admins WHERE id=$1', [req.admin.id]);
    const match  = await bcrypt.compare(current_password, rows[0].password);
    if (!match)
      return res.status(401).json({ success: false, message: 'Current password incorrect' });
    const hashed = await bcrypt.hash(new_password, 12);
    await db.query('UPDATE admins SET password=$1 WHERE id=$2', [hashed, req.admin.id]);
    return res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
