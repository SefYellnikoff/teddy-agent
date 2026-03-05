require('dotenv').config({ path: `${__dirname}/.env` });
const express = require('express');
const cors = require('cors');
const { getTeddyReplyDetailed, previewSanitizedReply, getActiveModelName } = require('./gemini');
const { getAvailableModels, getDefaultModels, runBenchmark } = require('./benchmark');
const { readProfile, saveProfile } = require('./profileStore');

const app = express();
const PORT = process.env.PORT || 3000;

const benchmarkState = {
  running: false,
  data: null,
  error: null,
};

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
  methods: ['POST', 'GET'],
  credentials: true,
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/profile', (req, res) => {
  const profile = readProfile();
  return res.json({ profile });
});

app.post('/api/profile', (req, res) => {
  const { childName, ageGroup, englishLevel, sessionMinutes } = req.body || {};

  if (!childName || typeof childName !== 'string' || !childName.trim()) {
    return res.status(400).json({ error: 'childName is required' });
  }

  const allowedAgeGroups = ['6-7', '8-10'];
  const allowedLevels = ['beginner', 'elementary'];

  if (!allowedAgeGroups.includes(String(ageGroup || ''))) {
    return res.status(400).json({ error: 'ageGroup must be one of: 6-7, 8-10' });
  }
  if (!allowedLevels.includes(String(englishLevel || ''))) {
    return res.status(400).json({ error: 'englishLevel must be one of: beginner, elementary' });
  }

  const parsedMinutes = Number(sessionMinutes);
  if (!Number.isFinite(parsedMinutes) || parsedMinutes < 5 || parsedMinutes > 30) {
    return res.status(400).json({ error: 'sessionMinutes must be between 5 and 30' });
  }

  const profile = saveProfile({
    childName,
    ageGroup,
    englishLevel,
    sessionMinutes: parsedMinutes,
  });

  return res.json({ profile });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [], topic, isFirstMessage = false } = req.body;
    const childProfile = readProfile();

    // Validate request
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required and must be a string' });
    }

    // Generate child-safe reply and collect basic diagnostics.
    const result = await getTeddyReplyDetailed({
      message,
      history,
      topic,
      isFirstMessage,
      childProfile,
    });
    const { reply, meta } = result;

    console.log('[chat]', {
      model: meta.model,
      latencyMs: meta.latencyMs,
      totalTokens: meta.usage.totalTokenCount,
      promptTokens: meta.usage.promptTokenCount,
      outputTokens: meta.usage.candidatesTokenCount,
      rawWords: meta.rawWordCount,
      finalWords: meta.sanitizedWordCount,
    });

    // Return the response
    return res.json({
      reply,
      meta,
    });
  } catch (error) {
    console.error('Chat endpoint error:', error);
    return res.status(500).json({
      error: 'An error occurred while processing your request',
      reply: 'Oh! I had a little trouble understanding. Could you say that again, please?',
    });
  }
});

// Dry-run endpoint: test child-safety/shortness sanitizer without calling Gemini
app.post('/api/sanitize-preview', (req, res) => {
  try {
    const {
      rawReply = '',
      topic = 'daily-life',
      message = '',
      isFirstMessage = false,
    } = req.body || {};

    if (typeof rawReply !== 'string') {
      return res.status(400).json({ error: 'rawReply must be a string' });
    }

    const result = previewSanitizedReply(rawReply, topic, message, Boolean(isFirstMessage));
    return res.json(result);
  } catch (error) {
    console.error('Sanitize preview error:', error);
    return res.status(500).json({ error: 'Failed to sanitize preview' });
  }
});

