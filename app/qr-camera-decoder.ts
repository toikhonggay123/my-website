/// <reference types="vite/client" />
import workerUrl from './qr-decode.worker?worker&url';

export async function createCameraDecoder(canvas: HTMLCanvasElement) {
 let detector: any = null, worker: Worker | null = null, closed = false, frame = 0;
 let workerFailed = false, decoding = false;
 let pending: ((value: string | null) => void) | null = null;
 let timeout: ReturnType<typeof setTimeout> | null = null;
 const Native = (window as any).BarcodeDetector;
 try { if (Native && (await Native.getSupportedFormats()).includes('qr_code')) detector = new Native({formats: ['qr_code']}); } catch {}
 const ctx = canvas.getContext('2d', {willReadFrequently: true});
 if (!ctx) throw Error('Không khởi tạo được bộ đọc QR. Hãy tải lại trang và thử lại.');

 function finish(value: string | null) {
  if (timeout) clearTimeout(timeout);
  timeout = null;
  const resolve = pending;
  pending = null;
  resolve?.(value);
 }
 function failWorker() {
  workerFailed = true;
  worker?.terminate();
  worker = null;
  finish(null);
 }
 function useWorker() {
  if (worker || workerFailed || closed) return;
  try {
   // An emitted asset URL survives Vinext's import.meta.url source rewriting.
   worker = new Worker(workerUrl, {type: 'module'});
   worker.onmessage = event => finish(typeof event.data?.token === 'string' ? event.data.token : '');
   worker.onerror = event => {event.preventDefault(); failWorker();};
   worker.onmessageerror = failWorker;
  } catch { failWorker(); }
 }
 if (!detector) useWorker();

 return {
  async decode(video: HTMLVideoElement): Promise<string> {
   if (closed || decoding || !video.videoWidth || !video.videoHeight) return '';
   decoding = true;
   try {
    if (detector) {
     try { const codes = await detector.detect(video); return closed ? '' : codes[0]?.rawValue || ''; }
     catch { detector = null; if (closed) return ''; useWorker(); }
    }
    const crop = frame++ % 2 === 0, side = Math.min(video.videoWidth, video.videoHeight) * .8;
    const sw = crop ? side : video.videoWidth, sh = crop ? side : video.videoHeight;
    const width = Math.round(Math.min(crop ? 640 : 800, sw)), height = Math.round(sh * width / sw);
    if (canvas.width !== width || canvas.height !== height) {canvas.width = width; canvas.height = height;}
    ctx.drawImage(video, (video.videoWidth - sw) / 2, (video.videoHeight - sh) / 2, sw, sh, 0, 0, width, height);
    const pixels = ctx.getImageData(0, 0, width, height);
    if (worker) {
     // Keep the original pixels for a retry if loading or decoding in the worker fails.
     const buffer = pixels.data.slice().buffer;
     const token = await new Promise<string | null>(resolve => {
      pending = resolve;
      timeout = setTimeout(failWorker, 1500);
      try {worker!.postMessage({buffer, width, height}, [buffer]);} catch {failWorker();}
     });
     if (closed) return '';
     if (token !== null) return token;
    }
    const {default: jsQR} = await import('jsqr');
    if (closed) return '';
    return jsQR(pixels.data, width, height, {inversionAttempts: 'attemptBoth'})?.data || '';
   } finally {decoding = false;}
  },
  close() {closed = true; worker?.terminate(); worker = null; finish('');}
 };
}
