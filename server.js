const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.APP_PASSWORD || 'freeport2024';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'freeportadmin2024';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Staff and admin can read
function auth(req, res, next) {
  const p = req.headers['x-password'];
  if (p === PASSWORD || p === ADMIN_PASSWORD) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// Only admin can write
function adminAuth(req, res, next) {
  if (req.headers['x-password'] === ADMIN_PASSWORD) return next();
  res.status(403).json({ error: 'Admin access required' });
}

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      bed_id    TEXT PRIMARY KEY,
      name      TEXT,
      sex       TEXT,
      age       TEXT,
      substance TEXT,
      intake_date TEXT,
      exit_date   TEXT,
      notes     TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS waitlist (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      sex        TEXT,
      age        TEXT,
      substance  TEXT,
      notes      TEXT,
      room_id    TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS virtual_clients (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      course     TEXT,
      counsellor TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS family_support (
      id                 SERIAL PRIMARY KEY,
      name               TEXT NOT NULL,
      client_association TEXT,
      therapist          TEXT,
      connected          TEXT DEFAULT 'Pending',
      created_at         TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS incoming_clients (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS incoming_checklist (
      id         SERIAL PRIMARY KEY,
      client_id  INTEGER NOT NULL,
      task_key   TEXT NOT NULL,
      task_label TEXT,
      completed  BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(client_id, task_key)
    );
  `);
  console.log('Database ready');
}

// --- Clients ---

app.get('/api/clients', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM clients');
    const result = {};
    rows.forEach(r => {
      result[r.bed_id] = {
        name: r.name, sex: r.sex, age: r.age,
        substance: r.substance, intake: r.intake_date,
        exit: r.exit_date, notes: r.notes,
      };
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/clients/:bedId', adminAuth, async (req, res) => {
  const { bedId } = req.params;
  const { name, sex, age, substance, intake, exit, notes } = req.body;
  try {
    if (!name) {
      await pool.query('DELETE FROM clients WHERE bed_id = $1', [bedId]);
    } else {
      await pool.query(`
        INSERT INTO clients (bed_id, name, sex, age, substance, intake_date, exit_date, notes, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
        ON CONFLICT (bed_id) DO UPDATE SET
          name=$2, sex=$3, age=$4, substance=$5,
          intake_date=$6, exit_date=$7, notes=$8, updated_at=NOW()
      `, [bedId, name, sex, age, substance, intake, exit, notes]);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Waitlist ---

app.get('/api/waitlist', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM waitlist ORDER BY created_at ASC');
    res.json(rows.map(r => ({
      id: r.id, name: r.name, sex: r.sex, age: r.age,
      substance: r.substance, notes: r.notes, room: r.room_id,
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/waitlist', adminAuth, async (req, res) => {
  const { name, sex, age, substance, notes, room } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO waitlist (name,sex,age,substance,notes,room_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [name, sex||null, age||null, substance||null, notes||null, room||null]
    );
    res.json({ id: rows[0].id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/waitlist/:id', adminAuth, async (req, res) => {
  const { name, sex, age, substance, notes, room } = req.body;
  try {
    await pool.query(
      'UPDATE waitlist SET name=$1, sex=$2, age=$3, substance=$4, notes=$5, room_id=$6 WHERE id=$7',
      [name, sex||null, age||null, substance||null, notes||null, room||null, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/waitlist/:id', adminAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM waitlist WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Virtual clients ---

app.get('/api/virtual', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM virtual_clients ORDER BY created_at ASC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/virtual', adminAuth, async (req, res) => {
  const { name, course, counsellor } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO virtual_clients (name,course,counsellor) VALUES ($1,$2,$3) RETURNING id',
      [name, course||null, counsellor||null]
    );
    res.json({ id: rows[0].id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/virtual/:id', adminAuth, async (req, res) => {
  const { name, course, counsellor } = req.body;
  try {
    await pool.query(
      'UPDATE virtual_clients SET name=COALESCE($1,name), course=$2, counsellor=$3 WHERE id=$4',
      [name||null, course||null, counsellor||null, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/virtual/:id', adminAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM virtual_clients WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Family support ---

app.get('/api/family', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM family_support ORDER BY created_at ASC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/family', adminAuth, async (req, res) => {
  const { name, client_association, therapist, connected } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO family_support (name,client_association,therapist,connected) VALUES ($1,$2,$3,$4) RETURNING id',
      [name, client_association||null, therapist||null, connected||'Pending']
    );
    res.json({ id: rows[0].id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/family/:id', adminAuth, async (req, res) => {
  const { name, client_association, therapist, connected } = req.body;
  try {
    await pool.query(
      'UPDATE family_support SET name=COALESCE($1,name), client_association=$2, therapist=$3, connected=$4 WHERE id=$5',
      [name||null, client_association||null, therapist||null, connected||'Pending', req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/family/:id', adminAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM family_support WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Incoming clients ---

app.get('/api/incoming', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT ic.id, ic.name, ic.created_at,
        COALESCE((SELECT COUNT(*) FROM incoming_checklist WHERE client_id=ic.id AND completed=true AND task_key NOT LIKE 'custom_%'),0)::int AS std_done,
        COALESCE((SELECT COUNT(*) FROM incoming_checklist WHERE client_id=ic.id AND completed=true AND task_key LIKE 'custom_%'),0)::int AS custom_done,
        COALESCE((SELECT COUNT(*) FROM incoming_checklist WHERE client_id=ic.id AND task_key LIKE 'custom_%'),0)::int AS custom_total
      FROM incoming_clients ic ORDER BY ic.created_at ASC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/incoming', adminAuth, async (req, res) => {
  const { name } = req.body;
  try {
    const { rows } = await pool.query('INSERT INTO incoming_clients (name) VALUES ($1) RETURNING id', [name]);
    res.json({ id: rows[0].id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/incoming/:id', adminAuth, async (req, res) => {
  const { name } = req.body;
  try {
    await pool.query('UPDATE incoming_clients SET name=$1 WHERE id=$2', [name, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/incoming/:id', adminAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM incoming_checklist WHERE client_id=$1', [req.params.id]);
    await pool.query('DELETE FROM incoming_clients WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/incoming/:id/checklist', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM incoming_checklist WHERE client_id=$1 ORDER BY created_at ASC', [req.params.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/incoming/:id/checklist', auth, async (req, res) => {
  const { task_key, task_label, completed } = req.body;
  try {
    const { rows } = await pool.query(`
      INSERT INTO incoming_checklist (client_id, task_key, task_label, completed)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (client_id, task_key) DO UPDATE SET completed=$4
      RETURNING id
    `, [req.params.id, task_key, task_label||null, completed===true||completed==='true']);
    res.json({ id: rows[0].id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/incoming/:clientId/checklist/:taskId', adminAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM incoming_checklist WHERE id=$1 AND client_id=$2', [req.params.taskId, req.params.clientId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Verify password endpoint — returns role so frontend can adjust UI
app.post('/api/auth', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) res.json({ ok: true, role: 'admin' });
  else if (password === PASSWORD) res.json({ ok: true, role: 'staff' });
  else res.status(401).json({ error: 'Wrong password' });
});

initDB()
  .then(() => app.listen(PORT, () => console.log(`Freeport bed map running on port ${PORT}`)))
  .catch(err => { console.error('DB init failed:', err); process.exit(1); });
