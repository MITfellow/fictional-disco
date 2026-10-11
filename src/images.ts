import type { Asset } from './types';
import { uid } from './normalize';

/** Loads any browser-supported image (png/jpg/webp/gif/svg…) and re-encodes it as PNG/JPEG for the PDF engine. */
export async function fileToAsset(file: File, maxDim = 1800): Promise<Asset> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error(`Could not read image ${file.name}`));
      i.src = url;
    });
    let w = img.naturalWidth || 800;
    let h = img.naturalHeight || 600;
    const k = Math.min(1, maxDim / Math.max(w, h));
    w = Math.round(w * k);
    h = Math.round(h * k);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const keepAlpha = /png|svg|gif|webp/.test(file.type);
    if (!keepAlpha) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = keepAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.88);
    return { id: uid('img'), name: file.name || 'image', dataUrl, width: w, height: h };
  } finally {
    URL.revokeObjectURL(url);
  }
}
