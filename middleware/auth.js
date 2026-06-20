const jwt = require('jsonwebtoken');

// ── User auth middleware ─────────────────────────────────────
const authUser = (req, res, next) => {
  const header = req.headers['authorization'];
  const token  = header && header.split(' ')[1];    // Bearer <token>
  if (!token) return res.status(401).json({ success: false, message: 'No token provided' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(403).json({ success: false, message: 'Invalid or expired token' });
  }
};

// ── Admin auth middleware ────────────────────────────────────
const authAdmin = (req, res, next) => {
  const header = req.headers['authorization'];
  const token  = header && header.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No admin token provided' });

  try {
    req.admin = jwt.verify(token, process.env.JWT_ADMIN_SECRET);
    next();
  } catch {
    return res.status(403).json({ success: false, message: 'Invalid or expired admin token' });
  }
};

// ── Superadmin-only guard ────────────────────────────────────
const requireSuperAdmin = (req, res, next) => {
  if (req.admin.role !== 'superadmin')
    return res.status(403).json({ success: false, message: 'Superadmin access required' });
  next();
};

module.exports = { authUser, authAdmin, requireSuperAdmin };
