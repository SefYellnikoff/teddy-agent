require('dotenv').config({ path: `${__dirname}/.env` });
const express = require('express');
const cors = require('cors');
const { getTeddyReply } = require('./gemini');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [], topic } = req.body;

    // Validate request
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required and must be a string' });
    }

    // Get Teddy's reply from Gemini
    const reply = await getTeddyReply(message, history, topic);

    // Return the response
    res.json({ reply });
  } catch (error) {
    console.error('Chat endpoint error:', error);
    res.status(500).json({
      error: 'An error occurred while processing your request',
      reply: "Oh! I had a little trouble understanding. Could you say that again, please?"
    });
  }
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
    reply: "Oh! I had a little trouble understanding. Could you say that again, please?"
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✨ Teddy Agent server running on http://localhost:${PORT}`);
});
