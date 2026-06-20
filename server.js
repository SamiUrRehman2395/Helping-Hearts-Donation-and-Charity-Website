require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const path    = require('path');

const app = express();

// ── Security & logging ────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// ── CORS ──────────────────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET','POST','PATCH','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true,
}));

// ── Body parsing ──────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── API Routes (each wrapped so one bad route can't crash all) ─
try { app.use('/api/auth',      require('./routes/auth'));      } catch(e) { console.error('auth route load failed:', e.message); }
try { app.use('/api/donations', require('./routes/donations')); } catch(e) { console.error('donations route load failed:', e.message); }
try { app.use('/api/admin',     require('./routes/admin'));     } catch(e) { console.error('admin route load failed:', e.message); }
try { app.use('/api/contact',   require('./routes/contact'));   } catch(e) { console.error('contact route load failed:', e.message); }

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Helping Hearts API is running',
    timestamp: new Date(),
    env: {
      database_url_set: !!process.env.DATABASE_URL,
      pghost_set:        !!process.env.PGHOST,
      jwt_secret_set:    !!process.env.JWT_SECRET,
      jwt_admin_set:     !!process.env.JWT_ADMIN_SECRET,
    }
  });
});

// ── Serve static frontend files from /public ─────────────────
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// ── HTML page routes ──────────────────────────────────────────
['home','campaigns','contact','about','auth','donate','helpingheart','profile'].forEach(page => {
  app.get(`/${page}.html`, (req, res) => {
    res.sendFile(path.join(publicDir, `${page}.html`));
  });
});

// ── Admin panel — secret URL only, not linked anywhere ───────
const ADMIN_SECRET_PATH = process.env.ADMIN_SECRET_PATH || 'secure-admin-hh2024';

app.get(`/${ADMIN_SECRET_PATH}`, (req, res) => {
  res.sendFile(path.join(publicDir, 'admin.html'));
});

// Block direct access to /admin.html — 404 to anyone who guesses it
app.get('/admin.html', (req, res) => {
  res.status(404).sendFile(path.join(publicDir, 'helpingheart.html'));
});

// ── Root ──────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'helpingheart.html'));
});

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ── Local dev start (Vercel ignores this) ─────────────────────
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`\n🚀  http://localhost:${PORT}`);
    console.log(`📋  Admin: http://localhost:${PORT}/${ADMIN_SECRET_PATH}`);
    console.log(`❤️   Health: http://localhost:${PORT}/api/health\n`);
  });
}

module.exports = app;
