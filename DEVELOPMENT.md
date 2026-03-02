# Teddy Agent — Development Guide

This document tracks the development progress and deployment steps for the Teddy Agent project.

---

## Current Status

- [x] Repo initialized and pushed to GitHub
- [x] Dependencies installed: `@google/genai`, `express`, `cors`, `dotenv`
- [x] Gemini API key available in `backend/.env`
- [x] `backend/index.js` — implemented
- [x] `backend/gemini.js` — implemented
- [x] Frontend Vue app — implemented
- [x] Dockerfile — implemented
- [ ] End-to-end testing with Gemini API
- [ ] Google Cloud Run deployment
- [ ] Demo video recording
- [ ] Architecture diagram creation

---

## What to build next

### Phase 1: End-to-End Testing (Current)
1. Test `POST /api/chat` endpoint with Gemini API
   - Use curl or Postman to validate request/response format
   - Verify Teddy's system prompt is working correctly
2. Verify Web Speech API integration in browser
3. Test full conversation flow with state machine

### Phase 2: Google Cloud Run Deployment
1. Configure GCP project and enable Cloud Run
2. Build and push Docker image to Google Container Registry
3. Deploy container to Cloud Run
4. Test end-to-end from production URL

### Phase 3: Documentation & Submission
1. Create architecture diagram (use Mermaid or draw.io)
2. Record demo video (max 4 min)
3. Update README with deployment instructions
4. Submit to Gemini Live Agent Challenge

---

## Deployment Checklist

- [ ] `.env` file properly configured with GEMINI_API_KEY
- [ ] Environment variables set in Google Cloud Run
- [ ] CORS configured for production frontend URL
- [ ] All console logs removed from final code
- [ ] Error handling tested and user-friendly messages displayed

---

## Testing Commands

```bash
# Start backend locally
cd backend
npm install
npm start

# In another terminal, start frontend dev server
cd frontend
npm install
npm run dev

# Test API endpoint
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello Teddy",
    "history": []
  }'
```

---

## Deadline: March 16, 2026 ⏰
