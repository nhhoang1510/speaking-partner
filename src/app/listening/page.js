'use client';

import { useState, useEffect } from 'react';

const EXERCISES = [
  { text: 'Technology is evolving rapidly every day.',             missing: ['evolving', 'rapidly'] },
  { text: 'Consistency is the key to mastering any skill.',        missing: ['Consistency', 'mastering'] },
  { text: 'The phenomenon of global warming affects everyone.',    missing: ['phenomenon', 'affects'] },
  { text: 'It is crucial to understand the underlying principles.', missing: ['crucial', 'underlying'] },
];

export default function ListeningPage() {
  const [exIdx, setExIdx]       = useState(0);
  const [inputs, setInputs]     = useState({});
  const [feedback, setFeedback] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [voices, setVoices]     = useState([]);

  const ex = EXERCISES[exIdx];

  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('en')));
    load();
    if (window.speechSynthesis.onvoiceschanged !== undefined) window.speechSynthesis.onvoiceschanged = load;
  }, []);

  const speak = (rate = 1) => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(ex.text);
    u.voice = voices.find(v => v.name.includes('Google') && v.lang === 'en-US') || voices.find(v => v.lang === 'en-US') || voices[0];
    u.rate = rate;
    window.speechSynthesis.speak(u);
  };

  const check = () => {
    const allOk = ex.missing.every((w, i) => (inputs[i] || '').toLowerCase().trim() === w.toLowerCase());
    setFeedback(allOk
      ? { ok: true,  msg: '✅ Perfect! All missing words are correct.' }
      : { ok: false, msg: '❌ Some words are wrong. Try listening again!' });
  };

  const nextEx = () => {
    setExIdx(i => (i + 1) % EXERCISES.length);
    setInputs({}); setFeedback(null); setRevealed(false);
  };

  /* render sentence with inline inputs */
  const renderSentence = () => {
    const parts = [];
    let remaining = ex.text;
    ex.missing.forEach((word, i) => {
      const split = remaining.split(word);
      parts.push(<span key={`t${i}`}>{split[0]}</span>);
      parts.push(
        <input
          key={`in${i}`}
          type="text"
          className="search-input"
          style={{ width: 130, padding: '0.35rem 0.65rem', display: 'inline-block', margin: '0 0.4rem', fontSize: '1rem', borderRadius: 10 }}
          placeholder="…"
          value={inputs[i] || ''}
          onChange={e => { setInputs(p => ({ ...p, [i]: e.target.value })); setFeedback(null); }}
        />
      );
      remaining = split.slice(1).join(word);
    });
    parts.push(<span key="end">{remaining}</span>);
    return parts;
  };

  return (
    <div className="interactive-wrap">
      <div className="page-header fade-up" style={{ textAlign: 'center' }}>
        <h1 className="page-title">
          Active <span className="gradient-text">Listening</span>
        </h1>
        <p className="page-sub">Listen and type the missing words. Use 🐢 for slow playback.</p>
      </div>

      <div className="interactive-card fade-up d1">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.75rem' }}>
          <span className="chip">Exercise {exIdx + 1} / {EXERCISES.length}</span>
          <button className="btn btn-ghost" style={{ padding: '0.35rem 0.9rem', fontSize: '0.85rem' }} onClick={nextEx}>
            Next →
          </button>
        </div>

        {/* Play buttons */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '2rem' }}>
          <button className="btn btn-primary" onClick={() => speak(1)} id="play-normal">
            🔊 Normal Speed
          </button>
          <button className="btn btn-ghost" onClick={() => speak(0.6)} id="play-slow">
            🐢 Slow Speed
          </button>
        </div>

        {/* Sentence */}
        <div className="listen-sentence" style={{ textAlign: 'left', lineHeight: 2.4 }}>
          {renderSentence()}
        </div>

        {/* Answers revealed */}
        {revealed && (
          <div className="alert alert-success fade-up" style={{ marginTop: '1rem' }}>
            <strong>Answers:</strong> {ex.missing.join(', ')}
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`alert ${feedback.ok ? 'alert-success' : 'alert-error'} fade-up`} style={{ marginTop: '1rem' }}>
            {feedback.msg}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '2rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={check} id="check-btn">Check Answers</button>
          <button className="btn btn-ghost" onClick={() => setRevealed(true)}>Show Answers</button>
        </div>
      </div>
    </div>
  );
}
