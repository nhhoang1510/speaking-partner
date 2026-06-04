'use client';

import { useState, useEffect, useRef } from 'react';

const SENTENCES = [
  'The quick brown fox jumps over the lazy dog.',
  'Practice makes perfect when learning a new language.',
  'She sells seashells by the seashore.',
  'I am learning how to speak English fluently and confidently.',
  'Artificial intelligence is transforming the way we learn.',
];

export default function SpeakingPage() {
  const [idx, setIdx]           = useState(0);
  const [isRec, setIsRec]       = useState(false);
  const [transcript, setTrans]  = useState('');
  const [feedback, setFeedback] = useState(null);
  const recRef                  = useRef(null);
  const sentence                = SENTENCES[idx];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setFeedback({ ok: false, msg: 'Speech Recognition not supported. Use Chrome or Edge.' });
      return;
    }
    const r = new SR();
    r.continuous = false; r.interimResults = true; r.lang = 'en-US';
    r.onresult = (e) => {
      let t = '';
      for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
      setTrans(t);
    };
    r.onerror = (e) => {
      setIsRec(false);
      setFeedback({ ok: false, msg: `Error: ${e.error}. Please try again.` });
    };
    r.onend = () => setIsRec(false);
    recRef.current = r;
  }, []);

  useEffect(() => {
    if (!isRec && transcript) evaluate();
  }, [isRec]);

  const toggleRec = () => {
    if (!recRef.current) return;
    if (isRec) { recRef.current.stop(); return; }
    setTrans(''); setFeedback(null);
    try { recRef.current.start(); setIsRec(true); } catch (_) {}
  };

  const evaluate = () => {
    const clean = s => s.toLowerCase().replace(/[.,!?]/g, '').trim();
    const ok = clean(transcript) === clean(sentence) ||
      (clean(sentence).includes(clean(transcript)) && clean(transcript).length > clean(sentence).length * 0.75);
    setFeedback(ok
      ? { ok: true,  msg: '🎉 Excellent pronunciation! You nailed it!' }
      : { ok: false, msg: '🔁 Keep trying! Speak clearly and match the sentence.' });
  };

  const next = () => {
    setIdx(i => (i + 1) % SENTENCES.length);
    setTrans(''); setFeedback(null);
  };

  return (
    <div className="interactive-wrap">
      <div className="page-header fade-up" style={{ textAlign: 'center' }}>
        <h1 className="page-title">
          Speaking <span className="gradient-text">Practice</span>
        </h1>
        <p className="page-sub">Read the sentence aloud. Get instant pronunciation feedback.</p>
      </div>

      <div className="interactive-card fade-up d1">
        {/* Sentence counter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <span className="chip">Sentence {idx + 1} / {SENTENCES.length}</span>
          <button className="btn btn-ghost" style={{ padding: '0.35rem 0.9rem', fontSize: '0.85rem' }} onClick={next}>
            Next →
          </button>
        </div>

        {/* Sentence display */}
        <div className="listen-sentence">"{sentence}"</div>

        {/* Mic */}
        <button
          id="mic-btn"
          className={`mic-btn ${isRec ? 'recording' : ''}`}
          onClick={toggleRec}
          title={isRec ? 'Stop' : 'Start Recording'}
        >
          {isRec ? '⏹' : '🎤'}
        </button>

        <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
          {isRec ? '🔴 Listening… click to stop' : 'Click the mic to start'}
        </p>

        {/* Transcript */}
        {transcript && (
          <div className="transcript-box fade-up">
            <span style={{ color: 'var(--text-2)', fontSize: '0.85rem' }}>You said: </span>
            {transcript}
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`alert ${feedback.ok ? 'alert-success' : 'alert-error'} fade-up`} style={{ marginTop: '1rem' }}>
            {feedback.msg}
          </div>
        )}
      </div>
    </div>
  );
}
