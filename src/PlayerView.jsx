import { useEffect, useState } from 'react';
import { send } from './socket.js';
import { Chat, PhaseLabel, RoleCard, ScriptList, SeatingCircle, Tabs } from './components/shared.jsx';

export default function PlayerView({ game }) {
  const { me, phase } = game;
  const [tab, setTab] = useState('role');

  // When the Storyteller wakes this player, jump to the role screen where the chat lives.
  useEffect(() => {
    if (game.chatOpen) setTab('role');
  }, [game.chatOpen]);

  if (phase === 'lobby') {
    return (
      <main className="page">
        <header className="topbar">
          <span className="code-pill">{game.code}</span>
          <PhaseLabel game={game} />
        </header>
        <div className="card center">
          <h2>Welcome, {me.name}</h2>
          <p className="muted">Waiting for the Storyteller to hand out roles…</p>
        </div>
        <TownList players={game.players} meId={me.id} />
      </main>
    );
  }

  const notesLocked = phase !== 'day';
  const hasNightMessage = game.chat.some((m) => m.from === 'host');

  return (
    <main className="page">
      <header className="topbar">
        <span className="code-pill">{me.name}</span>
        <PhaseLabel game={game} />
      </header>

      {!me.alive && (
        <p className="banner dead">
          💀 You are dead. {me.ghostVote ? 'You still have your ghost vote.' : 'Your ghost vote is used.'}
        </p>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'role', label: 'My role', dot: game.chatOpen && tab !== 'role' },
          { id: 'town', label: 'Town' },
          { id: 'script', label: 'All roles' },
          { id: 'notes', label: notesLocked ? 'Notes 🔒' : 'Notes' },
        ]}
      />

      {tab === 'role' && (
        <>
          {phase === 'night' && <NightPanel game={game} hasMessage={hasNightMessage} />}
          <RoleCard role={me.role} />
          {game.evilTeam && <EvilTeam team={game.evilTeam} />}
        </>
      )}
      {tab === 'town' && (
        <>
          <div className="card">
            <h3>Seating</h3>
            <SeatingCircle players={game.players} highlightId={me.id} />
          </div>
          <TownList players={game.players} meId={me.id} />
        </>
      )}
      {tab === 'script' && <ScriptList />}
      {tab === 'notes' && <Notes code={game.code} playerId={me.id} locked={notesLocked} phase={phase} />}
    </main>
  );
}

function NightPanel({ game, hasMessage }) {
  if (!game.chatOpen && !hasMessage) {
    return (
      <div className="card night-card center">
        <p className="big">🌙</p>
        <p>Close your eyes. The Storyteller will wake you if you are needed.</p>
      </div>
    );
  }
  return (
    <div className="card night-card">
      <h3>The Storyteller wakes you</h3>
      <p className="muted small">This conversation disappears at dawn. Remember what you learn.</p>
      <Chat
        messages={game.chat}
        mine="player"
        canSend={game.chatOpen}
        placeholder="Reply to the Storyteller…"
        onSend={(text) => send('player:message', { text })}
      />
      {!game.chatOpen && <p className="muted small center">Go back to sleep.</p>}
    </div>
  );
}

function EvilTeam({ team }) {
  const list = (names) => (names.length ? names.join(', ') : 'None');
  return (
    <div className="card evil-team">
      <h3 className="evil-text">Your evil team</h3>
      <p>
        <span className="muted">Demon:</span> <strong>{list(team.demons)}</strong>
      </p>
      <p>
        <span className="muted">Other Minions:</span> <strong>{list(team.minions)}</strong>
      </p>
      <p className="muted small">This disappears at dawn. Remember it.</p>
    </div>
  );
}

export function TownList({ players, meId }) {
  return (
    <div className="card">
      <h3>Players ({players.length})</h3>
      <ul className="town">
        {players.map((p, i) => (
          <li key={p.id} className={p.alive ? '' : 'dead'}>
            <span>
              <span className="muted">{i + 1}.</span> {p.alive ? '' : '💀 '}
              {p.name}
              {p.id === meId && <span className="muted"> (you)</span>}
            </span>
            <span className="muted small">
              {!p.alive && (p.ghostVote ? 'ghost vote' : 'no vote')}
              {!p.connected && ' · offline'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Notes live only on this phone. They can only be read and written during the day.
function Notes({ code, playerId, locked, phase }) {
  const key = `botc-notes-${code}-${playerId}`;
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem(key) ?? '';
    } catch {
      return '';
    }
  });

  function update(value) {
    setText(value);
    try {
      localStorage.setItem(key, value);
    } catch {}
  }

  if (locked) {
    return (
      <div className="card center">
        <p className="big">🔒</p>
        <p>Your notes are locked during the {phase}.</p>
        <p className="muted small">They'll be back in the morning. Trust your memory.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Notes</h3>
      <textarea
        className="notes"
        value={text}
        onChange={(e) => update(e.target.value)}
        placeholder="Claims, votes, suspicions…"
      />
      <p className="muted small">Saved on this phone only.</p>
    </div>
  );
}
