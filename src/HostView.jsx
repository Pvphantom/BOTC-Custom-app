import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { send } from './socket.js';
import { ROLES, ROLE_BY_ID, TEAMS, FIRST_NIGHT_ORDER, OTHER_NIGHT_ORDER } from '../shared/roles.js';
import { Chat, PhaseLabel, RoleChip, ScriptList, SeatingCircle, Tabs, aliveNeighbours } from './components/shared.jsx';

// Show errors from the server without blocking the UI.
async function act(event, payload) {
  const res = await send(event, payload);
  if (!res.ok) alert(res.error);
  return res;
}

export default function HostView({ game }) {
  return game.phase === 'lobby' ? <Lobby game={game} /> : <Grimoire game={game} />;
}

// ---------------- Lobby: players join, host assigns roles ----------------

function useJoinUrl(code) {
  const [base, setBase] = useState(window.location.origin);
  useEffect(() => {
    const { hostname, protocol, port } = window.location;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') return;
    // Phones can't reach "localhost", so point the QR code at this computer's Wi-Fi address.
    fetch('/api/info')
      .then((r) => r.json())
      .then(({ lanIp }) => lanIp && setBase(`${protocol}//${lanIp}${port ? `:${port}` : ''}`))
      .catch(() => {});
  }, []);
  return `${base}/?code=${code}`;
}

function Lobby({ game }) {
  const joinUrl = useJoinUrl(game.code);
  const n = game.players.length;
  const actual = { townsfolk: 0, outsider: 0, minion: 0, demon: 0 };
  for (const p of game.players) if (p.roleId) actual[ROLE_BY_ID[p.roleId].team]++;
  const allAssigned = n > 0 && game.players.every((p) => p.roleId);
  const countsMatch = Object.keys(actual).every((t) => actual[t] === game.counts[t]);
  const usedRoles = new Set(game.players.map((p) => p.roleId).filter(Boolean));

  async function start() {
    if (n < 5 && !confirm('Trouble Brewing is meant for 5+ players. Start anyway?')) return;
    if (!countsMatch && !confirm("Role counts don't match the setup table. Start anyway?")) return;
    act('host:start');
  }

  return (
    <main className="page">
      <header className="topbar">
        <span className="code-pill">Storyteller</span>
        <PhaseLabel game={game} />
      </header>

      <div className="card center join-card">
        <p className="muted">Scan to join, or enter code</p>
        <div className="qr">
          <QRCodeSVG value={joinUrl} size={180} bgColor="#f4ecd8" fgColor="#1a1218" includeMargin />
        </div>
        <p className="big-code">{game.code}</p>
        <p className="muted small break">{joinUrl}</p>
      </div>

      <div className="card">
        <h3>Setup for {n} player{n === 1 ? '' : 's'}</h3>
        {n < 5 ? (
          <p className="muted">Waiting for at least 5 players…</p>
        ) : (
          <div className="counts">
            {Object.entries(TEAMS).map(([team, info]) => (
              <div key={team} className={`count ${actual[team] === game.counts[team] ? 'ok' : 'off'}`}>
                <span className={info.good ? 'good-text' : 'evil-text'}>{info.label}</span>
                <strong>
                  {actual[team]} / {game.counts[team]}
                </strong>
              </div>
            ))}
          </div>
        )}
        {n > 15 && <p className="muted small">More than 15 players: extra players should be Travellers.</p>}
        <div className="row">
          <button onClick={() => act('host:randomize')} disabled={n < 5}>
            🎲 Random roles
          </button>
          <button className="primary" onClick={start} disabled={!allAssigned}>
            Start game
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Players</h3>
        {n === 0 && <p className="muted">No one has joined yet.</p>}
        {n > 1 && <p className="muted small">Use ▲▼ to put players in the order they are sitting, clockwise.</p>}
        {n > 2 && <SeatingCircle players={game.players} />}
        <ul className="assign">
          {game.players.map((p, i) => (
            <li key={p.id}>
              <div className="assign-top">
                <strong>
                  <span className="muted">{i + 1}.</span> {p.name}{' '}
                  {!p.connected && <span className="muted small">(offline)</span>}
                </strong>
                <span className="row">
                  <SeatButtons playerId={p.id} />
                  <button className="link" onClick={() => confirm(`Remove ${p.name}?`) && act('host:kick', { playerId: p.id })}>
                    remove
                  </button>
                </span>
              </div>
              <RoleSelect
                value={p.roleId}
                used={usedRoles}
                onChange={(roleId) => act('host:assign', { playerId: p.id, roleId })}
              />
              {p.roleId === 'drunk' && (
                <label className="small">
                  Drunk thinks they are:
                  <RoleSelect
                    value={p.drunkAs}
                    used={usedRoles}
                    teams={['townsfolk']}
                    onChange={(drunkAs) => act('host:assign', { playerId: p.id, roleId: 'drunk', drunkAs })}
                  />
                </label>
              )}
            </li>
          ))}
        </ul>
      </div>

      <EndGame />
    </main>
  );
}

