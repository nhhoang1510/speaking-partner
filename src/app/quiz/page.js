'use client';

import { useState, useEffect, useCallback } from 'react';

const VOCAB_BANK = [
  { word: 'Resilient',   definition: 'Able to withstand or recover quickly from difficult conditions.' },
  { word: 'Meticulous',  definition: 'Showing great attention to detail; very careful and precise.' },
  { word: 'Ambiguous',   definition: 'Open to more than one interpretation; having a double meaning.' },
  { word: 'Ephemeral',   definition: 'Lasting for a very short time.' },
  { word: 'Eloquent',    definition: 'Fluent or persuasive in speaking or writing.' },
  { word: 'Pragmatic',   definition: 'Dealing with things sensibly and realistically.' },
  { word: 'Inevitable',  definition: 'Certain to happen; unavoidable.' },
  { word: 'Alleviate',   definition: 'Make suffering or a problem less severe.' },
  { word: 'Lucid',       definition: 'Expressed clearly; easy to understand.' },
  { word: 'Tenacious',   definition: 'Tending to keep a firm hold; persistent.' },
];

const TOTAL = 10;

function buildQuestion(count) {
  if (count >= TOTAL) return null;
  const correct = VOCAB_BANK[Math.floor(Math.random() * VOCAB_BANK.length)];
  const distractors = [];
  while (distractors.length < 3) {
    const r = VOCAB_BANK[Math.floor(Math.random() * VOCAB_BANK.length)];
    if (r.word !== correct.word && !distractors.includes(r.word)) distractors.push(r.word);
  }
  const options = [correct.word, ...distractors].sort(() => Math.random() - 0.5);
  return { correct, options };
}

export default function QuizPage() {
  const [q, setQ]           = useState(() => buildQuestion(0));
  const [count, setCount]   = useState(0);
  const [score, setScore]   = useState(0);
  const [picked, setPicked] = useState(null);   // selected word
  const [done, setDone]     = useState(false);

  const next = useCallback((nextCount) => {
    const nq = buildQuestion(nextCount);
    if (!nq) { setDone(true); return; }
    setQ(nq);
    setPicked(null);
  }, []);

  const handleAnswer = (word) => {
    if (picked) return;
    const isCorrect = word === q.correct.word;
    if (isCorrect) setScore(s => s + 1);
    setPicked(word);
    const nc = count + 1;
    setCount(nc);
    setTimeout(() => next(nc), 1800);
  };

  const restart = () => {
    setScore(0); setCount(0); setDone(false); setPicked(null);
    setQ(buildQuestion(0));
  };

  const pct = Math.round((count / TOTAL) * 100);
  const emoji = score >= 8 ? '🏆' : score >= 5 ? '🎉' : '💪';

  if (done) return (
    <div className="quiz-wrap">
      <div className="result-screen">
        <div className="result-emoji">{emoji}</div>
        <h1 className="result-title">Quiz Complete!</h1>
        <p className="result-score">You scored</p>
        <span className="score-highlight">{score}/{TOTAL}</span>
        <p className="result-score" style={{ marginBottom: '2.5rem' }}>
          {score >= 8 ? 'Outstanding! Keep it up.' : score >= 5 ? 'Good job! Review the ones you missed.' : 'Keep practicing — you\'ll get there!'}
        </p>
        <button className="btn btn-primary" onClick={restart}>Play Again</button>
      </div>
    </div>
  );

  if (!q) return null;

  return (
    <div className="quiz-wrap">
      <div className="page-header fade-up">
        <h1 className="page-title">
          Vocabulary <span className="gradient-text">Quiz</span>
        </h1>
        <p className="page-sub">Read the definition and pick the correct word.</p>
      </div>

      {/* Progress */}
      <div className="fade-up d1">
        <div className="quiz-header">
          <span style={{ color: 'var(--text-2)', fontSize: '0.9rem' }}>
            Question <strong style={{ color: 'var(--text-1)' }}>{count + 1}</strong> / {TOTAL}
          </span>
          <div className="score-badge">⭐ {score}</div>
        </div>
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Question */}
      <div className="question-card fade-up d2">
        <p className="question-label">What word matches this definition?</p>
        <p className="question-text">"{q.correct.definition}"</p>
      </div>

      {/* Options */}
      <div className="options-grid fade-up d3">
        {q.options.map((opt, i) => {
          let cls = 'option-btn';
          if (picked) {
            if (opt === q.correct.word) cls += ' correct';
            else if (opt === picked)    cls += ' wrong';
          }
          return (
            <button
              key={i}
              id={`opt-${i}`}
              className={cls}
              onClick={() => handleAnswer(opt)}
              disabled={!!picked}
            >
              <span style={{ color: 'var(--text-3)', marginRight: '0.5rem', fontSize: '0.85rem' }}>
                {String.fromCharCode(65 + i)}.
              </span>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
