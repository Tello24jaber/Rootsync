const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const supabase = require('../lib/supabase');
const { uploadToSocial, SUPPORTED_SOCIAL_PLATFORMS } = require('../services/social');

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max
});

// ─── GET /api/leads ─────────────────────────────────────────────────────────
// Returns all leads sorted by urgency (needs_human first, then hot, then recent)
router.get('/leads', async (req, res) => {
  const { data, error } = await supabase
    .from('leads')
    .select('id, name, phone, primary_channel, lead_temperature, workflow_status, service_interest, health_topic, last_message, last_message_at, last_reply_at, recommended_next_action, handoff_required, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // Sort: needs_human first, then hot, then rest
  const priority = { needs_human: 0, hot: 1, cold: 2, not_interested: 3, unknown: 4 };
  const sorted = (data || []).sort((a, b) => {
    const aScore = a.workflow_status === 'needs_human' ? 0 : (priority[a.lead_temperature] ?? 4);
    const bScore = b.workflow_status === 'needs_human' ? 0 : (priority[b.lead_temperature] ?? 4);
    return aScore - bScore;
  });

  res.json(sorted);
});

// ─── GET /api/leads/:id ──────────────────────────────────────────────────────
router.get('/leads/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Lead not found' });
  res.json(data);
});

// ─── GET /api/leads/:id/messages ────────────────────────────────────────────
router.get('/leads/:id/messages', async (req, res) => {
  const { data, error } = await supabase
    .from('messages')
    .select('id, direction, message_type, text, responder_type, reply_type, send_status, created_at')
    .eq('lead_id', req.params.id)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// ─── DELETE /api/leads ──────────────────────────────────────────────────────
// Bulk delete leads (and their messages) by IDs.
// Body: { ids: [uuid, ...] }
router.delete('/leads', async (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids must be a non-empty array' });
  }
  // Delete all related data before deleting leads (FK order matters)
  await supabase.from('human_handoffs').delete().in('lead_id', ids);
  await supabase.from('messages').delete().in('lead_id', ids);
  await supabase.from('conversations').delete().in('lead_id', ids);
  const { error } = await supabase.from('leads').delete().in('id', ids);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ deleted: ids.length });
});

// ─── PATCH /api/leads/:id ────────────────────────────────────────────────────
// Used by the dashboard to manually stop/resume the AI agent for a lead.
// Body: { workflow_status: 'new' | 'needs_human' | 'human_active' | 'payment_link_sent' | 'booked' | 'converted' | 'lost' }
router.patch('/leads/:id', async (req, res) => {
  const allowed = ['new', 'needs_human', 'human_active', 'payment_link_sent', 'booked', 'converted', 'lost'];
  const { workflow_status } = req.body || {};
  if (!workflow_status || !allowed.includes(workflow_status)) {
    return res.status(400).json({ error: `workflow_status must be one of: ${allowed.join(', ')}` });
  }
  const { data, error } = await supabase
    .from('leads')
    .update({ workflow_status, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select('id, workflow_status')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── GET /api/stats ──────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  const { data, error } = await supabase
    .from('leads')
    .select('lead_temperature, workflow_status');

  if (error) return res.status(500).json({ error: error.message });

  const leads = data || [];
  res.json({
    total: leads.length,
    needs_human: leads.filter(l => ['needs_human', 'human_active'].includes(l.workflow_status)).length,
    hot: leads.filter(l => l.lead_temperature === 'hot').length,
    cold: leads.filter(l => l.lead_temperature === 'cold').length,
    not_interested: leads.filter(l => l.lead_temperature === 'not_interested').length,
  });
});

// ─── POST /api/social/post ───────────────────────────────────────────────────
// Accepts multipart/form-data: file (binary), title (string), platforms (JSON array string)
router.post('/social/post', upload.single('file'), async (req, res) => {
  console.log('[social/post] ── incoming request ──────────────────');
  console.log('[social/post] Content-Type:', req.headers['content-type']);
  console.log('[social/post] Body fields:', req.body);
  console.log('[social/post] File:', req.file
    ? `${req.file.originalname} (${req.file.size} bytes, ${req.file.mimetype}) → ${req.file.path}`
    : 'none');

  const { title, platforms: platformsRaw } = req.body || {};
  const file = req.file;

  if (!file) {
    console.warn('[social/post] Rejected: no file received');
    return res.status(400).json({ error: 'Missing file' });
  }
  if (!title) {
    console.warn('[social/post] Rejected: no title');
    return res.status(400).json({ error: 'Missing title field' });
  }

  // Give the temp file the correct extension so upload-post can detect mime type
  const ext = path.extname(file.originalname) || '';
  const filePath = file.path + ext;
  fs.renameSync(file.path, filePath);
  console.log('[social/post] Temp file renamed to:', filePath);

  let platforms = ['instagram'];
  try {
    if (platformsRaw) platforms = JSON.parse(platformsRaw);
  } catch (_) {
    return res.status(400).json({
      error: 'Invalid platforms format. Expected a JSON array string, e.g. ["instagram","tiktok"]'
    });
  }

  if (!Array.isArray(platforms) || !platforms.length) {
    return res.status(400).json({
      error: 'platforms must be a non-empty array',
      supported_platforms: SUPPORTED_SOCIAL_PLATFORMS,
      planned_later: ['youtube_shorts', 'threads']
    });
  }

  const normalizedPlatforms = [...new Set(platforms.map(p => String(p || '').trim().toLowerCase()).filter(Boolean))];
  const unsupported = normalizedPlatforms.filter(p => !SUPPORTED_SOCIAL_PLATFORMS.includes(p));
  if (unsupported.length) {
    return res.status(400).json({
      error: `Unsupported platforms: ${unsupported.join(', ')}`,
      supported_platforms: SUPPORTED_SOCIAL_PLATFORMS,
      planned_later: ['youtube_shorts', 'threads']
    });
  }

  console.log('[social/post] Platforms:', platforms);
  console.log('[social/post] Title:', title);

  try {
    console.log('[social/post] Calling uploadToSocial…');
    const result = await uploadToSocial(filePath, { title, platforms: normalizedPlatforms });
    console.log('[social/post] ✓ Success:', JSON.stringify(result));
    res.json({ success: true, result });
  } catch (err) {
    console.error('[social/post] ✗ Error:', err.message);
    console.error(err.stack);
    res.status(500).json({ error: err.message });
  } finally {
    fs.unlink(filePath, () => console.log('[social/post] Temp file cleaned up'));
  }
});

// ─── GET /api/social/status?request_id=xxx ───────────────────────────────────
// Proxies status check to upload-post.com to avoid CORS in the browser
router.get('/social/status', (req, res) => {
  const { request_id } = req.query;
  if (!request_id) return res.status(400).json({ error: 'Missing request_id' });

  const apiKey = process.env.UPLOAD_POST_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'UPLOAD_POST_API_KEY environment variable is not set' });
  }

  const options = {
    hostname: 'api.upload-post.com',
    path: `/api/uploadposts/status?request_id=${encodeURIComponent(request_id)}`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    },
  };

  const proxyReq = https.request(options, proxyRes => {
    let data = '';
    proxyRes.on('data', chunk => { data += chunk; });
    proxyRes.on('end', () => {
      if (proxyRes.statusCode !== 200) {
        console.warn(`[social/status] Upstream returned ${proxyRes.statusCode} for request_id=${request_id}:`, data);
      }
      res.status(proxyRes.statusCode).setHeader('Content-Type', 'application/json').end(data);
    });
  });
  proxyReq.on('error', err => res.status(500).json({ error: err.message }));
  proxyReq.end();
});

module.exports = router;