function SeatButtons({ playerId }) {
  return (
    <>
      <button className="seat-btn" aria-label="Move up" onClick={() => act('host:moveSeat', { playerId, direction: -1 })}>
        ▲
      </button>
      <button className="seat-btn" aria-label="Move down" onClick={() => act('host:moveSeat', { playerId, direction: 1 })}>
        ▼
      </button>
    </>
  );
}

function RoleSelect({ value, onChange, used, teams = Object.keys(TEAMS) }) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">— choose role —</option>
      {teams.map((team) => (
        <optgroup key={team} label={TEAMS[team].label}>
          {ROLES.filter((r) => r.team === team).map((r) => (
            <option key={r.id} value={r.id}>
              {r.icon} {r.name}
              {used.has(r.id) && r.id !== value ? ' (taken)' : ''}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

// ---------------- In game: the Storyteller's Grimoire ----------------

function Grimoire({ game }) {
  const [tab, setTab] = useState('players');
  const [chatWith, setChatWith] = useState(null);
  const chatPlayer = game.players.find((p) => p.id === chatWith);

  // Chats are wiped at dawn, so close the panel when night ends.
  useEffect(() => {
    if (game.phase !== 'night') setChatWith(null);
  }, [game.phase]);

  const unread = (p) => game.chats[p.id]?.at(-1)?.from === 'player';

  return (
    <main className="page">
      <header className="topbar">
        <span className="code-pill">{game.code}</span>
        <PhaseLabel game={game} />
      </header>

      <div className="phase-switch">
        {['day', 'dusk', 'night'].map((ph) => (
          <button
            key={ph}
            className={game.phase === ph ? `active ${ph}` : ''}
            onClick={() => act('host:setPhase', { phase: ph })}
          >
            {{ day: '☀️ Day', dusk: '🌆 Dusk', night: '🌙 Night' }[ph]}
          </button>
        ))}
      </div>

      {chatPlayer ? (
        <HostChat game={game} player={chatPlayer} onClose={() => setChatWith(null)} />
      ) : (
        <>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'players', label: 'Grimoire', dot: game.players.some(unread) },
              { id: 'seats', label: 'Seats' },
              { id: 'order', label: 'Night order' },
              { id: 'script', label: 'All roles' },
            ]}
          />
          {tab === 'players' && (
            <ul className="grimoire">
              {game.players.map((p) => (
                <li key={p.id} className={p.alive ? '' : 'dead'}>
                  <div className="grim-top">
                    <strong>
                      {p.alive ? '' : '💀 '}
                      {p.name}
                      {!p.connected && <span className="muted small"> (offline)</span>}
                    </strong>
                    <RoleChip
                      role={ROLE_BY_ID[p.roleId]}
                      suffix={p.roleId === 'drunk' && p.drunkAs ? ` (thinks ${ROLE_BY_ID[p.drunkAs].name})` : ''}
                    />
                  </div>
                  <div className="grim-actions">
                    <button onClick={() => act('host:setAlive', { playerId: p.id, alive: !p.alive })}>
                      {p.alive ? 'Kill' : 'Revive'}
                    </button>
                    {!p.alive && (
                      <button
                        className={p.ghostVote ? 'on' : ''}
                        onClick={() => act('host:setGhostVote', { playerId: p.id, ghostVote: !p.ghostVote })}
                      >
                        Ghost vote: {p.ghostVote ? 'yes' : 'used'}
                      </button>
                    )}
                    {game.phase === 'night' && (
                      <button
                        className={`primary ${unread(p) ? 'pulse' : ''}`}
                        onClick={async () => {
                          await act('host:openChat', { playerId: p.id });
                          setChatWith(p.id);
                        }}
                      >
                        {game.openChats.includes(p.id) ? (unread(p) ? '💬 New reply' : '💬 Open chat') : '👁 Wake'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {tab === 'seats' && <Seats game={game} />}
          {tab === 'order' && <NightOrder game={game} />}
          {tab === 'script' && <ScriptList />}
          <EndGame />
        </>
      )}
    </main>
  );
}

function HostChat({ game, player, onClose }) {
  const role = ROLE_BY_ID[player.roleId];
  const isAwake = game.openChats.includes(player.id);
  return (
    <div className="card">
      <div className="assign-top">
        <button className="link" onClick={onClose}>
          ← Grimoire
        </button>
        <RoleChip role={role} suffix={player.roleId === 'drunk' ? ` (thinks ${ROLE_BY_ID[player.drunkAs]?.name})` : ''} />
      </div>
      <h3>
        {player.name} {!player.alive && '💀'}
      </h3>
      <p className="muted small">{role?.ability}</p>
      <Chat
        messages={game.chats[player.id] ?? []}
        mine="host"
        canSend
        placeholder={`Message ${player.name}…`}
        onSend={(text) => act('host:message', { playerId: player.id, text })}
      />
      <div className="row">
        {isAwake ? (
          <button
            onClick={async () => {
              await act('host:closeChat', { playerId: player.id });
              onClose();
            }}
          >
            😴 Put back to sleep
          </button>
        ) : (
          <p className="muted small">Asleep: they can read but not reply.</p>
        )}
      </div>
    </div>
  );
}

function Seats({ game }) {
  return (
    <div className="card">
      <h3>Seating</h3>
      <SeatingCircle players={game.players} label={(p) => `${ROLE_BY_ID[p.roleId]?.icon ?? ''} ${p.name}`} />
      <ul className="seat-order">
        {game.players.map((p, i) => (
          <li key={p.id} className={p.alive ? '' : 'dead'}>
            <span className="seat-num">{i + 1}.</span>
            <span className="grow">
              {p.alive ? '' : '💀 '}
              {p.name}
            </span>
            <SeatButtons playerId={p.id} />
          </li>
        ))}
      </ul>
      <p className="muted small">Players see this order on their Town tab.</p>
    </div>
  );
}

function NightOrder({ game }) {
  const first = game.nightNumber <= 1;
  const order = first ? FIRST_NIGHT_ORDER : OTHER_NIGHT_ORDER;
  const holders = (roleId) =>
    game.players.filter((p) => p.roleId === roleId || (p.roleId === 'drunk' && p.drunkAs === roleId));
  return (
    <div className="card">
      <h3>{first ? 'First night' : 'Other nights'}</h3>
      <ol className="order">
        {order.map((step) => {
          const role = ROLE_BY_ID[step];
          if (!role) return <li key={step} className="muted">{step}</li>;
          const who = holders(step);
          return (
            <li key={step} className={who.length ? '' : 'absent'}>
              {role.icon} {role.name}
              {who.map((p) => (
                <span key={p.id} className="muted small">
                  {' '}
                  → {p.name}
                  {p.roleId === 'drunk' ? ' (Drunk)' : ''}
                  {!p.alive ? ' 💀' : ''}
                  {step === 'empath' &&
                    ` · neighbours: ${aliveNeighbours(game.players, p.id).map((x) => x.name).join(' & ') || 'none'}`}
                </span>
              ))}
            </li>
          );
        })}
      </ol>
      <p className="muted small">Faded roles are not in play. Use the Night toggle's chat to wake each player.</p>
    </div>
  );
}

function EndGame() {
  return (
    <button
      className="danger end-game"
      onClick={() => confirm('End the game for everyone?') && act('host:endGame')}
    >
      End game
    </button>
  );
}
