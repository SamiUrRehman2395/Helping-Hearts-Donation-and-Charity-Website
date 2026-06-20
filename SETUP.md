# Helping Hearts — Setup Guide (PostgreSQL + Supabase)

## ── PART 1: Get a Supabase Database (free) ────────────────

1. Go to https://supabase.com → Sign up / Login with GitHub
2. Click **New Project**
   - Name: `helping-hearts`
   - Database Password: choose a strong password — **save it somewhere**, you'll need it
   - Region: pick the closest to you
3. Wait ~2 minutes for the project to finish provisioning

### Import the schema
1. In your Supabase project, click **SQL Editor** (left sidebar)
2. Click **New Query**
3. Open `database.sql` from this project, copy ALL of it
4. Paste into the SQL Editor → click **Run** (or Ctrl+Enter)
5. You should see "Success. No rows returned"
6. Verify: click **Table Editor** (left sidebar) — you should see 5 tables:
   `users`, `campaigns`, `donations`, `admins`, `contact_messages`
7. Click `campaigns` table — you should see 7 rows already there
8. Click `admins` table — you should see 1 row (the default superadmin)

### Get your connection string
1. Click the **Connect** button (top of dashboard, or Project Settings → Database)
2. Under "Connection string" choose the **URI** tab
3. Copy the string — looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
   ```
4. Replace `[YOUR-PASSWORD]` with the database password you set in step 2

---

## ── PART 2: Run Locally ────────────────────────────────────

1. Open `.env` in this project
2. Comment out the `PGHOST/PGUSER/...` lines
3. Uncomment `DATABASE_URL=` and paste your Supabase connection string
4. Install and run:
   ```bash
   npm install
   node server.js
   ```
5. Open browser:
   - Site: http://localhost:5000
   - Admin: http://localhost:5000/secure-admin-hh2024
   - Health check: http://localhost:5000/api/health

### Admin login
```
Email:    admin@helpinghearts.org
Password: Admin@1234
```

---

## ── PART 3: Deploy to Vercel ───────────────────────────────

1. Go to https://vercel.com → New Project
2. Upload this project folder (or connect via GitHub)
3. Framework Preset: **Other**
4. Build Command: **leave blank**
5. Install Command: `npm install`

### Add Environment Variables
Go to: Project → Settings → Environment Variables

| Key | Value |
|-----|-------|
| `DATABASE_URL` | your full Supabase connection string |
| `JWT_SECRET` | any long random string |
| `JWT_ADMIN_SECRET` | another long random string (different from above) |
| `JWT_EXPIRES_IN` | `7d` |
| `ADMIN_SECRET_PATH` | your own secret word for the admin URL |

6. Click **Deploy**
7. Visit `https://your-site.vercel.app/api/health` — should show `database_url_set: true`

---

## ── What's included ─────────────────────────────────────────

### User features
- Sign up → creates account + profile instantly
- Login → stays signed in across sessions (JWT in localStorage), no re-login needed until logout
- Profile page: name, email, phone, profile picture (via image URL), member since date
- Edit profile (name/phone) and change picture anytime — separate from signup
- Full donation history with status, amount, campaign, payment method
- Logout button — clears session

### Admin features (at your secret URL)
- Dashboard with live stats
- **Add / remove campaigns** — full CRUD with title, description, goal, image
- **Add / remove users** — admin can manually create accounts or delete them
- Ban/unban users (superadmin only)
- View & filter all donations, update payment status
- Read & manage contact messages
- Two roles: superadmin (full access) and moderator (limited)

---

## ── Common Errors ──────────────────────────────────────────

| Error | Fix |
|-------|-----|
| `PostgreSQL connection failed: password authentication failed` | Wrong password in `DATABASE_URL` |
| `relation "users" does not exist` | `database.sql` not run yet — go to Supabase SQL Editor and run it |
| `FUNCTION_INVOCATION_FAILED` on Vercel | Missing `DATABASE_URL` in Vercel env vars |
| `Service temporarily unavailable` | DB connection issue — check Supabase project isn't paused |
| `Invalid credentials` on admin login | `database.sql` seed data wasn't inserted — re-run it |

**Note:** Free Supabase projects pause after 1 week of inactivity. Just visit the dashboard to wake it up if your site stops responding.
