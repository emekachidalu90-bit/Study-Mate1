# Study Mate

Study Mate is an AI study platform with authentication, document uploads, AI tutoring via Groq, and multiplayer quiz rooms.

## Features
- Sign up / sign in / sign out.
- Upload files (PDF/DOCX/TXT/PPTX + any file storage).
- Save notes and ask AI questions grounded in uploaded content.
- Generate solo or multiplayer quiz sets.
- Kahoot-like realtime room chat + scoreboard via WebSockets.
- PWA-ready (installable from browser).
- Deployable on Render.

## Local setup
```bash
npm install
cp .env.example .env
npm run dev
```

## Production / Render
- `render.yaml` included.
- Set `GROQ_API_KEY` in Render dashboard.
- App serves Vite build from Express in production.

## API endpoints
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/documents`
- `POST /api/documents/upload`
- `GET /api/notes`
- `POST /api/notes`
- `POST /api/ai/chat`
- `POST /api/ai/quiz`
