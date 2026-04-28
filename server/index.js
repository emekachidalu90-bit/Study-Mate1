import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { WebSocketServer } from 'ws';
import db from './db.js';
import { signToken, requireAuth } from './auth.js';
import { extractTextFromFile } from './documentParser.js';
import { askGroq } from './ai.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const clientBuildDir = path.resolve('dist');

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(path.resolve('uploads')));

const upload = multer({ dest: 'uploads/' });

app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'Study Mate' }));

app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email + password required' });

  const hash = await bcrypt.hash(password, 10);
  try {
    const stmt = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
    const result = stmt.run(email.toLowerCase(), hash);
    const token = signToken({ id: result.lastInsertRowid, email });
    return res.json({ token });
  } catch {
    return res.status(409).json({ error: 'Email already exists' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email?.toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  return res.json({ token: signToken({ id: user.id, email: user.email }) });
});

app.get('/api/documents', requireAuth, (req, res) => {
  const docs = db.prepare('SELECT id, name, mime_type, created_at FROM documents WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  res.json(docs);
});

app.post('/api/documents/upload', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File required' });

  const extracted = await extractTextFromFile(req.file.path, req.file.mimetype);
  const stmt = db.prepare('INSERT INTO documents (user_id, name, path, mime_type, extracted_text) VALUES (?, ?, ?, ?, ?)');
  const result = stmt.run(req.user.id, req.file.originalname, req.file.path, req.file.mimetype, extracted);

  res.json({ id: result.lastInsertRowid, name: req.file.originalname });
});

app.post('/api/notes', requireAuth, (req, res) => {
  const { title, content } = req.body;
  const result = db.prepare('INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)').run(req.user.id, title, content);
  res.json({ id: result.lastInsertRowid });
});

app.get('/api/notes', requireAuth, (req, res) => {
  const notes = db.prepare('SELECT id, title, content, created_at FROM notes WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  res.json(notes);
});

function buildKnowledge(userId) {
  const docs = db.prepare('SELECT name, extracted_text FROM documents WHERE user_id = ? ORDER BY id DESC LIMIT 8').all(userId);
  const notes = db.prepare('SELECT title, content FROM notes WHERE user_id = ? ORDER BY id DESC LIMIT 12').all(userId);

  return [
    ...notes.map((n) => `Note: ${n.title}\n${n.content}`),
    ...docs.map((d) => `Document: ${d.name}\n${d.extracted_text}`)
  ].join('\n\n---\n\n').slice(0, 120000);
}

app.post('/api/ai/chat', requireAuth, async (req, res) => {
  try {
    const { prompt } = req.body;
    const response = await askGroq({
      apiKey: process.env.GROQ_API_KEY,
      system: 'You are Study Mate, an elite learning copilot. Explain clearly, quiz users, and adapt to their level.',
      prompt: `User context:\n${buildKnowledge(req.user.id)}\n\nUser asks:\n${prompt}`
    });
    res.json({ answer: response });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/ai/quiz', requireAuth, async (req, res) => {
  try {
    const { mode = 'solo', questionCount = 8 } = req.body;
    const answer = await askGroq({
      apiKey: process.env.GROQ_API_KEY,
      temperature: 0.2,
      system: 'Create JSON only. Return an array of MCQ questions with 4 options and one correct index.',
      prompt: `Build ${questionCount} quiz questions based on this study content:\n${buildKnowledge(req.user.id)}\nOutput JSON format: [{"question":"...","options":["a","b","c","d"],"correctIndex":0,"explanation":"..."}] for ${mode} mode.`
    });

    res.json({ quiz: answer });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const rooms = new Map();

function emitRoom(roomId, payload) {
  const room = rooms.get(roomId);
  if (!room) return;
  for (const client of room.clients) {
    if (client.readyState === 1) client.send(JSON.stringify(payload));
  }
}

wss.on('connection', (socket) => {
  socket.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'join') {
        if (!rooms.has(msg.roomId)) {
          rooms.set(msg.roomId, { clients: new Set(), chat: [], scoreboard: {} });
        }
        const room = rooms.get(msg.roomId);
        room.clients.add(socket);
        socket.roomId = msg.roomId;
        socket.username = msg.username || 'Guest';
        room.scoreboard[socket.username] = room.scoreboard[socket.username] || 0;
        emitRoom(msg.roomId, { type: 'state', chat: room.chat, scoreboard: room.scoreboard });
      }

      if (msg.type === 'chat' && socket.roomId) {
        const room = rooms.get(socket.roomId);
        room.chat.push({ from: socket.username, text: msg.text, ts: Date.now() });
        emitRoom(socket.roomId, { type: 'chat', from: socket.username, text: msg.text });
      }

      if (msg.type === 'score' && socket.roomId) {
        const room = rooms.get(socket.roomId);
        room.scoreboard[socket.username] = (room.scoreboard[socket.username] || 0) + (msg.delta || 0);
        emitRoom(socket.roomId, { type: 'scoreboard', scoreboard: room.scoreboard });
      }
    } catch {
      // ignore malformed ws frames
    }
  });

  socket.on('close', () => {
    const roomId = socket.roomId;
    if (!roomId || !rooms.has(roomId)) return;
    const room = rooms.get(roomId);
    room.clients.delete(socket);
    if (room.clients.size === 0) rooms.delete(roomId);
  });
});

if (fs.existsSync(clientBuildDir)) {
  app.use(express.static(clientBuildDir));
  app.get('*', (_req, res) => res.sendFile(path.join(clientBuildDir, 'index.html')));
}

server.listen(PORT, () => {
  console.log(`Study Mate running on http://localhost:${PORT}`);
});
