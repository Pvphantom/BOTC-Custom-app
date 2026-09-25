import { useEffect, useState } from 'react';
import { socket, send, session } from './socket.js';
import Home from './Home.jsx';
import HostView from './HostView.jsx';
import PlayerView from './PlayerView.jsx';

export default function App() {
  const [me, setMe] = useState(() => session.get()); // { kind: 'host' | 'player', code, token }
  const [game, setGame] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const onState = ({ game }) => setGame(game);
    const leave = (message) => () => {
      session.clear();
      setMe(null);
      setGame(null);
      setNotice(message);
    };
    const onKicked = leave('The Storyteller removed you from the game.');
    const onEnded = leave('The game has ended.');

    // (Re)attach to our game every time the connection comes up.
    const onConnect = async () => {
      const s = session.get();
      if (!s) return;
      const res = await send(s.kind === 'host' ? 'host:rejoin' : 'player:rejoin', s);
      if (!res.ok) leave('That game no longer exists.')();
    };

    socket.on('state', onState);
    socket.on('kicked', onKicked);
    socket.on('ended', onEnded);
    socket.on('connect', onConnect);
    if (socket.connected) onConnect();
    return () => {
      socket.off('state', onState);
      socket.off('kicked', onKicked);
      socket.off('ended', onEnded);
      socket.off('connect', onConnect);
    };
  }, []);

  function enter(kind, code, token) {
    const s = { kind, code, token };
    session.set(s);
    setMe(s);
    setNotice('');
    // Clear ?code= from the address bar once we're in.
    window.history.replaceState(null, '', '/');
  }

  const phase = game?.phase ?? 'lobby';

  return (
    <div className={`app phase-${me ? phase : 'home'}`}>
      {!me && <Home onEnter={enter} notice={notice} />}
      {me && !game && <div className="loading">Connecting…</div>}
      {me?.kind === 'host' && game && <HostView game={game} />}
      {me?.kind === 'player' && game && <PlayerView game={game} />}
    </div>
  );
}
