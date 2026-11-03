// Past practice sessions, kept on this device: what was said, the corrections and the coach's summary.
// Also turned into a short memory for the AI character, so it remembers the learner next time.
const KEY = 'sp-history', MAX = 60;

export function loadHistory() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
}

// insert or update one session (matched by id), newest first
export function saveSession(session) {
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
