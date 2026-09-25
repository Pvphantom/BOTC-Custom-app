import { useEffect, useRef, useState } from 'react';
import { ROLES, TEAMS } from '../../shared/roles.js';

export function RoleCard({ role }) {
  if (!role) return null;
  const good = TEAMS[role.team].good;
  return (
    <div className={`role-card ${good ? 'good' : 'evil'}`}>
      <div className="role-icon">{role.icon}</div>
      <h2 className="role-name">{role.name}</h2>
      <p className="role-team">{TEAMS[role.team].label.replace(/s$/, '')}</p>
      <p className="role-ability">{role.ability}</p>
    </div>
  );
}

export function RoleChip({ role, suffix }) {
  if (!role) return <span className="muted">No role</span>;
  return (
    <span className={`chip ${TEAMS[role.team].good ? 'good' : 'evil'}`}>
      {role.icon} {role.name}
      {suffix}
    </span>
  );
}

// The full Trouble Brewing script, grouped by team.
export function ScriptList() {
  return (
    <div className="script">
      {Object.entries(TEAMS).map(([team, info]) => (
        <section key={team}>
          <h3 className={`team-heading ${info.good ? 'good' : 'evil'}`}>{info.label}</h3>
          {ROLES.filter((r) => r.team === team).map((r) => (
            <div className="script-row" key={r.id}>
              <span className="script-icon">{r.icon}</span>
              <div>
                <strong className={info.good ? 'good-text' : 'evil-text'}>{r.name}</strong>
                <p>{r.ability}</p>
              </div>
            </div>
          ))}
        </section>
      ))}
      <p className="muted small">* Not the first night.</p>
    </div>
  );
}

export function PhaseLabel({ game }) {
  const labels = {
    lobby: 'Lobby',
    day: `Day ${game.dayNumber}`,
    dusk: `Dusk ${game.dayNumber}`,
    night: `Night ${game.nightNumber}`,
  };
  const icons = { lobby: '🕰️', day: '☀️', dusk: '🌆', night: '🌙' };
  return (
    <span className={`phase-label ${game.phase}`}>
      {icons[game.phase]} {labels[game.phase]}
    </span>
  );
}

export function Chat({ messages, mine, onSend, canSend, placeholder }) {
  const [text, setText] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  async function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const res = await onSend(text);
    if (res?.ok !== false) setText('');
  }

  return (
    <div className="chat">
      <div className="chat-log">
        {messages.length === 0 && <p className="muted small center">No messages yet.</p>}
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.from === mine ? 'mine' : 'theirs'}`}>
            {m.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {canSend && (
        <form className="chat-input" onSubmit={submit}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} maxLength={500} />
          <button className="primary" disabled={!text.trim()}>
            Send
          </button>
        </form>
      )}
    </div>
  );
}

// Players drawn around a circle in seating order, clockwise from the top.
export function SeatingCircle({ players, highlightId, label = (p) => p.name }) {
  const n = players.length;
  return (
    <div className="circle">
      {players.map((p, i) => {
        const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
        const style = { left: `${50 + 40 * Math.cos(angle)}%`, top: `${50 + 40 * Math.sin(angle)}%` };
        return (
          <div
            key={p.id}
            className={`seat ${p.alive ? '' : 'dead'} ${p.id === highlightId ? 'me' : ''}`}
            style={style}
          >
            <span className="seat-token">{p.alive ? i + 1 : '💀'}</span>
            <span className="seat-name">{label(p)}</span>
          </div>
        );
      })}
      <span className="circle-center muted small">clockwise ↻</span>
    </div>
  );
}

// The nearest living player on each side, skipping the dead (used by the Empath).
export function aliveNeighbours(players, playerId) {
  const n = players.length;
  const i = players.findIndex((p) => p.id === playerId);
  const find = (step) => {
    for (let k = 1; k < n; k++) {
      const p = players[(i + step * k + n) % n];
      if (p.alive && p.id !== playerId) return p;
    }
    return null;
  };
  return [find(-1), find(1)].filter(Boolean);
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <nav className="tabs">
      {tabs.map((t) => (
        <button key={t.id} className={value === t.id ? 'active' : ''} onClick={() => onChange(t.id)}>
          {t.label}
          {t.dot && <span className="dot" />}
        </button>
      ))}
    </nav>
  );
}
