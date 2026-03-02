# 🧸 Teddy Agent — English Tutor AI Voice Bot

A friendly AI voice agent powered by **Google Gemini 2.0** that teaches English to children aged 6-10 through natural conversation. Built for the **Gemini Live Agent Challenge** (deadline: March 16, 2026).

## 🎯 What is Teddy?

Teddy is a web-based animated tutor that:
- **Listens** to children via Web Speech API (speech-to-text)
- **Converses** using Gemini's advanced language model
- **Corrects** grammar gently and naturally
- **Speaks back** using text-to-speech with friendly tone
- **Tracks progress** with session analytics (topics, corrections, duration)

Perfect for young learners—fun, interactive, and educational!

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Vue 3 + Vite + Web Speech API |
| **Backend** | Node.js + Express + @google/genai SDK |
| **AI Model** | Google Gemini (gemini-flash-latest) |
| **Deployment** | Google Cloud Run (containerized) |
| **Audio** | Browser-native SpeechRecognition + SpeechSynthesis |

---

## 📁 Project Structure

```
teddy-agent/
├── README.md                    # This file
├── Dockerfile                   # For Cloud Run deployment
├── AGENTS.md                    # Detailed specification
│
├── backend/
│   ├── index.js                # Express server, routes, Web Speech API orchestration
│   ├── gemini.js               # Gemini API client, system prompt, reply generation
│   ├── package.json
│   ├── .env                    # GEMINI_API_KEY (never commit)
│   └── .env.example
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── main.js
        ├── App.vue             # State machine, Web Speech API, API calls
        └── components/
            ├── TeddyFace.vue       # Lottie animation (idle/listening/speaking)
            ├── MicButton.vue       # Press-to-talk mic button
            ├── ChatBubbles.vue     # Conversation history display
            └── ParentDashboard.vue # Post-session analytics
```

---

## 🚀 Quick Start (Local Dev)

