import express from 'express';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { ROLES, ROLE_BY_ID, setupCounts } from '../shared/roles.js';

const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Lets the host's screen build a QR code that points at this computer's
// Wi-Fi address instead of "localhost" (which wouldn't work on phones).
app.get('/api/info', (_req, res) => {
  const lan = Object.values(os.networkInterfaces())
    .flat()
    .find((i) => i && i.family === 'IPv4' && !i.internal);
  res.json({ lanIp: lan?.address ?? null });
});

const dist = path.join(__dirname, '..', 'dist');
app.use(express.static(dist));
app.get(/^(?!\/socket\.io).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));

// ---------- Game state (in memory) ----------

/** @type {Map<string, any>} */
const games = new Map();

const token = () => crypto.randomBytes(16).toString('hex');
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function newCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O to avoid confusion
  let code;
  do {
    code = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  } while (games.has(code));
  return code;
}

function createGame() {
  const game = {
    code: newCode(),
    hostToken: token(),
    phase: 'lobby', // lobby | day | dusk | night
    dayNumber: 0,
    nightNumber: 0,
    players: [],
    chats: {}, // playerId -> [{ from: 'host' | 'player', text, ts }]
    openChats: [], // playerIds the host has picked tonight (they may type)
    createdAt: Date.now(),
  };
  games.set(game.code, game);
  return game;
}

// ---------- Views: each client only receives what it is allowed to know ----------

function hostView(game) {
  return {
    code: game.code,
    phase: game.phase,
    dayNumber: game.dayNumber,
    nightNumber: game.nightNumber,
    players: game.players.map(({ token: _t, ...p }) => p),
    chats: game.chats,
    openChats: game.openChats,
    counts: setupCounts(game.players.length, game.players.some((p) => p.roleId === 'baron')),
  };
}

function playerView(game, player) {
  // The Drunk is shown the Townsfolk they think they are.
  const shownRoleId = player.roleId === 'drunk' ? player.drunkAs : player.roleId;
  const isNight = game.phase === 'night';
  const chatOpen = isNight && game.openChats.includes(player.id);
  return {
    code: game.code,
    phase: game.phase,
    dayNumber: game.dayNumber,
    nightNumber: game.nightNumber,
    me: {
      id: player.id,
      name: player.name,
      role: game.phase === 'lobby' ? null : ROLE_BY_ID[shownRoleId] ?? null,
      alive: player.alive,
      ghostVote: player.ghostVote,
    },
    players: game.players.map((p) => ({
      id: p.id,
      name: p.name,
      alive: p.alive,
      ghostVote: p.ghostVote,
      connected: p.connected,
    })),
    chat: isNight ? game.chats[player.id] ?? [] : [],
    chatOpen,
    evilTeam: evilTeamFor(game, player),
  };
}

// With 7+ players, evil players learn who is on their team: which player is
// the Demon and which are Minions, but not the Minions' specific roles.
function evilTeamFor(game, player) {
  if (game.phase === 'lobby' || game.players.length < 7) return null;
  const teamOf = (p) => ROLE_BY_ID[p.roleId]?.team;
  if (!['minion', 'demon'].includes(teamOf(player))) return null;
  const others = game.players.filter((p) => p.id !== player.id);
  return {
    demons: others.filter((p) => teamOf(p) === 'demon').map((p) => p.name),
    minions: others.filter((p) => teamOf(p) === 'minion').map((p) => p.name),
  };
}

function broadcast(game) {
  io.to(`${game.code}:host`).emit('state', { role: 'host', game: hostView(game) });
  for (const p of game.players) {
    io.to(`${game.code}:p:${p.id}`).emit('state', { role: 'player', game: playerView(game, p) });
  }
}

// ---------- Setup helpers ----------

