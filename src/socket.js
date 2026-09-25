import { io } from 'socket.io-client';

export const socket = io();

// Emit an event and wait for the server's { ok, error } reply.
export function send(event, payload) {
  return new Promise((resolve) => {
    socket.emit(event, payload, (res) => resolve(res ?? { ok: false, error: 'No response' }));
  });
}

// Remember who we are on this phone so a refresh or a locked screen doesn't kick us out.
const KEY = 'botc-session';
export const session = {
  get() {
    try {
      return JSON.parse(localStorage.getItem(KEY));
    } catch {
      return null;
    }
  },
  set(value) {
    try {
      localStorage.setItem(KEY, JSON.stringify(value));
    } catch {}
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {}
  },
};
