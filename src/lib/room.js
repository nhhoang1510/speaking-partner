// The shared classroom, browser side: who I am (kept on this device), checking in what I'm doing,
// and polling who else is in the room. Server: api/room.js.
const ID_KEY = 'sp-me';
export const COLORS = ['#e4572e', '#f3a712', '#29bf12', '#00a5cf', '#5b8def', '#9b5de5', '#f15bb5', '#2ec4b6'];

export function loadMe() {
  try { return JSON.parse(localStorage.getItem(ID_KEY) || 'null'); } catch (e) { return null; }
}

export function saveMe(name, color) {
  const old = loadMe();
  const id = (old && old.id) || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
  const me = { id, name: name.trim().slice(0, 24), color };
  try { localStorage.setItem(ID_KEY, JSON.stringify(me)); } catch (e) { /* private mode: lasts this visit */ }
  return me;
}

// the free Redis plan counts every command: poll fast only while the 3D room is open
const HEARTBEAT_MS = 20000, POLL_FAST_MS = 3000, POLL_SLOW_MS = 20000;

export class Room {
  constructor() {
    this.me = null; this.status = {}; this.users = []; this.listeners = new Set(); this.ok = null;
    this.sent = ''; this.sendTimer = null; this.lastSend = 0; this.pollTimer = null;
    this.beat = setInterval(() => this.send(true), HEARTBEAT_MS);
    addEventListener('pagehide', () => this.leave());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { this.send(true); this.poll(); } });
  }

  setMe(me) { this.me = me; this.send(true); }

  // what I'm doing now: { scene, phase, said, saidAt, turns }; sent at most once a second
  update(status) {
    this.status = status;
    clearTimeout(this.sendTimer);
    this.sendTimer = setTimeout(() => this.send(), Math.max(0, 1000 - (Date.now() - this.lastSend)));
  }

  async send(force) {
    if (!this.me || document.visibilityState === 'hidden') return;
    const body = JSON.stringify({ ...this.me, ...this.status });
    if (!force && body === this.sent) return;
    this.sent = body; this.lastSend = Date.now();
    try { await fetch('/api/room', { method: 'POST', headers: { 'content-type': 'application/json' }, body }); } catch (e) { /* offline */ }
  }

  leave() {
    if (!this.me) return;
    const body = new Blob([JSON.stringify({ id: this.me.id, leave: true })], { type: 'application/json' });
    try { navigator.sendBeacon('/api/room', body); } catch (e) { /* best effort */ }
  }

  // who is in the room; polls only while someone is watching and the page is visible
  subscribe(fn, fast) {
    const l = { fn, fast }; this.listeners.add(l); fn(this.users, this.ok);
    this.poll();
    return () => { this.listeners.delete(l); if (!this.listeners.size) clearTimeout(this.pollTimer); };
  }

  async poll() {
    clearTimeout(this.pollTimer);
    if (!this.listeners.size || this.polling) return;
    this.polling = true;
    if (document.visibilityState !== 'hidden') {
      try {
        const r = await fetch('/api/room', { cache: 'no-store' });
        const d = await r.json();
        this.ok = !!d.ok; this.users = d.ok ? d.users : [];
      } catch (e) { this.ok = false; }
      this.listeners.forEach(l => l.fn(this.users, this.ok));
    }
    this.polling = false;
    const fast = [...this.listeners].some(l => l.fast);
    this.pollTimer = setTimeout(() => this.poll(), fast ? POLL_FAST_MS : POLL_SLOW_MS);
  }
}
