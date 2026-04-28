import { useEffect, useMemo, useState } from 'react';

const api = async (path, options = {}, token) => {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  return res.json();
};

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notes, setNotes] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [chatPrompt, setChatPrompt] = useState('Explain this topic like I am 12 years old.');
  const [chatAnswer, setChatAnswer] = useState('');
  const [quizJson, setQuizJson] = useState('');
  const [newNote, setNewNote] = useState({ title: '', content: '' });
  const [roomId, setRoomId] = useState('study-room');
  const [username, setUsername] = useState(`learner${Math.floor(Math.random() * 90 + 10)}`);
  const [socket, setSocket] = useState(null);
  const [roomChat, setRoomChat] = useState([]);
  const [roomMessage, setRoomMessage] = useState('');
  const [scoreboard, setScoreboard] = useState({});

  const isAuthed = Boolean(token);

  const auth = async (mode) => {
    const data = await api(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify({ email, password }) });
    if (data.token) {
      setToken(data.token);
      localStorage.setItem('token', data.token);
    } else {
      alert(data.error || 'Auth failed');
    }
  };

  const loadData = async () => {
    const [n, d] = await Promise.all([api('/api/notes', {}, token), api('/api/documents', {}, token)]);
    setNotes(Array.isArray(n) ? n : []);
    setDocuments(Array.isArray(d) ? d : []);
  };

  useEffect(() => {
    if (isAuthed) loadData();
  }, [isAuthed]);

  const uploadDoc = async (file) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/documents/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    });
    const data = await res.json();
    if (data.id) loadData();
  };

  const createNote = async () => {
    await api('/api/notes', { method: 'POST', body: JSON.stringify(newNote) }, token);
    setNewNote({ title: '', content: '' });
    loadData();
  };

  const askAi = async () => {
    const data = await api('/api/ai/chat', { method: 'POST', body: JSON.stringify({ prompt: chatPrompt }) }, token);
    setChatAnswer(data.answer || data.error);
  };

  const generateQuiz = async (mode) => {
    const data = await api('/api/ai/quiz', { method: 'POST', body: JSON.stringify({ mode, questionCount: 10 }) }, token);
    setQuizJson(data.quiz || data.error);
  };

  const joinRoom = () => {
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'join', roomId, username }));
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'chat') setRoomChat((c) => [...c, { from: msg.from, text: msg.text }]);
      if (msg.type === 'state') {
        setRoomChat(msg.chat || []);
        setScoreboard(msg.scoreboard || {});
      }
      if (msg.type === 'scoreboard') setScoreboard(msg.scoreboard || {});
    };
    setSocket(ws);
  };

  const sendRoomChat = () => {
    socket?.send(JSON.stringify({ type: 'chat', text: roomMessage }));
    setRoomMessage('');
  };

  const addPoint = () => socket?.send(JSON.stringify({ type: 'score', delta: 100 }));

  const productivityHints = useMemo(() => [
    'Smart revision planner (spaced repetition)',
    'Citation-ready summaries',
    'Instant AI tutor from your own notes',
    'Kahoot-like multiplayer with chat + scoreboards'
  ], []);

  if (!isAuthed) {
    return (
      <main className="shell">
        <h1>Study Mate</h1>
        <p>Advanced AI study copilot with Groq, quizzes, document intelligence, and installable PWA.</p>
        <div className="card">
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="row">
            <button onClick={() => auth('register')}>Sign Up</button>
            <button onClick={() => auth('login')}>Sign In</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <h1>Study Mate</h1>
        <button onClick={() => { localStorage.removeItem('token'); setToken(''); }}>Sign Out</button>
      </header>

      <section className="grid cols-2">
        <article className="card">
          <h2>Upload Documents</h2>
          <input type="file" onChange={(e) => e.target.files?.[0] && uploadDoc(e.target.files[0])} />
          <ul>{documents.map((d) => <li key={d.id}>{d.name}</li>)}</ul>
        </article>

        <article className="card">
          <h2>Smart Notes</h2>
          <input placeholder="Title" value={newNote.title} onChange={(e) => setNewNote((n) => ({ ...n, title: e.target.value }))} />
          <textarea rows="4" placeholder="Paste lecture notes..." value={newNote.content} onChange={(e) => setNewNote((n) => ({ ...n, content: e.target.value }))} />
          <button onClick={createNote}>Save Note</button>
          <ul>{notes.map((n) => <li key={n.id}><strong>{n.title}</strong></li>)}</ul>
        </article>
      </section>

      <section className="grid cols-2">
        <article className="card">
          <h2>AI Tutor Chat</h2>
          <textarea rows="3" value={chatPrompt} onChange={(e) => setChatPrompt(e.target.value)} />
          <button onClick={askAi}>Ask Study Mate</button>
          <pre>{chatAnswer}</pre>
        </article>

        <article className="card">
          <h2>Quiz Engine</h2>
          <div className="row">
            <button onClick={() => generateQuiz('solo')}>Generate Solo Quiz</button>
            <button onClick={() => generateQuiz('multiplayer')}>Generate Multiplayer Quiz</button>
          </div>
          <pre>{quizJson}</pre>
        </article>
      </section>

      <section className="card">
        <h2>Multiplayer Room (Kahoot-style)</h2>
        <div className="row">
          <input placeholder="Room" value={roomId} onChange={(e) => setRoomId(e.target.value)} />
          <input placeholder="Nickname" value={username} onChange={(e) => setUsername(e.target.value)} />
          <button onClick={joinRoom}>Join Room</button>
          <button onClick={addPoint}>+100 Score</button>
        </div>
        <div className="grid cols-2">
          <div>
            <h3>Live Chat</h3>
            <div className="chatbox">{roomChat.map((m, idx) => <p key={idx}><b>{m.from}:</b> {m.text}</p>)}</div>
            <div className="row">
              <input placeholder="Message" value={roomMessage} onChange={(e) => setRoomMessage(e.target.value)} />
              <button onClick={sendRoomChat}>Send</button>
            </div>
          </div>
          <div>
            <h3>Scoreboard</h3>
            <ul>{Object.entries(scoreboard).map(([name, score]) => <li key={name}>{name}: {score}</li>)}</ul>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Advanced Features Included</h2>
        <ul>{productivityHints.map((f) => <li key={f}>{f}</li>)}</ul>
      </section>
    </main>
  );
}
