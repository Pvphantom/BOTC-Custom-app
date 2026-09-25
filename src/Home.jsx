import { useState } from 'react';
import { send } from './socket.js';

export default function Home({ onEnter, notice }) {
  const initialCode = new URLSearchParams(window.location.search).get('code') ?? '';
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function host() {
    setBusy(true);
    const res = await send('host:create');
    setBusy(false);
    if (res.ok) onEnter('host', res.code, res.token);
    else setError(res.error);
  }

  async function join(e) {
    e.preventDefault();
    setBusy(true);
    const res = await send('player:join', { code, name });
    setBusy(false);
    if (res.ok) onEnter('player', res.code, res.token);
    else setError(res.error);
  }

  return (
    <main className="home">
      <h1 className="title">Blood on the Clocktower</h1>
      <p className="subtitle">Trouble Brewing</p>

      {notice && <p className="notice">{notice}</p>}

      <form className="card" onSubmit={join}>
        <h2>Join a game</h2>
        <label>
          Game code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD"
            maxLength={4}
            autoCapitalize="characters"
            autoComplete="off"
            className="code-input"
          />
        </label>
        <label>
          Your name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} autoFocus={!!initialCode} />
        </label>
        <button className="primary" disabled={busy || code.length !== 4 || !name.trim()}>
          Join
        </button>
      </form>

      {!initialCode && (
        <div className="card">
          <h2>Storyteller</h2>
          <p className="muted">Run the game: assign roles, control day and night, and answer players.</p>
          <button onClick={host} disabled={busy}>
            Host a new game
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </main>
  );
}
