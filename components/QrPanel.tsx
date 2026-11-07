'use client';
// Spec 7.8 / 12.1: <QrPanel url shortUrl size fullscreen /> — qrcode 1.5.4, 오류 정정 M, 여백 2
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';

/** (Spec 7.8 P2) A6 인쇄용 카드: 1240×1748px(105×148mm, 300dpi) */
export async function downloadA6Card(url: string, shortUrl: string, storeName: string | null) {
  const W = 1240, H = 1748;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ff2d7a';
  ctx.fillRect(0, 0, W, 24);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0b0b10';
  const font = 'system-ui, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  ctx.font = `bold 84px ${font}`;
  ctx.fillText(storeName || 'Menu', W / 2, 190, W - 120);
  ctx.font = `600 52px ${font}`;
  ctx.fillText('Scan for menu', W / 2, 300);
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, url, { errorCorrectionLevel: 'M', margin: 2, width: 860 });
  ctx.drawImage(qr, (W - 860) / 2, 360);
  ctx.font = `600 50px ${font}`;
  ctx.fillText('English · 日本語 · 中文 · Español', W / 2, 1320);
  ctx.font = `40px ${font}`;
  ctx.fillStyle = '#5b6080';
  ctx.fillText('Listen to dishes · Tell staff your allergies', W / 2, 1400);
  ctx.font = `36px ui-monospace, monospace`;
  ctx.fillText(shortUrl, W / 2, 1560, W - 120);
  ctx.font = `30px ${font}`;
  ctx.fillText('메뉴톡 QR', W / 2, 1660);
  const a = document.createElement('a');
  a.href = c.toDataURL('image/png');
  a.download = 'menu-qr-a6.png';
  a.click();
}

export function QrPanel({ url, shortUrl, size = 512, label, storeName }: { url: string; shortUrl?: string; size?: number; label?: string; storeName?: string | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [full, setFull] = useState(false);
  const [px, setPx] = useState(size);

  useEffect(() => {
    if (!full) {
      setPx(size);
      return;
    }
    const calc = () => setPx(Math.floor(Math.min(window.innerWidth, window.innerHeight) * 0.8));
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [full, size]);

  useEffect(() => {
    if (!ref.current) return;
    QRCode.toCanvas(ref.current, url, { errorCorrectionLevel: 'M', margin: 2, width: px }).catch(() => {});
  }, [url, px]);

  return (
    <div className={full ? 'fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-card-2 p-4' : 'flex flex-col items-center gap-2'}>
      <canvas ref={ref} style={{ width: full ? px : '100%', maxWidth: full ? undefined : size, height: 'auto' }} aria-label={`QR: ${url}`} />
      {label && <div className="text-center text-sm text-muted">{label}</div>}
      <div className={full ? 'font-mono text-3xl font-bold tracking-tight text-ink' : 'break-all text-center font-mono text-sm'}>{shortUrl ?? url}</div>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => setFull((f) => !f)} className="rounded-full border border-line bg-card px-4 py-2 text-sm">
          {full ? '닫기' : 'QR 크게'}
        </button>
        {!full && (
          <a href={url} target="_blank" rel="noreferrer" className="rounded-full border border-line bg-card px-4 py-2 text-sm">
            새 창에서 손님 화면 보기
          </a>
        )}
        {!full && storeName !== undefined && (
          <button type="button" onClick={() => downloadA6Card(url, shortUrl ?? url, storeName)} className="rounded-full border border-line bg-card px-4 py-2 text-sm">
            A6 카드 PNG 저장
          </button>
        )}
      </div>
    </div>
  );
}
