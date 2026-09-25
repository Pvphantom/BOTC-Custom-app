# Blood on the Clocktower: Custom App

A phone-friendly web app for playing **Trouble Brewing** in person. One person hosts (the Storyteller). Everyone else joins from their phone's browser by scanning a QR code or typing a 4-letter code.

## Run it

```bash
npm install
npm start
```

Open http://localhost:3000 on the host computer and tap **Host a new game**. Friends on the **same Wi-Fi** scan the QR code.

For development with auto-reload, use `npm run dev` and open http://localhost:5173.

## What's in it

- **Host lobby:** QR code and join code, the live player list, the setup table (Townsfolk/Outsiders/Minions/Demon counts, Baron-aware), manual or random role assignment, and a Drunk "thinks they are" picker.
- **Player:** role card with ability, a Town list (alive/dead, ghost votes), the full script, and private notes.
- **Phases:** the host toggles Day / Dusk / Night. Notes only work during the day.
- **Night chat:** the host taps **Wake** on a player to open a private chat. Only woken players can reply. All chats are erased at dawn.
- **Grimoire:** kill/revive, a ghost vote toggle for dead players, and a night-order helper.

## How it's built

- `server/index.js`: Node + Socket.IO. Holds each game in memory and sends every phone only what that player is allowed to see.
- `shared/roles.js`: role text, the setup table, and the night order.
- `src/`: the React app (Home, HostView, PlayerView).
