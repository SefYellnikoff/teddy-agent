# Teddy V2 Development Progress

Last update: 2026-03-04

## Overall Progress
- Current progress: `40%`
- Rule: 5 major steps, each worth 20%

## Roadmap
1. `Step 1 - Parent Onboarding + Child Profile` - `DONE` (20%)
2. `Step 2 - Hands-free Conversation (VAD + auto turn-taking)` - `DONE` (20%)
3. `Step 3 - Camera Vision Context (objects + colors)` - `TODO` (0%)
4. `Step 4 - Safe Memory Personalization` - `TODO` (0%)
5. `Step 5 - Safety Hardening + UX Benchmarks` - `TODO` (0%)

## Implemented in Step 1
- Added persistent child profile API:
  - `GET /api/profile`
  - `POST /api/profile`
- Added local backend storage for child profile in `backend/data/child-profile.json`.
- Connected child profile to Gemini prompt personalization (name, age group, level, session length).
- Added parent setup form in frontend idle screen:
  - child name
  - age group
  - English level
  - session duration
- Blocked session start until setup is completed.

## Notes for Next Step
- Implement camera pipeline for scene summary (object + color extraction).
- Pass visual context to chat endpoint in a safe, minimal payload.

## Implemented in Step 2
- Added dual conversation mode in UI:
  - `Hands-free` (default)
  - `Push-to-talk` (fallback)
- Added auto-listening scheduler:
  - automatic restart after Teddy finishes speaking
  - pause/resume controls for parents
- Added safer runtime flow:
  - stop listening while Teddy speaks
  - avoid overlapping requests with in-flight guard
  - interrupt button to stop Teddy and resume listening quickly
