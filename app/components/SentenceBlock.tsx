'use client';

import { useState, useCallback } from 'react';
import type { Sentence } from '@/lib/types';

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

interface SentenceBlockProps {
  sentence: Sentence;
  index: number;
}

export default function SentenceBlock({ sentence, index }: SentenceBlockProps) {
  const [playing, setPlaying] = useState(false);

  const speak = useCallback(() => {
    if (!window.speechSynthesis) return;

    if (playing) {
      window.speechSynthesis.cancel();
      setPlaying(false);
      return;
    }

    window.speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(sentence.chinese);
    u.lang = 'zh-CN';
    u.rate = 0.85;
    const v = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('zh'));
    if (v) u.voice = v;

    setPlaying(true);
    u.onend = () => setPlaying(false);
    u.onerror = () => setPlaying(false);
    window.speechSynthesis.speak(u);
  }, [playing, sentence.chinese]);

  return (
    <div className="s-block" style={{ animationDelay: `${index * 35}ms` }}>
      <div className="s-top">
        <div className="s-texts">
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
          <div className="s-zh" onClick={speak} role="button" tabIndex={0}>{sentence.chinese}</div>
          <div className="s-py">{sentence.pinyin}</div>
          <div className="s-tr">{sentence.translation}</div>
        </div>
        <button
          className={`play-btn${playing ? ' playing' : ''}`}
          onClick={speak}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
      </div>

      {sentence.words && sentence.words.length > 0 && (
        <div className="words-row">
          {sentence.words.map((w, i) => (
            <div key={i} className="wchip">
              <span className="wc-zh">{w.zh}</span>
              <span className="wc-py">{w.py}</span>
              <div className="wc-tip">{w.meaning}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
