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

const statCards = [
  { label: 'AI Responses / hr', value: '250+' },
  { label: 'Quiz Modes', value: 'Solo + Party' },
  { label: 'Upload Types', value: 'Any file' },
  { label: 'Realtime Rooms', value: 'Live' }
];

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const tokenFromOAuth = params.get('token');
  const [token, setToken] = useState(tokenFromOAuth || localStorage.getItem('token') || '');
  const [providers, setProviders] = useState({ google: false, facebook: false, github: false });
  const [profile, setProfile] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notes, setNotes] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [chatPrompt, setChatPrompt] = useState('Create a 7-day revision plan from my latest notes.');
  const [chatAnswer, setChatAnswer] = useState('');
  const [quizJson, setQuizJson] = useState('');
  const [newNote, setNewNote] = useState({ title: '', content: '' });
  const [roomId, setRoomId] = useState('study-arena');
  const [username, setUsername] = useState(`learner${Math.floor(Math.random() * 90 + 10)}`);
  const [socket, setSocket] = useState(null);
  const [roomChat, setRoomChat] = useState([]);
  const [roomMessage, setRoomMessage] = useState('');
  const [scoreboard, setScoreboard] = useState({});

  useEffect(() => {
    if (tokenFromOAuth) {
      localStorage.setItem('token', tokenFromOAuth);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [tokenFromOAuth]);

  const isAuthed = Boolean(token);

  const auth = async (mode) => {
    const data = await api(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify({ email, password }) });
    if (data.token) {
      setToken(data.token);
      localStorage.setItem('token', data.token);
    } else {
      alert(data.error || 'Authentication failed');
    }
  };

  const loadData = async () => {
    const [n, d, me] = await Promise.all([
      api('/api/notes', {}, token),
      api('/api/documents', {}, token),
      api('/api/auth/me', {}, token)
    ]);
    setNotes(Array.isArray(n) ? n : []);
    setDocuments(Array.isArray(d) ? d : []);
    setProfile(me.user || null);
  };

  useEffect(() => {
    api('/api/auth/providers').then((p) => setProviders(p));
  }, []);

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
    'Adaptive learning plans with Groq AI',
    'Multiplayer battle mode with live scoreboard',
    'Any-document upload pipeline',
    'Installable app for desktop + mobile'
  ], []);

  if (!isAuthed) {
    return (
      <main className="landing">
        <div className="bg-glow" />
        <section className="hero card glass">
          <h1>Study Mate</h1>
          <p>Your advanced AI learning operating system.</p>
          <div className="stats-grid">
            {statCards.map((s) => (
              <div key={s.label} className="stat-tile">
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="auth-panel card glass">
          <h2>Sign in to continue</h2>
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

          <div className="row">
            <button onClick={() => auth('register')}>Create account</button>
            <button className="secondary" onClick={() => auth('login')}>Login</button>
          </div>

          <div className="oauth-grid">
            {providers.google && <a className="oauth-btn" href="/api/auth/google">Continue with Google</a>}
            {providers.facebook && <a className="oauth-btn" href="/api/auth/facebook">Continue with Facebook</a>}
            {providers.github && <a className="oauth-btn" href="/api/auth/github">Continue with GitHub</a>}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard">
      <div className="bg-glow" />
      <header className="topbar card glass">
        <div>
          <h1>Study Mate</h1>
          <p>{profile?.display_name || profile?.email || 'Learner'} · {profile?.provider || 'local'} auth</p>
        </div>
        <button onClick={() => { localStorage.removeItem('token'); setToken(''); }}>Sign Out</button>
      </header>

      <section className="grid cols-2">
        <article className="card glass">
          <h2>Knowledge Vault</h2>
          <input type="file" onChange={(e) => e.target.files?.[0] && uploadDoc(e.target.files[0])} />
          <ul>{documents.map((d) => <li key={d.id}>{d.name}</li>)}</ul>
        </article>

        <article className="card glass">
          <h2>Smart Notes</h2>
          <input placeholder="Title" value={newNote.title} onChange={(e) => setNewNote((n) => ({ ...n, title: e.target.value }))} />
          <textarea rows="4" placeholder="Paste lecture notes..." value={newNote.content} onChange={(e) => setNewNote((n) => ({ ...n, content: e.target.value }))} />
          <button onClick={createNote}>Save Note</button>
          <ul>{notes.map((n) => <li key={n.id}><strong>{n.title}</strong></li>)}</ul>
        </article>
      </section>

      <section className="grid cols-2">
        <article className="card glass">
          <h2>AI Tutor</h2>
          <textarea rows="3" value={chatPrompt} onChange={(e) => setChatPrompt(e.target.value)} />
          <button onClick={askAi}>Generate Learning Guidance</button>
          <pre>{chatAnswer}</pre>
        </article>

        <article className="card glass">
          <h2>Quiz Forge</h2>
          <div className="row">
            <button onClick={() => generateQuiz('solo')}>Solo Practice</button>
            <button className="secondary" onClick={() => generateQuiz('multiplayer')}>Party Quiz</button>
          </div>
          <pre>{quizJson}</pre>
        </article>
      </section>

      <section className="card glass">
        <h2>Battle Room (Kahoot-style)</h2>
        <div className="row">
          <input placeholder="Room" value={roomId} onChange={(e) => setRoomId(e.target.value)} />
          <input placeholder="Nickname" value={username} onChange={(e) => setUsername(e.target.value)} />
          <button onClick={joinRoom}>Join Room</button>
          <button className="secondary" onClick={addPoint}>+100 Score</button>
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

      <section className="card glass">
        <h2>Premium-level Capabilities</h2>
        <ul>{productivityHints.map((f) => <li key={f}>{f}</li>)}</ul>
      </section>
    </main>
  );
}
