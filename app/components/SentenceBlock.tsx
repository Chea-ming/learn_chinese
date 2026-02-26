'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Sentence, TtsVoice } from '@/lib/types';

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
function SlowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
    </svg>
  );
}

// ── Edge-TTS via API route ──────────────────────────────────────────────────
// onEnd is passed in so handlers are registered BEFORE audio.play() is called,
// which prevents the race condition where 'ended' fires before the handler is set.
async function speakEdgeTTS(
  text: string,
  voice: TtsVoice,
  audioRef: React.MutableRefObject<HTMLAudioElement | null>,
  onEnd: () => void,
  speed: number = 1,
): Promise<boolean> {
  try {
    const url = `/api/tts?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voice)}`;
    const res = await fetch(url);
    if (!res.ok) return false;

    const blob = await res.blob();
    // Guard: if the server returned an empty body, bail out
    if (blob.size === 0) return false;

    const objectUrl = URL.createObjectURL(blob);

    // Stop and clean up any previous audio element
    if (audioRef.current) {
      audioRef.current.pause();
      if (audioRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioRef.current.src);
      }
    }

    const audio = new Audio(objectUrl);
    audio.playbackRate = speed;
    audioRef.current = audio;

    // Register handlers BEFORE play() so we never miss the events
    audio.onended = onEnd;
    audio.onerror = onEnd;

    try {
      await audio.play();
      return true;
    } catch {
      onEnd();
      return false;
    }
  } catch {
    return false;
  }
}

// ── Browser TTS fallback ────────────────────────────────────────────────────
function speakBrowserTTS(text: string, onEnd: () => void, speed: number = 1) {
  if (!window.speechSynthesis) { onEnd(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  u.rate = 0.85 * speed;
  const v = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('zh'));
  if (v) u.voice = v;
  u.onend = onEnd;
  u.onerror = onEnd;
  window.speechSynthesis.speak(u);
}

// ───────────────────────────────────────────────────────────────────────────
interface SentenceBlockProps {
  sentence: Sentence;
  index: number;
  voice: TtsVoice;
}

export default function SentenceBlock({ sentence, index, voice }: SentenceBlockProps) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Update playback rate if audio is currently playing
  useEffect(() => {
    if (audioRef.current && playing) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed, playing]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setPlaying(false);
  }, []);

  const speak = useCallback(async () => {
    if (playing) { stop(); return; }
    setPlaying(true);

    const done = () => setPlaying(false);

    const success = await speakEdgeTTS(sentence.chinese, voice, audioRef, done, speed);
    if (!success) {
      // Fallback to browser TTS
      speakBrowserTTS(sentence.chinese, done, speed);
    }
  }, [playing, sentence.chinese, voice, stop, speed]);

  return (
    <div className="s-block" style={{ animationDelay: `${index * 35}ms` }}>
      <div className="s-top">
        <div className="s-texts">
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
          <div className="s-zh" onClick={speak} role="button" tabIndex={0}>
            {sentence.chinese}
          </div>
          <div className="s-py">{sentence.pinyin}</div>
          <div className="s-tr">{sentence.translation}</div>
          {sentence.usage && <div className="s-usage">{sentence.usage}</div>}
          {sentence.formality && <div className="s-formality">Formality: {sentence.formality}</div>}
        </div>
        <div className="controls">
          <button
            className={`play-btn${playing ? ' playing' : ''}`}
            onClick={speak}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <div className="speed-control">
            <button
              className="speed-btn"
              onClick={() => setSpeed(Math.max(0.5, speed - 0.25))}
              title="Slower"
              aria-label="Slower"
            >
              <SlowIcon />
            </button>
            <span className="speed-value">{(speed * 100).toFixed(0)}%</span>
            <button
              className="speed-btn"
              onClick={() => setSpeed(Math.min(2, speed + 0.25))}
              title="Faster"
              aria-label="Faster"
            >
              <span style={{ fontWeight: 'bold' }}>+</span>
            </button>
          </div>
        </div>
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
