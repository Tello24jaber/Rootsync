/**
 * RootSync Local Proxy
 * Sits between the test UI (browser) and n8n webhook to bypass CORS.
 * No npm install needed — uses only Node.js built-ins.
 *
 * Usage:  node proxy.js
 * Listens: http://localhost:3000
 */

const http  = require('http');
const https = require('https');
const url   = require('url');

// ─── Config ────────────────────────────────────────────────────────────────────
const PORT        = 3000;
const N8N_WEBHOOK = 'https://talaljaber.app.n8n.cloud/webhook/bot-test';
// ───────────────────────────────────────────────────────────────────────────────

const parsed = url.parse(N8N_WEBHOOK);

const server = http.createServer((req, res) => {
  // Allow all origins (this proxy is local-only)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Only proxy POST /
  if (req.method !== 'POST') {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    const options = {
      hostname: parsed.hostname,
      port:     443,
      path:     parsed.path,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const proxyReq = https.request(options, proxyRes => {
      let data = '';
      proxyRes.on('data', chunk => { data += chunk; });
      proxyRes.on('end', () => {
        res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
        res.end(data || '{}');
      });
    });

    proxyReq.on('error', err => {
      console.error('n8n request failed:', err.message);
      res.writeHead(502);
      res.end(JSON.stringify({ error: 'Could not reach n8n: ' + err.message }));
    });

    proxyReq.write(body);
    proxyReq.end();
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n✓ RootSync proxy running at http://localhost:${PORT}`);
  console.log(`  Forwarding → ${N8N_WEBHOOK}\n`);
  console.log('  Open test-ui/index.html in your browser.');
  console.log('  Press Ctrl+C to stop.\n');
});
