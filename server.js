const express = require('express');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;
const KEY  = process.env.ANTHROPIC_API_KEY;

// ── Middleware ──────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// Allow any github.io domain, localhost, file://
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (
      origin.endsWith('.github.io') ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('https://localhost')
    ) return cb(null, true);
    cb(new Error('CORS blocked: ' + origin));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

// ── Health check ────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'DealDesk proxy running', time: new Date().toISOString() });
});

// ── Proxy endpoint ──────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  if (!KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set on server.' });
  }

  const { model, max_tokens, messages, system } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required.' });
  }

  try {
    const body = {
      model:      model      || 'claude-sonnet-4-20250514',
      max_tokens: max_tokens || 1000,
      messages,
    };
    if (system) body.system = system;

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key':         KEY,
      },
      body: JSON.stringify(body),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data });
    }

    res.json(data);

  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Proxy request failed: ' + err.message });
  }
});

app.listen(PORT, () => console.log(`DealDesk proxy listening on port ${PORT}`));
