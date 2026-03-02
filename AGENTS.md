# Teddy Agent — Project Context for AI Coding Assistants

## What I am building

A web-based AI voice agent called **Teddy** — a friendly English tutor for children aged 6-10.
A child talks to an animated teddy bear that listens, responds in English, and gently corrects
mistakes in real time. The long-term vision is embedding this into a physical plush toy (Raspberry Pi),
but for this hackathon we are building a working web prototype.

This is a submission for the **Gemini Live Agent Challenge** (Google hackathon, deadline March 16 2026),
category: **Live Agents**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vue 3 + Vite |
| Backend | Node.js + Express |
| AI | Google Gemini 2.0 Flash via `@google/genai` SDK |
| Audio Input | Web Speech API (speech-to-text in browser) |
| Audio Output | Web Speech API SpeechSynthesis (text-to-speech) |
| Deploy | Google Cloud Run (required by hackathon rules) |

---

## Project Structure

```
teddy-agent/
├── AGENTS.md
├── README.md
├── Dockerfile
├── backend/
│   ├── index.js              # Express server and routes
│   ├── gemini.js             # All Gemini API logic and session memory
│   ├── .env                  # GEMINI_API_KEY (never commit this)
│   └── package.json
└── frontend/
    ├── index.html
    └── src/
        ├── main.js
        ├── App.vue
        └── components/
            ├── TeddyFace.vue         # Lottie animated bear (idle / listening / speaking)
            ├── MicButton.vue         # Mic button with visual state feedback
            ├── ChatBubbles.vue       # Conversation transcript display
            └── ParentDashboard.vue   # Post-session report for parents
```

---

## Backend Specification

### Server (`backend/index.js`)
- Express server on **port 3000**
- CORS enabled for local frontend dev (`http://localhost:5173`)
- Single endpoint: `POST /api/chat`

### Chat Endpoint
**Request body:**
```json
{
  "message": "I want go to the park",
  "history": [
    { "role": "user", "parts": [{ "text": "Hello Teddy!" }] },
    { "role": "model", "parts": [{ "text": "Hello! I'm Teddy, nice to meet you!" }] }
  ]
}
```

**Response:**
```json
{
  "reply": "Oh, you want to GO to the park! That sounds so fun! What do you like to do at the park?"
}
```

**Important:** the backend is **stateless** — the frontend sends the full conversation history with every request. No sessions stored server-side.

### Gemini Integration (`backend/gemini.js`)
- Model: `gemini-2.0-flash`
- Use `@google/genai` SDK (NOT the old `@google/generative-ai`)
- Pass `history` array to maintain conversation context
- Wrap call in try/catch and return a friendly fallback message on error

---

## Teddy's System Prompt

```
You are Teddy, a friendly English tutor for children aged 6-10.
Speak slowly and clearly, always use simple vocabulary.
When the child makes a grammar mistake, correct it gently by naturally repeating 
the correct form in your response — never say "wrong", "mistake", or "incorrect".
Keep the conversation fun, playful and always encouraging.
Ask one simple follow-up question at the end of each response to keep the child engaged.
Keep responses short: 2-3 sentences maximum.
Remember what the child told you in previous messages and reference it naturally.
```

---

## Frontend Specification

### State machine (3 states)
```
IDLE → (user presses mic) → LISTENING → (speech detected) → THINKING → (reply ready) → IDLE
```

### TeddyFace.vue
- Displays a Lottie animation from `https://lottiefiles.com` (free bear/plush animation)
- Accepts a prop `state: 'idle' | 'listening' | 'speaking'`
- Plays different animation segments based on state

### MicButton.vue
- Large circular button, center of screen
- Visual states: grey (idle), red pulsing (listening), spinner (thinking)
- Emits `@start-recording` and `@stop-recording`

### ChatBubbles.vue
- Shows conversation history as chat bubbles
- User messages: right-aligned, light blue
- Teddy messages: left-aligned, warm yellow/orange with small bear icon

### ParentDashboard.vue
- Shown after session ends (user clicks "End session")
- Displays: session duration, number of exchanges, list of topics mentioned, list of recurring grammar mistakes detected
- Mistakes are detected client-side by scanning Teddy's responses for correction patterns

### App.vue (orchestration)
- Manages global state: `history[]`, `currentState`, `sessionStats`
- Handles Web Speech API lifecycle (SpeechRecognition + SpeechSynthesis)
- Calls `POST /api/chat` and updates history on each turn

---

## Environment Variables

```bash
# backend/.env
GEMINI_API_KEY=your_key_from_aistudio.google.com
PORT=3000
```

---

## Hackathon Constraints (do not ignore)

- Must use a **Gemini model** → `gemini-2.0-flash`
- Must use **Google GenAI SDK** → `@google/genai`
- Backend **must be hosted on Google Cloud Run** → Dockerfile required
- Must submit: public GitHub repo, demo video (max 4 min), architecture diagram, GCP deployment proof

---

## Code Style & Conventions

- **JavaScript only** — no TypeScript
- Vue 3 **Composition API** with `<script setup>`
- `async/await` over `.then()` chains
- No UI component libraries — plain CSS with CSS variables for theming
- Error states must always be handled and shown to the user
- Console logs are fine during development, remove before final submission

---

## Current Status

- [x] Repo initialized
- [x] Dependencies installed: `@google/genai`, `express`, `cors`, `dotenv`
- [x] Gemini API key available in `backend/.env`
- [ ] `backend/index.js` — not written yet
- [ ] `backend/gemini.js` — not written yet
- [ ] Frontend Vue app — not written yet
- [ ] Dockerfile — not written yet

---

## What to build next

> **Start here:** write `backend/index.js` and `backend/gemini.js` so that
> `POST /api/chat` works end-to-end with Gemini and returns Teddy's reply.
> Test with a simple curl or Postman call before moving to the frontend.
