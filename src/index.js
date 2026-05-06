require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const AUTO_OPEN_BROWSER = String(process.env.AUTO_OPEN_BROWSER || 'false').toLowerCase() === 'true';

app.use(cors());
app.use(express.json());

// ─── API routes ─────────────────────────────────────────────────────────────
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// ─── Demo message route (test UI) ───────────────────────────────────────────
const demoRoutes = require('./routes/demo');
app.use('/', demoRoutes);

// ─── Health check ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ ok: true, service: 'rootsync-system1' }));

// ─── Serve agent dashboard at /dashboard ────────────────────────────────────
app.use('/dashboard', express.static(path.join(__dirname, '../dashboard')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, '../dashboard/index.html')));

// ─── Serve test UI at root ──────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../test-ui')));
app.get('/favicon.ico', (req, res) => res.status(204).end());

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}/`;
  console.log(`RootSync System 1 running on http://localhost:${PORT}`);
  if (AUTO_OPEN_BROWSER) {
    console.log(`Opening browser → ${url}`);
    exec(`start ${url}`, err => { if (err) console.warn('Could not auto-open browser:', err.message); });
  } else {
    console.log('Browser auto-open disabled (set AUTO_OPEN_BROWSER=true to enable)');
  }
});
