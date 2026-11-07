// Spec S2 / 12.1: 브라우저에서 긴 변 2048px JPEG로 줄인다(도메인 무관). HEIC 등 디코딩 실패는 UnsupportedImageError.
export class UnsupportedImageError extends Error {}

export async function resizeToJpeg(
  file: Blob,
  opts: { maxSide?: number; quality?: number } = {},
): Promise<{ dataUrl: string; width: number; height: number; bytes: number }> {
  const maxSide = opts.maxSide ?? 2048;
  const quality = opts.quality ?? 0.85;
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  } catch {
    throw new UnsupportedImageError('decode failed');
  }
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const width = Math.round(bmp.width * scale);
  const height = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new UnsupportedImageError('no canvas');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bmp, 0, 0, width, height);
  bmp.close?.();
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new UnsupportedImageError('encode failed'))), 'image/jpeg', quality));
  const dataUrl: string = await new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = () => rej(new UnsupportedImageError('read failed'));
    fr.readAsDataURL(blob);
  });
  return { dataUrl, width, height, bytes: blob.size };
}