### Prerequisites
- Node.js 18+ and npm
- Google Generative Language API key from [aistudio.google.com](https://aistudio.google.com)
- Browser with Web Speech API support (Chrome, Edge, Safari, etc.)

### Setup & Run

**1. Clone and install dependencies:**
```bash
# Backend
cd backend
npm install

# Frontend (in a new terminal)
cd frontend
npm install
```

**2. Set up environment:**
```bash
# backend/.env
cp backend/.env.example backend/.env
# Edit backend/.env and add your GEMINI_API_KEY
```

**3. Start backend (port 3000):**
```bash
cd backend
node index.js
```

**4. Start frontend dev server (port 5173):**
```bash
cd frontend
npm run dev
```

**5. Open in browser:**
```
http://localhost:5173
```

Press the **mic button** to start talking to Teddy!

---

## 🔌 API Reference

### POST `/api/chat`
Send a message and get Teddy's reply.

**Request:**
```json
{
  "message": "I like dogs",
  "history": [
    { "role": "user", "parts": [{ "text": "Hello!" }] },
    { "role": "model", "parts": [{ "text": "Hi there!" }] }
  ]
}
```

**Response:**
```json
{
  "reply": "Oh, you like dogs! Dogs are so fun. Do you have a dog?"
}
```

**CORS:** Enabled for `http://localhost:5173` in dev mode.

---

## 🎨 Features

### State Machine
```
IDLE ──(press mic)──> LISTENING ──(speech detected)──> THINKING ──(reply ready)──> SPEAKING ──> IDLE
```

### Frontend Components

| Component | Purpose |
|---|---|
| **TeddyFace.vue** | Animated teddy bear with state-based animations |
| **MicButton.vue** | Large circular "hold-to-talk" button with visual feedback |
| **ChatBubbles.vue** | Conversation transcript (user: right, teddy: left) |
| **ParentDashboard.vue** | Session report: duration, exchanges, topics, grammar fixes |

### Session Analytics
- **Duration**: Total talk time
- **Exchanges**: Number of back-and-forth turns
- **Topics Detected**: Keywords extracted from conversation
- **Grammar Corrections**: Extracted from Teddy's gentle corrections

---

## 🧠 Teddy's Personality

```
You are Teddy, a friendly English tutor for children aged 6-10.
• Speak slowly and clearly, use simple vocabulary
• Correct grammar gently by repeating the correct form naturally
• Never say "wrong", "mistake", or "incorrect"
• Keep it fun, playful, and encouraging
• Ask one follow-up question per response
• Keep responses to 2-3 sentences max
• Remember and reference previous messages
```

---

## 🐳 Docker & Cloud Run Deployment

### Local Docker Build
```bash
docker build -t teddy-agent:latest .
docker run -p 8080:3000 \
  -e PORT=8080 \
  -e GEMINI_API_KEY=your_key_here \
  teddy-agent:latest
```

### Deploy to Google Cloud Run

**1. Authenticate:**
```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

**2. Build and push:**
```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/teddy-agent
```

**3. Deploy:**
```bash
gcloud run deploy teddy-agent \
  --image gcr.io/YOUR_PROJECT_ID/teddy-agent \
  --platform managed \
  --region us-central1 \
  --set-env-vars GEMINI_API_KEY=your_key_here \
  --allow-unauthenticated
```

**4. Get the URL:**
```bash
gcloud run services describe teddy-agent --platform managed --region us-central1
```

⚠️ **Important**: Set `GEMINI_API_KEY` as a Cloud Run secret or environment variable in the Cloud Console for security.

---

## 📊 Architecture

```
┌─────────────────┐
│   Browser       │
│  (Vue 3 SPA)    │
│  ┌───────────┐  │
│  │Web Speech │  │──┐ (speech-to-text)
│  │   API     │  │  │
│  └───────────┘  │  │
│  ┌───────────┐  │  │
│  │Speech     │  │  │
│  │Synthesis  │  │◄─┼─ (text-to-speech)
│  └───────────┘  │  │
└────────┬────────┘  │
         │ HTTP      │
         │ POST      │
         ▼           │
    /api/chat ◄──────┘
         │
    ┌────▼─────────────┐
    │ Backend          │
    │ (Node + Express) │
    │ ┌──────────────┐ │
    │ │ gemini.js    │ │
    │ │ ┌──────────┐ │ │
    │ │ │ Gemini   │ │ │
    │ │ │  Model   │ │ │
    │ │ │(gemini-  │ │ │
    │ │ │flash)    │ │ │
    │ │ └──────────┘ │ │
    │ └──────────────┘ │
    └──────────────────┘
           │
           │ HTTPS
           ▼
    ┌──────────────────┐
    │ Google           │
    │ Generative       │
    │ Language API     │
    └──────────────────┘
```

---

## 🔑 Environment Variables

```bash
# backend/.env
GEMINI_API_KEY=AIza...          # Get from aistudio.google.com
PORT=3000                        # Local dev (Cloud Run uses 8080)
NODE_ENV=development             # or production
```

---

## ✅ Hackathon Checklist

- [x] Backend working end-to-end with Gemini API
- [x] Frontend with Vue 3 + Web Speech API
- [x] State machine (idle → listening → thinking → speaking)
- [x] All 4 components (TeddyFace, MicButton, ChatBubbles, ParentDashboard)
- [x] Error handling and user feedback
- [x] Dockerfile for Cloud Run
- [x] README with setup & deployment guide
- [ ] Push to public GitHub repo
- [ ] Deploy to Cloud Run and capture proof
- [ ] Record demo video (≤4 min)

---

## 🐛 Troubleshooting

### "Speech Recognition not supported"
- Use Chrome, Edge, Safari, or Firefox (latest versions)
- iOS: Use Chrome or Safari on iOS 14.5+
- Ensure HTTPS in production (required for Web Speech API on some browsers)

### "API key not valid"
- Verify key is active in [Google AI Studio](https://aistudio.google.com)
- Check Generative Language API is enabled in your GCP project
- Ensure no whitespace in `.env` file

### Frontend can't reach backend
- Verify backend is running: `curl http://localhost:3000/health`
- Check CORS is enabled in `backend/index.js` (should allow `http://localhost:5173`)
- In production, update CORS origin to your Cloud Run URL

### Vite dev server won't start
```bash
# Clear cache and reinstall
rm -rf frontend/node_modules frontend/package-lock.json
npm install
```

---

## 📝 License

Open source for educational purposes. Built for the Gemini Live Agent Challenge.

---

## 🙌 Credits

- **Framework**: Vue 3, Vite, Express.js
- **AI**: Google Gemini (via @google/genai SDK)
- **Audio**: Web Speech API (browser-native)
- **Animations**: Lottie Web
- **Icons/Emoji**: Unicode

---

## 📧 Contact

Questions or feedback? Feel free to open an issue or submit a pull request!

**Hackathon Deadline**: March 16, 2026  
**Category**: Live Agents  
**Status**: Submission Ready ✨