function randomizeRoles(game) {
  const n = game.players.length;
  const pick = (team) => shuffle(ROLES.filter((r) => r.team === team && r.id !== 'drunk'));
  const minions = pick('minion');
  const demons = pick('demon');
  const base = setupCounts(n, false);
  const chosenMinions = minions.slice(0, base.minion);
  const counts = setupCounts(n, chosenMinions.some((r) => r.id === 'baron'));

  // Drunk is included in the outsider pool; it takes up an outsider slot.
  const outsiders = shuffle(ROLES.filter((r) => r.team === 'outsider')).slice(0, counts.outsider);
  const townsfolk = pick('townsfolk').slice(0, counts.townsfolk);
  const chosen = shuffle([...townsfolk, ...outsiders, ...chosenMinions, ...demons.slice(0, counts.demon)]);

  const unusedTownsfolk = shuffle(
    ROLES.filter((r) => r.team === 'townsfolk' && !townsfolk.includes(r)),
  );
  game.players.forEach((p, i) => {
    p.roleId = chosen[i]?.id ?? null;
    p.drunkAs = p.roleId === 'drunk' ? unusedTownsfolk[0]?.id ?? null : null;
  });
}

// ---------- Socket handlers ----------

io.on('connection', (socket) => {
  let game = null;
  let player = null;
  let isHost = false;

  const fail = (cb, error) => cb?.({ ok: false, error });

  function attachHost(g) {
    game = g;
    isHost = true;
    socket.join(`${g.code}:host`);
    broadcast(g);
  }

  function attachPlayer(g, p) {
    game = g;
    player = p;
    p.connected = true;
    socket.join(`${g.code}:p:${p.id}`);
    broadcast(g);
  }

  const hostOnly = (handler) => (payload, cb) => {
    if (!isHost || !game) return fail(cb, 'Not the host');
    const error = handler(payload ?? {});
    if (error) return fail(cb, error);
    broadcast(game);
    cb?.({ ok: true });
  };

  const findPlayer = (id) => game.players.find((p) => p.id === id);

  // --- Host lifecycle ---
  socket.on('host:create', (_payload, cb) => {
    const g = createGame();
    attachHost(g);
    cb?.({ ok: true, code: g.code, token: g.hostToken });
  });

  socket.on('host:rejoin', ({ code, token: t } = {}, cb) => {
    const g = games.get(String(code).toUpperCase());
    if (!g || g.hostToken !== t) return fail(cb, 'Game not found');
    attachHost(g);
    cb?.({ ok: true });
  });

  // --- Player lifecycle ---
  socket.on('player:join', ({ code, name } = {}, cb) => {
    const g = games.get(String(code ?? '').trim().toUpperCase());
    const cleanName = String(name ?? '').trim().slice(0, 20);
    if (!g) return fail(cb, 'No game with that code');
    if (!cleanName) return fail(cb, 'Enter a name');
    if (g.phase !== 'lobby') return fail(cb, 'That game has already started');
    if (g.players.some((p) => p.name.toLowerCase() === cleanName.toLowerCase()))
      return fail(cb, 'That name is taken');
    if (g.players.length >= 20) return fail(cb, 'Game is full');
    const p = {
      id: token().slice(0, 8),
      token: token(),
      name: cleanName,
      roleId: null,
      drunkAs: null,
      alive: true,
      ghostVote: true,
      connected: true,
    };
    g.players.push(p);
    attachPlayer(g, p);
    cb?.({ ok: true, code: g.code, token: p.token });
  });

  socket.on('player:rejoin', ({ code, token: t } = {}, cb) => {
    const g = games.get(String(code).toUpperCase());
    const p = g?.players.find((x) => x.token === t);
    if (!p) return fail(cb, 'Game not found');
    attachPlayer(g, p);
    cb?.({ ok: true });
  });

  socket.on('player:message', ({ text } = {}, cb) => {
    if (!game || !player) return fail(cb, 'Not in a game');
    if (game.phase !== 'night' || !game.openChats.includes(player.id))
      return fail(cb, 'The Storyteller has not woken you');
    const clean = String(text ?? '').trim().slice(0, 500);
    if (!clean) return fail(cb, 'Empty message');
    (game.chats[player.id] ??= []).push({ from: 'player', text: clean, ts: Date.now() });
    broadcast(game);
    cb?.({ ok: true });
  });

  // --- Host actions ---
  socket.on('host:assign', hostOnly(({ playerId, roleId, drunkAs }) => {
    const p = findPlayer(playerId);
    if (!p) return 'Player not found';
    if (roleId && !ROLE_BY_ID[roleId]) return 'Unknown role';
    p.roleId = roleId || null;
    p.drunkAs = p.roleId === 'drunk' ? drunkAs ?? p.drunkAs ?? null : null;
  }));

  socket.on('host:randomize', hostOnly(() => {
    if (game.players.length < 5) return 'Need at least 5 players';
    randomizeRoles(game);
  }));

  socket.on('host:kick', hostOnly(({ playerId }) => {
    game.players = game.players.filter((p) => p.id !== playerId);
    delete game.chats[playerId];
    game.openChats = game.openChats.filter((id) => id !== playerId);
    io.to(`${game.code}:p:${playerId}`).emit('kicked');
  }));

  socket.on('host:start', hostOnly(() => {
    if (game.players.some((p) => !p.roleId)) return 'Every player needs a role';
    if (game.players.some((p) => p.roleId === 'drunk' && !p.drunkAs))
      return 'Choose which Townsfolk the Drunk thinks they are';
    game.phase = 'night';
    game.nightNumber = 1;
  }));

  socket.on('host:setPhase', hostOnly(({ phase }) => {
    if (!['day', 'dusk', 'night'].includes(phase)) return 'Unknown phase';
    if (game.phase === 'lobby') return 'Start the game first';
    if (phase === game.phase) return;
    if (phase === 'day') {
      // Morning: every night conversation disappears.
      game.chats = {};
      game.openChats = [];
      game.dayNumber += 1;
    }
    if (phase === 'night') game.nightNumber += 1;
    game.phase = phase;
  }));

  socket.on('host:setAlive', hostOnly(({ playerId, alive }) => {
    const p = findPlayer(playerId);
    if (!p) return 'Player not found';
    p.alive = !!alive;
    if (p.alive) p.ghostVote = true;
  }));

  socket.on('host:setGhostVote', hostOnly(({ playerId, ghostVote }) => {
    const p = findPlayer(playerId);
    if (!p) return 'Player not found';
    p.ghostVote = !!ghostVote;
  }));

  socket.on('host:openChat', hostOnly(({ playerId }) => {
    if (game.phase !== 'night') return 'Chats only happen at night';
    if (!findPlayer(playerId)) return 'Player not found';
    if (!game.openChats.includes(playerId)) game.openChats.push(playerId);
  }));

  socket.on('host:closeChat', hostOnly(({ playerId }) => {
    game.openChats = game.openChats.filter((id) => id !== playerId);
  }));

  socket.on('host:message', hostOnly(({ playerId, text }) => {
    if (game.phase !== 'night') return 'Chats only happen at night';
    if (!findPlayer(playerId)) return 'Player not found';
    const clean = String(text ?? '').trim().slice(0, 500);
    if (!clean) return 'Empty message';
    if (!game.openChats.includes(playerId)) game.openChats.push(playerId);
    (game.chats[playerId] ??= []).push({ from: 'host', text: clean, ts: Date.now() });
  }));

  socket.on('host:endGame', (_payload, cb) => {
    if (!isHost || !game) return fail(cb, 'Not the host');
    io.to(`${game.code}:host`).emit('ended');
    for (const p of game.players) io.to(`${game.code}:p:${p.id}`).emit('ended');
    games.delete(game.code);
    game = null;
    cb?.({ ok: true });
  });

  socket.on('disconnect', () => {
    if (player && game) {
      player.connected = false;
      broadcast(game);
    }
  });
});

// Forget games nobody has touched for 12 hours.
setInterval(() => {
  const cutoff = Date.now() - 12 * 60 * 60 * 1000;
  for (const [code, g] of games) if (g.createdAt < cutoff) games.delete(code);
}, 60 * 60 * 1000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`BOTC server running on http://localhost:${PORT}`);
});
