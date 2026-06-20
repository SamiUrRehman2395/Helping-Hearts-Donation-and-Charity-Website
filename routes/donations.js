const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { authUser } = require('../middleware/auth');

const router = express.Router();

const normaliseFreq = (val) => {
  const map = {
    'one-time':'one-time', 'onetime':'one-time', 'one time':'one-time',
    'monthly':'monthly',
    'annually':'annually', 'annual':'annually', 'yearly':'annually', 'year':'annually',
  };
  return map[(val || 'one-time').toLowerCase()] || 'one-time';
};

// ── POST /api/donations  (requires login) ────────────────────
router.post('/', authUser, [
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
  body('donor_first_name').trim().notEmpty().withMessage('First name required'),
  body('donor_last_name').trim().notEmpty().withMessage('Last name required'),
  body('donor_email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('payment_method')
    .isIn(['card','easypaisa','jazzcash','bank','sadapay','crypto'])
    .withMessage('Invalid payment method'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(422).json({ success: false, errors: errors.array() });

    const {
      amount, currency = 'PKR', frequency: rawFreq,
      donor_first_name, donor_last_name, donor_email, donor_phone, donor_city,
      campaign_slug,
      is_dedicated = false, honoree_name, honoree_email, dedication_message,
      payment_method, transaction_ref, notes,
    } = req.body;

    const frequency = normaliseFreq(rawFreq);

    let campaign_id = null;
    if (campaign_slug) {
      const [camps] = await db.query(
        'SELECT id FROM campaigns WHERE slug = $1 AND is_active = TRUE', [campaign_slug]
      );
      if (camps.length > 0) campaign_id = camps[0].id;
    }

    const ip = req.headers['x-forwarded-for'] || req.ip || null;

    const [rows] = await db.query(
      `INSERT INTO donations
        (user_id, donor_first_name, donor_last_name, donor_email, donor_phone, donor_city,
         campaign_id, amount, currency, frequency,
         is_dedicated, honoree_name, honoree_email, dedication_message,
         payment_method, payment_status, transaction_ref, ip_address, notes)
       VALUES ($1,$2,$3,$4,$5,$6, $7,$8,$9,$10, $11,$12,$13,$14, $15,$16,$17,$18,$19)
       RETURNING id`,
      [
        req.user.id,
        donor_first_name, donor_last_name, donor_email, donor_phone || null, donor_city || null,
        campaign_id, amount, currency, frequency,
        is_dedicated ? true : false, honoree_name || null, honoree_email || null, dedication_message || null,
        payment_method, 'completed', transaction_ref || null, ip, notes || null,
      ]
    );

    if (campaign_id) {
      await db.query(
        'UPDATE campaigns SET raised_amount = raised_amount + $1 WHERE id = $2',
        [amount, campaign_id]
      );
    }

    return res.status(201).json({
      success: true,
      message: 'Donation recorded successfully! JazakAllah Khair',
      donation_id: rows[0].id,
    });
  } catch (err) {
    console.error('Donation error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error saving donation: ' + err.message });
  }
});

// ── GET /api/donations/my  — user's own donation history ─────
router.get('/my', authUser, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT d.id, d.amount, d.currency, d.frequency, d.payment_method,
              d.payment_status, d.transaction_ref, d.created_at,
              c.title AS campaign_title, c.slug AS campaign_slug
       FROM donations d
       LEFT JOIN campaigns c ON c.id = d.campaign_id
       WHERE d.user_id = $1
       ORDER BY d.created_at DESC`,
      [req.user.id]
    );
    return res.json({ success: true, donations: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/donations/campaigns — all active campaigns ──────
router.get('/campaigns', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, slug, title, description, goal_amount, raised_amount, image_url FROM campaigns WHERE is_active = TRUE ORDER BY id ASC'
    );
    return res.json({ success: true, campaigns: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