function parseModelsInput(input) {
  if (!input) return getDefaultModels();
  if (Array.isArray(input)) return input.map((v) => String(v || '').trim()).filter(Boolean);
  return String(input)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

app.get('/api/benchmark', (req, res) => {
  return res.json({
    running: benchmarkState.running,
    error: benchmarkState.error,
    data: benchmarkState.data,
    availableModels: getAvailableModels(),
    defaultModels: getDefaultModels(),
  });
});

app.post('/api/benchmark/run', async (req, res) => {
  if (benchmarkState.running) {
    return res.status(409).json({ error: 'Benchmark is already running' });
  }

  const models = parseModelsInput(req.body && req.body.models);
  if (!models.length) {
    return res.status(400).json({ error: 'At least one model is required' });
  }

  benchmarkState.running = true;
  benchmarkState.error = null;

  try {
    const data = await runBenchmark(models);
    benchmarkState.data = data;
    return res.json({ running: false, error: null, data });
  } catch (error) {
    console.error('Benchmark run error:', error);
    benchmarkState.error = error.message || 'Benchmark failed';
    return res.status(500).json({ error: benchmarkState.error });
  } finally {
    benchmarkState.running = false;
  }
});

app.get('/benchmark', (req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Teddy Benchmark</title>
    <style>
      body { font-family: ui-sans-serif, -apple-system, Segoe UI, Roboto, Arial; margin: 0; background: #111827; color: #f9fafb; }
      .wrap { max-width: 1100px; margin: 0 auto; padding: 24px; }
      .top { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; }
      .badge { font-size: 12px; padding: 6px 10px; border-radius: 999px; background: #1f2937; color: #93c5fd; }
      .panel { background: #111827; border: 1px solid #374151; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
      .controls { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
      select { background: #0b1220; border: 1px solid #334155; color: #e5e7eb; border-radius: 8px; padding: 8px 10px; min-width: 260px; min-height: 96px; }
      button { background: #2563eb; color: white; border: 0; border-radius: 8px; padding: 10px 14px; font-weight: 600; cursor: pointer; }
      button:disabled { opacity: 0.6; cursor: not-allowed; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { text-align: left; padding: 8px; border-bottom: 1px solid #374151; font-size: 14px; }
      th { color: #93c5fd; font-weight: 600; }
      .muted { color: #9ca3af; font-size: 13px; }
      .error { color: #fca5a5; }
      .ok { color: #86efac; }
      .row-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 14px; }
      @media (max-width: 900px) { .row-grid { grid-template-columns: 1fr; } select { min-width: 0; width: 100%; } }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="top">
        <h1 style="margin:0; font-size: 26px;">Teddy Benchmark</h1>
        <span class="badge">Active model: ${getActiveModelName()}</span>
      </div>

      <div class="panel">
        <div class="controls">
          <label for="modelsSelect" class="muted">Models (multi-select)</label>
          <select id="modelsSelect" multiple></select>
          <button id="runBtn">Run Benchmark</button>
          <span id="status" class="muted"></span>
        </div>
      </div>

      <div class="row-grid">
        <div class="panel">
          <h3 style="margin-top:0">Summary</h3>
          <div id="summary" class="muted">No benchmark run yet.</div>
        </div>

        <div class="panel">
          <h3 style="margin-top:0">Sample Outputs</h3>
          <div id="samples" class="muted">No benchmark run yet.</div>
        </div>
      </div>
    </div>

    <script>
      const modelsSelect = document.getElementById('modelsSelect');
      const runBtn = document.getElementById('runBtn');
      const statusEl = document.getElementById('status');
      const summaryEl = document.getElementById('summary');
      const samplesEl = document.getElementById('samples');

      function renderModelSelect(availableModels, defaultModels) {
        const modelSet = new Set([...(availableModels || []), ...(defaultModels || [])]);
        const selectedSet = new Set(defaultModels || []);
        modelsSelect.innerHTML = '';

        Array.from(modelSet).forEach((model) => {
          const option = document.createElement('option');
          option.value = model;
          option.textContent = model;
          option.selected = selectedSet.has(model);
          modelsSelect.appendChild(option);
        });
      }

      function getSelectedModels() {
        return Array.from(modelsSelect.selectedOptions).map((option) => option.value);
      }

      function renderSummary(data) {
        if (!data || !data.summary || !data.summary.length) {
          summaryEl.innerHTML = '<span class="muted">No benchmark run yet.</span>';
          return;
        }

        const rows = data.summary.map((row) =>
          '<tr>'
          + '<td>' + row.model + '</td>'
          + '<td>' + row.avgLatencyMs + ' ms</td>'
          + '<td>' + row.avgTotalTokens + '</td>'
          + '<td>' + row.avgReplyWords + '</td>'
          + '<td>' + row.errors + '/' + row.cases + '</td>'
          + '</tr>',
        ).join('');

        summaryEl.innerHTML =
          '<div class=\"muted\">Updated: ' + new Date(data.updatedAt).toLocaleString() + '</div>'
          + '<table>'
          + '<thead>'
          + '<tr>'
          + '<th>Model</th>'
          + '<th>Avg latency</th>'
          + '<th>Avg tokens</th>'
          + '<th>Avg words</th>'
          + '<th>Errors</th>'
          + '</tr>'
          + '</thead>'
          + '<tbody>' + rows + '</tbody>'
          + '</table>';
      }

      function renderSamples(data) {
        if (!data || !data.rows || !data.rows.length) {
          samplesEl.innerHTML = '<span class="muted">No benchmark run yet.</span>';
          return;
        }

        const items = data.rows.slice(0, 8).map((row) =>
          '<div style=\"padding:8px 0; border-bottom: 1px solid #374151;\">'
          + '<div class=\"muted\">[' + row.model + '] ' + row.message + '</div>'
          + '<div>' + row.reply + '</div>'
          + '</div>',
        ).join('');

        samplesEl.innerHTML = items;
      }

      async function loadState() {
        const response = await fetch('/api/benchmark');
        const state = await response.json();
        renderModelSelect(state.availableModels || [], state.defaultModels || []);
        if (state.error) {
          statusEl.textContent = state.error;
          statusEl.className = 'error';
        } else {
          statusEl.textContent = state.running ? 'Benchmark running...' : '';
          statusEl.className = state.running ? 'muted' : 'ok';
        }
        renderSummary(state.data);
        renderSamples(state.data);
        runBtn.disabled = Boolean(state.running);
      }

      runBtn.addEventListener('click', async () => {
        const models = getSelectedModels();
        if (!models.length) {
          statusEl.textContent = 'Select at least one model';
          statusEl.className = 'error';
          return;
        }
        statusEl.textContent = 'Running benchmark...';
        statusEl.className = 'muted';
        runBtn.disabled = true;

        const response = await fetch('/api/benchmark/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ models }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'Benchmark failed' }));
          statusEl.textContent = err.error || 'Benchmark failed';
          statusEl.className = 'error';
          runBtn.disabled = false;
          return;
        }

        const result = await response.json();
        statusEl.textContent = 'Benchmark completed';
        statusEl.className = 'ok';
        renderSummary(result.data);
        renderSamples(result.data);
        runBtn.disabled = false;
      });

      loadState().catch((err) => {
        statusEl.textContent = err.message || 'Failed to load benchmark state';
        statusEl.className = 'error';
      });
    </script>
  </body>
</html>`);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    reply: 'Oh! I had a little trouble understanding. Could you say that again, please?',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✨ Teddy Agent server running on http://localhost:${PORT}`);
  console.log(`🤖 Active Gemini model: ${getActiveModelName()}`);
});
