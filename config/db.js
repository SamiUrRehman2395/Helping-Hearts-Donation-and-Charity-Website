require('dotenv').config();
const { Pool } = require('pg');

// ── Connection setup ─────────────────────────────────────────
// Priority: DATABASE_URL (Supabase connection string)
//        → individual PG* vars
//        → localhost defaults (local Postgres)

let poolConfig;

if (process.env.DATABASE_URL) {
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost')
      ? false
      : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  };
  console.log('🔗  DB: using DATABASE_URL connection string');
} else {
  const isLocal = !process.env.PGHOST || process.env.PGHOST === 'localhost';
  poolConfig = {
    host:     process.env.PGHOST     || 'localhost',
    port:     parseInt(process.env.PGPORT || '5432'),
    user:     process.env.PGUSER     || 'postgres',
    password: process.env.PGPASSWORD || '',
    database: process.env.PGDATABASE || 'helping_hearts',
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  };
  console.log(`🔗  DB: ${isLocal ? 'localhost (local Postgres)' : process.env.PGHOST}`);
}

const pool = new Pool(poolConfig);

// Test connection — warn only, never crash the process
pool.connect()
  .then(client => {
    console.log('✅  PostgreSQL connected successfully');
    client.release();
  })
  .catch(err => {
    console.error('⚠️  PostgreSQL connection failed:', err.message);
    console.error('   Check DATABASE_URL or PGHOST/PGUSER/PGPASSWORD/PGDATABASE in .env');
  });

// ── Helper: mimic mysql2's [rows] destructure pattern ─────────
// so route files can do: const [rows] = await db.query(...)
// pg returns { rows, rowCount, ... } — we wrap it for compatibility
async function query(text, params) {
  const result = await pool.query(text, params);
  return [result.rows, result];
}

module.exports = { query, pool };
