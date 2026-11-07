'use client';
// Spec S5 / 9.4: 페이지 전체에 <audio> 하나. 클릭 핸들러 안에서 동기적으로 src 지정 + play().
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export type PlayState = 'idle' | 'loading' | 'playing' | 'ended' | 'error' | 'blocked';

interface AudioCtx {
  /** 반드시 클릭 핸들러 안에서 동기적으로 호출한다(await 뒤에 부르지 않는다) */
  play: (key: string, src: string) => void;
  stop: () => void;
  state: PlayState;
  current: string | null;
}

const Ctx = createContext<AudioCtx | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [state, setState] = useState<PlayState>('idle');
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const on = (s: PlayState) => () => setState(s);
    const handlers: [string, () => void][] = [
      ['playing', on('playing')],
      ['ended', on('ended')],
      ['error', on('error')],
      ['waiting', on('loading')],
    ];
    handlers.forEach(([e, h]) => a.addEventListener(e, h));
    return () => handlers.forEach(([e, h]) => a.removeEventListener(e, h));
  }, []);

  const play = useCallback((key: string, src: string) => {
    const a = ref.current;
    if (!a) return;
    window.speechSynthesis?.cancel();
    setCurrent(key);
    setState('loading');
    a.src = src;
    const p = a.play();
    if (p && typeof p.catch === 'function') {
      p.catch((err: DOMException) => setState(err?.name === 'NotAllowedError' ? 'blocked' : 'error'));
    }
  }, []);

  const stop = useCallback(() => {
    const a = ref.current;
    if (a) {
      a.pause();
      a.removeAttribute('src');
      a.load();
    }
    window.speechSynthesis?.cancel();
    setState('idle');
    setCurrent(null);
  }, []);

  return (
    <Ctx.Provider value={{ play, stop, state, current }}>
      {children}
      <audio ref={ref} preload="none" playsInline className="hidden" />
    </Ctx.Provider>
  );
}

export function useAudio(): AudioCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('AudioProvider missing');
  return c;
}

/** speechSynthesis 폴백(같은 tts_text). 해당 언어 음성이 없으면 false */
export function speakWithBrowser(text: string, bcp47: string): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;
  const voices = window.speechSynthesis.getVoices();
  const base = bcp47.split('-')[0];
  const voice = voices.find((v) => v.lang.replace('_', '-') === bcp47) ?? voices.find((v) => v.lang.toLowerCase().startsWith(base));
  if (voices.length && !voice) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = bcp47;
  if (voice) u.voice = voice;
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
  return true;
}
