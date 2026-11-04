// Past practice sessions, kept on this device: what was said, the corrections and the coach's summary.
// Also turned into a short memory for the AI character, so it remembers the learner next time.
const KEY = 'sp-history', MAX = 60;

export function loadHistory() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
}

// insert or update one session (matched by id), newest first
export function saveSession(session) {
  logDay(session);
  const all = loadHistory().filter(x => x.id !== session.id);
  all.unshift(session);
  try { localStorage.setItem(KEY, JSON.stringify(all.slice(0, MAX))); } catch (e) { /* full or private mode */ }
  return all.slice(0, MAX);
}

export function deleteSession(id) {
  const all = loadHistory().filter(x => x.id !== id);
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* private mode */ }
  return all;
}

// a session as stored: only finished lines, nothing half-heard
export function snapshot(id, s, level, started) {
  const msgs = s.msgs.filter(m => !m.interim && !m.error && m.text && (m.who === 'me' || m.done))
    .map(m => ({ who: m.who, text: m.text, ...(m.fix && !m.fix.ok ? { fix: { better: m.fix.better, note: m.fix.note } } : {}) }));
  const sum = s.summary && !s.summary.loading ? { tips: s.summary.tips || [], phrases: s.summary.phrases || [] } : undefined;
  return { id, scene: s.scene.id, level, start: started, end: Date.now(), msgs, ...(sum ? { summary: sum } : {}) };
}

// what the character should remember: the last session in the same room
export function memoryFor(sceneId, history) {
  const last = history.find(x => x.scene === sceneId && x.msgs.some(m => m.who === 'me'));
  if (!last) return '';
  const said = last.msgs.filter(m => m.who === 'me').slice(-6).map(m => `- "${m.text}"`).join('\n');
  const days = Math.round((Date.now() - last.end) / 86400000);
  const when = days <= 0 ? 'earlier today' : days === 1 ? 'yesterday' : `${days} days ago`;
  return `You have met this learner before (${when}). Things they said last time:\n${said}\n` +
         'Greet them like someone you remember and, if it fits, refer to last time briefly. Do not repeat these lines back.';
}

// ---------------------------------------------------------------- the notebook
// Everything worth learning from past sessions, newest first and without repeats: sentences the coach said
// to say better (with what was said), and the phrases suggested in the summaries. Learners can tick off the
// ones they know; those go to the bottom.
const KNOWN = 'sp-known';
export function loadKnown() { try { return new Set(JSON.parse(localStorage.getItem(KNOWN) || '[]')); } catch (e) { return new Set(); } }
export function saveKnown(set) { try { localStorage.setItem(KNOWN, JSON.stringify([...set])); } catch (e) { /* private mode */ } }
export function notebook(history) {
  const out = [], seen = new Set();
  const add = x => { const k = x.text.trim().toLowerCase(); if (!k || seen.has(k)) return; seen.add(k); out.push(x); };
  for (const h of history) {
    h.msgs.forEach(m => { if (m.fix && m.fix.better) add({ kind: 'fix', text: m.fix.better, said: m.text, note: m.fix.note, scene: h.scene, t: h.start }); });
    ((h.summary && h.summary.phrases) || []).forEach(p => add({ kind: 'phrase', text: p, scene: h.scene, t: h.start }));
  }
  return out;
}

// ---------------------------------------------------------------- progress
// Sentences said per day and per room, kept apart from the (capped) history so the streak and the room
// counts survive old sessions being dropped: { days: { 'YYYY-MM-DD': { sessionId: sentences } },
// rooms: { sceneId: { sessionId: sentences } } }
const DAYS = 'sp-progress', GOAL = 10;
const dayOf = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function loadLog() {
  try {
    if (localStorage.getItem(DAYS) == null) {                 // first time: count the sessions already in the history
      localStorage.setItem(DAYS, '{}');
      loadHistory().slice().reverse().forEach(logDay);
    } const x = JSON.parse(localStorage.getItem(DAYS) || '{}'); return { days: x.days || {}, rooms: x.rooms || {} }; } catch (e) { return { days: {}, rooms: {} }; }
}
function logDay(session) {
  const log = loadLog(), n = session.msgs.filter(m => m.who === 'me').length, day = dayOf(session.start);
  (log.days[day] = log.days[day] || {})[session.id] = n;
  (log.rooms[session.scene] = log.rooms[session.scene] || {})[session.id] = n;
  const old = dayOf(Date.now() - 400 * 86400000);
  for (const d of Object.keys(log.days)) if (d < old) delete log.days[d];
  try { localStorage.setItem(DAYS, JSON.stringify(log)); } catch (e) { /* private mode */ }
}

// what the progress card shows: today against the daily goal, the streak of days in a row, the last week,
// and per room how many sessions and sentences
export function progress() {
  const { days, rooms } = loadLog(), sum = o => Object.values(o || {}).reduce((a, b) => a + b, 0);
  const said = d => sum(days[dayOf(d)]);
  const now = Date.now(), DAY = 86400000;
  let streak = 0, t = now;
  if (!said(t)) t -= DAY;                            // today not started yet: the streak up to yesterday still counts
  while (said(t) > 0) { streak++; t -= DAY; }
  const week = Array.from({ length: 7 }, (_, i) => { const d = now - (6 - i) * DAY; return { d: new Date(d).getDay(), n: said(d) }; });
  const room = Object.fromEntries(Object.entries(rooms).map(([k, v]) => [k, { sessions: Object.values(v).filter(Boolean).length, said: sum(v) }]));
  return { today: said(now), goal: GOAL, streak, week, room, total: sum(Object.fromEntries(Object.entries(days).map(([k, v]) => [k, sum(v)]))) };
}

// stars for a room: 1 after a session, 2 after three, 3 after six
export const stars = r => (!r || !r.sessions ? 0 : r.sessions >= 6 ? 3 : r.sessions >= 3 ? 2 : 1);
