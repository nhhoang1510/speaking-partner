// The daily challenge: each day one room and three useful phrases to work into the conversation there. The
// phrases tick themselves off when the learner says them; the room's character is asked to give chances to.
// Each phrase: [what to show, what counts as having said it (lower case, no punctuation)].
const PHRASES = {
  friend: [['What do you do for a living?', 'what do you do'], ['How long have you been here?', 'how long have you'], ["I'm really into…", 'really into'], ['What about you?', 'what about you'], ['That sounds fun!', 'sounds fun'], ['Nice to meet you', 'nice to meet you']],
  coffee: [['Could I get…, please?', 'could i get'], ['For here or to go', 'to go'], ['How much is it?', 'how much'], ['Can I pay by card?', 'pay by card'], ['With oat milk', 'oat milk'], ["That's all, thanks", 'thats all']],
  interview: [['I have … years of experience', 'years of experience'], ['My strength is…', 'my strength'], ['I worked on a project…', 'a project'], ["I'm interested in this role because…", 'interested in'], ['Could you tell me more about…', 'tell me more'], ['team player', 'team']],
  hotel: [['I have a reservation under…', 'reservation'], ['What time is breakfast?', 'breakfast'], ["What's the Wi-Fi password?", 'wifi'], ['Could I have a late check-out?', 'late check'], ['The air conditioning isn’t working', 'not working'], ['Could you call a taxi?', 'taxi']],
  airport: [["I'd like a window seat", 'window seat'], ['I have one bag to check in', 'check in'], ['What time is boarding?', 'boarding'], ['Which gate is it?', 'gate'], ['Is this carry-on OK?', 'carry on'], ['Here is my passport', 'passport']],
  doctor: [["I've had a headache since…", 'since'], ['I feel dizzy', 'dizzy'], ["I'm allergic to…", 'allergic'], ['How often should I take it?', 'how often'], ['It hurts when I…', 'hurts'], ['Do I need a prescription?', 'prescription']],
  shop: [['Do you have this in a medium?', 'in a'], ['Can I try it on?', 'try it on'], ['Where is the fitting room?', 'fitting room'], ['Is it on sale?', 'on sale'], ["I'd like to return this", 'return'], ["I'll take it", 'ill take']],
  free: [['In my opinion…', 'in my opinion'], ['I used to…', 'i used to'], ["I'm thinking about…", 'thinking about'], ['To be honest…', 'to be honest'], ['What do you think?', 'what do you think'], ['It depends on…', 'depends']],
  accounting: [['the invoice', 'invoice'], ['the deadline is…', 'deadline'], ['month-end closing', 'month end'], ['Could you double-check…', 'double check'], ['the expense report', 'expense'], ['the balance', 'balance']],
  finance: [["I'd like to save for…", 'save for'], ['What are the risks?', 'risk'], ['the interest rate', 'interest rate'], ['in the long term', 'long term'], ['my monthly budget', 'budget'], ['Is it a good idea to…', 'good idea']],
  tax: [["I'd like to file my tax return", 'tax return'], ['Am I eligible for a refund?', 'refund'], ['Which documents do I need?', 'documents'], ['the deadline', 'deadline'], ['I made a mistake on…', 'mistake'], ['How do I register…', 'register']],
  bank: [["I'd like to open an account", 'open an account'], ['transfer money to…', 'transfer'], ['What are the fees?', 'fee'], ['the exchange rate', 'exchange rate'], ['withdraw some cash', 'withdraw'], ['I lost my card', 'lost my card']],
};

const KEY = 'sp-challenge';
const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const hash = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
export const norm = t => t.toLowerCase().replace(/[’'`]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

// today's room and phrases, the same all day for everyone
export function today(sceneIds) {
  const day = dayKey(), h = hash(day), scene = sceneIds[h % sceneIds.length], list = PHRASES[scene] || [];
  const pick = [], used = new Set();
  for (let k = 0; pick.length < Math.min(3, list.length); k++) { const i = (h >>> (k * 3)) % list.length; if (!used.has(i)) { used.add(i); pick.push(list[i]); } if (k > 40) break; }
  list.forEach((x, i) => { if (pick.length < 3 && !used.has(i)) { used.add(i); pick.push(x); } });
  return { day, scene, phrases: pick.map(([show, match]) => ({ show, match })) };
}
export function loadDone(day) { try { return JSON.parse(localStorage.getItem(KEY) || '{}')[day] || []; } catch (e) { return []; } }
export function saveDone(day, done) {
  try { const all = JSON.parse(localStorage.getItem(KEY) || '{}'); all[day] = done; localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* private mode */ }
}
// which phrases (by index) appear in what the learner said
export function said(ch, lines) {
  const text = ' ' + lines.map(norm).join(' ') + ' ';
  return ch.phrases.map((p, i) => (text.includes(' ' + norm(p.match)) ? i : -1)).filter(i => i >= 0);
}
// a note for the character, so it leaves room for these phrases
export const note = ch => `Today the learner wants to practise these phrases: ${ch.phrases.map(p => `"${p.show}"`).join(', ')}. ` +
  'Without saying so, steer the conversation so they have natural chances to use them.';
