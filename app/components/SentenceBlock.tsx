'use client';

import { useState, useCallback, useRef } from 'react';
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

// ── 1. Static pre-generated audio ─────────────────────────────────────────
async function speakStatic(
  catId: string,
  topicId: string,
  index: number,
  speed: number,
  audioRef: React.MutableRefObject<HTMLAudioElement | null>,
  onEnd: () => void,
): Promise<boolean> {
  try {
    const url = `/audio/${catId}/${topicId}/${index}.mp3`;
    const head = await fetch(url, { method: 'HEAD' });
    if (!head.ok) return false;

    stopAudio(audioRef);
    const audio = new Audio(url);
    audio.playbackRate = speed;
    audioRef.current = audio;
    audio.onended = onEnd;
    audio.onerror = onEnd;
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

// ── 2. Live Edge-TTS API ───────────────────────────────────────────────────
async function speakEdgeTTS(
  text: string,
  voice: TtsVoice,
  speed: number,
  audioRef: React.MutableRefObject<HTMLAudioElement | null>,
  onEnd: () => void,
): Promise<boolean> {
  try {
    const url = `/api/tts?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voice)}`;
    const res = await fetch(url);
    if (!res.ok) return false;

    const blob = await res.blob();
    if (blob.size === 0) return false;

    stopAudio(audioRef);
    const audio = new Audio(URL.createObjectURL(blob));
    audio.playbackRate = speed;
    audioRef.current = audio;
    audio.onended = onEnd;
    audio.onerror = onEnd;
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

// ── 3. Browser TTS fallback ────────────────────────────────────────────────
function speakBrowserTTS(text: string, speed: number, onEnd: () => void) {
  if (!window.speechSynthesis) { onEnd(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  u.rate  = 0.85 * speed;
  const v = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('zh'));
  if (v) u.voice = v;
  u.onend  = onEnd;
  u.onerror = onEnd;
  window.speechSynthesis.speak(u);
}

function stopAudio(audioRef: React.MutableRefObject<HTMLAudioElement | null>) {
  if (!audioRef.current) return;
  audioRef.current.pause();
  if (audioRef.current.src.startsWith('blob:')) {
    URL.revokeObjectURL(audioRef.current.src);
  }
  audioRef.current = null;
}

// ───────────────────────────────────────────────────────────────────────────
interface SentenceBlockProps {
  sentence: Sentence;
  /** Position within the topic — used for static file lookup & voice rotation */
  index: number;
  voice: TtsVoice;
  catId: string;
  topicId: string;
}

export default function SentenceBlock({ sentence, index, voice, catId, topicId }: SentenceBlockProps) {
  const [playing, setPlaying] = useState(false);
  const [speed,   setSpeed  ] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    stopAudio(audioRef);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setPlaying(false);
  }, []);

  const speak = useCallback(async () => {
    if (playing) { stop(); return; }
    setPlaying(true);

    const done = () => setPlaying(false);

    // Priority: static file → live API → browser TTS
    const ok =
      await speakStatic(catId, topicId, index, speed, audioRef, done) ||
      await speakEdgeTTS(sentence.chinese, voice, speed, audioRef, done);

    if (!ok) speakBrowserTTS(sentence.chinese, speed, done);
  }, [playing, sentence.chinese, voice, catId, topicId, index, speed, stop]);

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
          {sentence.usage    && <div className="s-usage">{sentence.usage}</div>}
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
            <button className="speed-btn" onClick={() => setSpeed(s => Math.max(0.5, s - 0.25))} title="Slower">−</button>
            <span className="speed-value">{Math.round(speed * 100)}%</span>
            <button className="speed-btn" onClick={() => setSpeed(s => Math.min(2, s + 0.25))} title="Faster">+</button>
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
