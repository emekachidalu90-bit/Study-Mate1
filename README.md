# Study Mate

Study Mate is an advanced AI study platform with modern auth, document uploads, Groq tutoring, and multiplayer quiz battles.

## Features
- Email/password auth + OAuth sign-in (Google, Facebook, GitHub).
- Upload files (PDF/DOCX/TXT/PPTX + generic file fallback).
- Save notes and ask AI questions grounded in uploaded content.
- Generate solo or multiplayer quiz sets.
- Kahoot-like realtime room chat + scoreboard via WebSockets.
- Modern glassmorphism UI with responsive dashboard.
- PWA-ready (installable from browser).
- Deployable on Render.

## Local setup
```bash
npm install
cp .env.example .env
npm run dev
```

## OAuth setup
Set these env vars if you want social auth:
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- `APP_BASE_URL` (backend base URL)
- `CLIENT_BASE_URL` (frontend URL that receives `?token=...`)

## Production / Render
- `render.yaml` included.
- Set `GROQ_API_KEY` and optional OAuth keys in Render dashboard.
- App serves Vite build from Express in production.

## API endpoints
- `GET /api/auth/providers`
- `GET /api/auth/me`
- `GET /api/auth/google`, `GET /api/auth/facebook`, `GET /api/auth/github`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/documents`
- `POST /api/documents/upload`
- `GET /api/notes`
- `POST /api/notes`
- `POST /api/ai/chat`
- `POST /api/ai/quiz`
