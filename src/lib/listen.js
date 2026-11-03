// Listening in on other learners: their lines (and their AI partner's replies) arrive as text through the
// classroom, and are read aloud here with the natural cloud voice, one after another.
const LEARNER_VOICES = ['troy', 'hannah', 'austin', 'diana', 'daniel', 'autumn'];

// the same learner always gets the same voice
export function voiceFor(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return LEARNER_VOICES[h % LEARNER_VOICES.length];
}

export class Listener {
  constructor() { this.q = []; this.busy = false; this.audio = null; this.muted = false; }

  // call inside a tap once, so phones allow playing sound later
  unlock() {
    if (!this.audio) this.audio = new Audio();
    this.audio.src = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQIAAAAAAA==';
    this.audio.play().catch(() => {});
  }

  say(text, voice) {
    if (!text || this.q.length > 6) return;          // fall behind rather than pile up
    this.q.push({ text, voice });
    if (!this.busy) this.next();
  }

  // while my own mic is open, hold other people's voices so speech recognition doesn't hear them
  mute(on) { this.muted = on; if (on && this.audio) this.audio.pause(); else if (!on && !this.busy) this.next(); }

  stop() { this.q = []; if (this.audio) this.audio.pause(); this.busy = false; }

  async next() {
    if (this.muted) return;
    const job = this.q.shift();
    if (!job) { this.busy = false; return; }
    this.busy = true;
    try {
      const r = await fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(job) });
      if (!r.ok) throw new Error('tts ' + r.status);
      const url = URL.createObjectURL(await r.blob());
      if (!this.audio) this.audio = new Audio();
      await new Promise(res => { this.audio.onended = this.audio.onerror = res; this.audio.src = url; this.audio.play().catch(res); });
      URL.revokeObjectURL(url);
    } catch (e) {
      // no cloud voice (e.g. running locally): the device voice will do
      await new Promise(res => {
        const u = new SpeechSynthesisUtterance(job.text); u.lang = 'en-US'; u.onend = u.onerror = res;
        speechSynthesis.speak(u);
      });
    }
    this.next();
  }
}
