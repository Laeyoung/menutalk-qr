'use client';
// Spec S6 / 9.4 / 12.1: 탭 시작·탭 정지 토글, 15초 자동 정지, mp4 → webm, 실제 선택된 mime 기록
import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'stopped' | 'denied' | 'unsupported';

export function pickMime(): { mime: string; fileName: string } | null {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return null;
  if (MediaRecorder.isTypeSupported('audio/mp4')) return { mime: 'audio/mp4', fileName: 'req.mp4' };
  if (MediaRecorder.isTypeSupported('audio/webm')) return { mime: 'audio/webm', fileName: 'req.webm' };
  return null;
}

export function useRecorder(maxMs = 15_000) {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<{ blob: Blob; mime: string; fileName: string } | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!pickMime() || !navigator.mediaDevices?.getUserMedia) setState('unsupported');
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(() => {
    const r = recRef.current;
    if (r && r.state !== 'inactive') r.stop();
  }, []);

  const start = useCallback(async () => {
    const picked = pickMime();
    if (!picked || !navigator.mediaDevices?.getUserMedia) {
      setState('unsupported');
      return;
    }
    setResult(null);
    setState('requesting');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState('denied');
      return;
    }
    streamRef.current = stream;
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream, { mimeType: picked.mime });
    recRef.current = rec;
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      cleanup();
      const mime = rec.mimeType || picked.mime;
      setResult({ blob: new Blob(chunks, { type: mime }), mime, fileName: picked.fileName });
      setState('stopped');
    };
    rec.start(250);
    const t0 = Date.now();
    setElapsed(0);
    setState('recording');
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 250);
    stopTimerRef.current = setTimeout(() => stop(), maxMs);
  }, [cleanup, maxMs, stop]);

  const toggle = useCallback(() => {
    if (state === 'recording') stop();
    else if (state !== 'requesting') void start();
  }, [start, state, stop]);

  const reset = useCallback(() => {
    setResult(null);
    setState(pickMime() ? 'idle' : 'unsupported');
  }, []);

  return { state, elapsed, result, start, stop, toggle, reset };
}
