const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');

const router = express.Router();

router.post('/', [
  body('name').trim().notEmpty().withMessage('Name required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('message').trim().notEmpty().withMessage('Message required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(422).json({ success: false, errors: errors.array() });

    const { name, email, phone, subject, message } = req.body;

    await db.query(
      'INSERT INTO contact_messages (name, email, phone, subject, message) VALUES ($1,$2,$3,$4,$5)',
      [name, email, phone || null, subject || null, message]
    );

    return res.status(201).json({
      success: true,
      message: 'Message received! We will get back to you soon.',
    });
  } catch (err) {
    console.error('Contact error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

module.exports = router;
