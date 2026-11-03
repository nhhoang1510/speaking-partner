// Conversation engine, independent of React: mic -> speech recognition -> AI reply (streamed) ->
// speech synthesis sentence by sentence -> mic again. Every change is pushed to onChange(state).
import { chatStream, chatJSON } from './llm.js';
import { systemPrompt, OPENER } from '../scenes.js';

const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
export const canListen = !!SR;

export function cleanSpoken(t) {
  return t.replace(/\*[^*]*\*/g, '').replace(/[#_`~>]/g, '')
          .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/[ \t]+/g, ' ').trim();
}
const norm = s => s.toLowerCase().replace(/[^a-z0-9' ]/g, '').replace(/\s+/g, ' ').trim();

// few-shot: a 3B model misses most mistakes without examples
const FIX_PROMPT = `You are an English speaking coach. Check one sentence a learner said out loud. It came from speech recognition: ignore punctuation and capital letters.
Look carefully for these mistakes: articles (a/an/the), verb tense and verb form, subject-verb agreement, plurals, prepositions, word choice, word order, missing words.
If there is any such mistake, set natural to false, write the corrected sentence in "better" (keep their meaning and simple words), and explain in "note" in at most 12 simple English words.
If the sentence is already correct, natural spoken English, set natural to true and leave "better" and "note" empty.

Examples:
Learner: "i want a ice coffee" -> {"natural": false, "better": "I'd like an iced coffee.", "note": "Use 'an' before a vowel sound; the drink is 'iced' coffee."}
Learner: "she go to school yesterday" -> {"natural": false, "better": "She went to school yesterday.", "note": "Past time needs the past tense: went."}
Learner: "i'm doing great thanks" -> {"natural": true, "better": "", "note": ""}`;
const FIX_SCHEMA = { type: 'object', properties: { natural: { type: 'boolean' }, better: { type: 'string' }, note: { type: 'string' } }, required: ['natural', 'better', 'note'] };

export class Engine {
  constructor(onChange) {
    this.onChange = onChange;
    this.settings = {};                 // url, model, level, voice, rate, pause, feedback (set by the UI)
    this.s = { phase: 'idle', status: 'Chọn một tình huống để bắt đầu', msgs: [], scene: null, summary: null };
    this.history = []; this.turns = []; this.fixes = []; this.lastAi = '';
    this.abort = null; this.streaming = false; this.speakQ = 0; this.utts = [];
    this.rec = null; this.recText = ''; this.recTimer = null; this.recWanted = false; this.interim = null;
    this.idc = 0;
  }

  emit() { this.onChange({ ...this.s, msgs: [...this.s.msgs] }); }
  set(patch) { Object.assign(this.s, patch); this.emit(); }
  status(t) { this.set({ status: t }); }
  add(m) { m.id = ++this.idc; this.s.msgs.push(m); this.emit(); return m; }
  upd(m, patch) { Object.assign(m, patch); this.emit(); }
  remove(m) { this.s.msgs = this.s.msgs.filter(x => x !== m); this.emit(); }
  llm() { return { url: this.settings.url, model: this.settings.model }; }

  // ---------------- conversation ----------------
  start(scene) {
    this.stopAll();
    this.history = [{ role: 'system', content: systemPrompt(scene, this.settings.level) }, { role: 'user', content: OPENER }];
    this.turns = []; this.fixes = []; this.lastAi = '';
    this.s.msgs = []; this.set({ scene, summary: null });
    this.aiTurn();
  }

  async aiTurn() {
    this.set({ phase: 'thinking', status: `${this.s.scene.name} đang nghĩ…` });
    const m = this.add({ who: 'ai', text: '' });
    this.abort = new AbortController(); this.streaming = true;
    let full = '', buf = '';
    try {
      for await (const piece of chatStream({ ...this.llm(), messages: this.history, signal: this.abort.signal,
                                             options: { temperature: 0.8, num_predict: 160, num_ctx: 4096 } })) {
        full += piece; buf += piece; this.upd(m, { text: cleanSpoken(full) });
        let mm;                                           // speak each finished sentence while the rest is generated
        while ((mm = buf.match(/^([\s\S]*?[.!?…]+["'”)]?)\s+/))) { this.say(mm[1]); buf = buf.slice(mm[0].length); }
      }
      if (buf.trim()) this.say(buf);
    } catch (e) {
      if (e.name !== 'AbortError') { this.upd(m, { text: '', error: 'Không gọi được AI: ' + e.message }); this.status('Lỗi kết nối AI — xem phần Cài đặt AI'); }
    }
    this.streaming = false; this.abort = null;
    full = cleanSpoken(full);
    if (full) { this.history.push({ role: 'assistant', content: full }); this.lastAi = full; this.upd(m, { text: full, done: true }); }
    else if (!m.error) this.remove(m);
    this.maybeDone();
  }

  leave() { this.stopAll(); this.s.msgs = []; this.set({ scene: null, summary: null, status: '' }); }

  learnerSaid(text, m) {
    m = m || this.add({ who: 'me', text });
    const prev = this.lastAi;
    this.history.push({ role: 'user', content: text });
    this.turns.push(text);
    this.aiTurn().then(() => { if (this.settings.feedback) this.feedback(m, prev, text); });
  }

  typed(text) { if (!this.s.scene || !text.trim()) return; this.stopAll(); this.learnerSaid(text.trim()); }

  // ---------------- speech out ----------------
  say(text, rate) {
    text = cleanSpoken(text); if (!text) return;
    if (this.s.phase === 'thinking') this.set({ phase: 'speaking' });
    const u = new SpeechSynthesisUtterance(text);
    const v = speechSynthesis.getVoices().find(x => x.name === this.settings.voice);
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
    u.rate = rate || this.settings.rate || 1;
    this.speakQ++; this.utts.push(u);                    // keep a reference: Chrome drops events of GC'd utterances
    u.onend = u.onerror = () => { this.speakQ = Math.max(0, this.speakQ - 1); this.utts = this.utts.filter(x => x !== u); this.maybeDone(); };
    if (this.s.scene) this.status(`${this.s.scene.name} đang nói… (Space để ngắt lời)`);
    speechSynthesis.speak(u);
  }
  replay(text, rate) { this.stopListening(); this.cancelSpeech(); this.say(text, rate); }
  cancelSpeech() { this.speakQ = 0; this.utts = []; speechSynthesis.cancel(); }

  maybeDone() {
    if (this.streaming || this.speakQ > 0) return;
    if (this.s.phase === 'speaking' || this.s.phase === 'thinking') { this.set({ phase: 'idle' }); this.listen(); }
    else if (this.s.phase === 'idle' && this.s.scene) this.status('Bấm micro hoặc Space để nói');
  }

  // ---------------- speech in ----------------
  listen() {
    if (!this.s.scene) return;
    if (!SR) { this.status('Trình duyệt không nhận giọng nói được — hãy dùng Chrome, hoặc gõ câu trả lời'); return; }
    this.stopListening(true);
    const rec = new SR();
    rec.lang = 'en-US'; rec.continuous = true; rec.interimResults = true;
    this.rec = rec; this.recText = ''; this.recWanted = true;
    rec.onresult = e => {
      let fin = '', interim = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) fin += r[0].transcript; else interim += r[0].transcript;
      }
      this.recText = (fin + ' ' + interim).replace(/\s+/g, ' ').trim();
      if (!this.interim) this.interim = this.add({ who: 'me', text: '', interim: true });
      this.upd(this.interim, { text: this.recText || '…' });
      clearTimeout(this.recTimer);
      this.recTimer = setTimeout(() => this.finishListening(), (this.settings.pause || 1.4) * 1000);   // a pause ends the turn
    };
    rec.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { this.recWanted = false; this.set({ phase: 'idle', status: 'Chưa cho phép micro — bấm biểu tượng ổ khóa trên thanh địa chỉ để cho phép' }); }
      else if (e.error === 'network') { this.recWanted = false; this.set({ phase: 'idle', status: 'Nhận giọng nói cần Internet (Chrome dùng máy chủ Google)' }); }
    };
    rec.onend = () => {                                  // Chrome stops by itself after a long silence: keep listening
      if (this.rec === rec && this.recWanted && this.s.phase === 'listening') { try { rec.start(); } catch (e) { /* already started */ } }
    };
    try { rec.start(); this.set({ phase: 'listening', status: 'Đang nghe… (ngừng nói một chút là tự gửi)' }); } catch (e) { /* already started */ }
  }

  stopListening(keepBubble) {
    clearTimeout(this.recTimer); this.recWanted = false;
    if (this.rec) { const r = this.rec; this.rec = null; try { r.abort(); } catch (e) { /* not started */ } }
    if (!keepBubble && this.interim) { this.remove(this.interim); this.interim = null; }
    if (this.s.phase === 'listening') this.set({ phase: 'idle', status: 'Bấm micro hoặc Space để nói' });
  }

  finishListening() {
    const text = this.recText.trim(), m = this.interim;
    this.interim = null; this.stopListening(true);
    if (!text) { if (m) this.remove(m); this.status('Không nghe thấy gì — bấm micro để nói lại'); return; }
    this.upd(m, { text, interim: false });
    this.learnerSaid(text, m);
  }

  // the mic button / Space: talk, stop talking, or interrupt the AI like in a real conversation
  mic() {
    if (!this.s.scene) return;
    const p = this.s.phase;
    if (p === 'listening') { this.recText ? this.finishListening() : this.stopListening(); return; }
    if (p === 'speaking' || p === 'thinking') {
      if (this.abort) this.abort.abort();
      this.streaming = false; this.cancelSpeech();
      this.set({ phase: 'idle' });
    }
    this.listen();
  }

  stopAll() {
    if (this.abort) this.abort.abort();
    this.streaming = false; this.cancelSpeech(); this.stopListening();
    this.set({ phase: 'idle' });
  }

  // ---------------- coaching ----------------
  async feedback(m, prev, text) {
    try {
      const out = await chatJSON({ ...this.llm(), schema: FIX_SCHEMA, messages: [
        { role: 'system', content: FIX_PROMPT },
        { role: 'user', content: `Partner said: "${prev}"\nLearner said: "${text}"` }] });
      if (out.natural || !out.better || norm(out.better) === norm(text)) this.upd(m, { fix: { ok: true } });
      else { const fix = { ok: false, better: out.better, note: out.note || '' }; this.fixes.push({ said: text, ...fix }); this.upd(m, { fix }); }
    } catch (e) { /* feedback is optional */ }
  }

  async suggest(m) {
    this.upd(m, { suggest: { loading: true } });
    try {
      const out = await chatJSON({ ...this.llm(), options: { temperature: 0.7 },
        schema: { type: 'object', properties: { replies: { type: 'array', items: { type: 'string' } } }, required: ['replies'] },
        messages: [
          { role: 'system', content: `Suggest what an English learner (${this.settings.level} level) could naturally say next in this conversation. Give 3 different short replies (one sentence each), in natural spoken English.` },
          { role: 'user', content: `Situation: ${this.s.scene.setting}\nThe other person just said: "${m.text}"` }] });
      this.upd(m, { suggest: { replies: (out.replies || []).slice(0, 3) } });
    } catch (e) { this.upd(m, { suggest: { error: true } }); }
  }

  async end() {
    this.stopAll();
    const words = this.turns.join(' ').split(/\s+/).filter(Boolean).length;
    const summary = { turns: this.turns.length, words, fixes: [...this.fixes], loading: this.turns.length > 0 };
    this.set({ summary });
    if (!this.turns.length) return;
    try {
      const out = await chatJSON({ ...this.llm(), options: { temperature: 0.3 },
        schema: { type: 'object', properties: { tips: { type: 'array', items: { type: 'string' } }, phrases: { type: 'array', items: { type: 'string' } } }, required: ['tips', 'phrases'] },
        messages: [
          { role: 'system', content: 'You are a kind English speaking coach. Read what the learner said in a spoken practice conversation and give exactly 3 short, concrete tips (one sentence each) to sound more natural and fluent next time, plus 3 useful words or phrases for this situation. Simple English.' },
          { role: 'user', content: `Situation: ${this.s.scene.setting}\nLearner turns:\n- ${this.turns.join('\n- ')}` }] });
      this.set({ summary: { ...summary, loading: false, tips: (out.tips || []).slice(0, 3), phrases: (out.phrases || []).slice(0, 3) } });
    } catch (e) { this.set({ summary: { ...summary, loading: false } }); }
  }
}
