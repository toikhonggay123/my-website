/**
 * Cảnh sân khấu 3D vẽ trên canvas 2D: sàn đèn LED chạy về phía người xem, các luồng đèn quét, khói sáng và bóng khán giả.
 * Tự chiếu phối cảnh (không dùng WebGL) để nhẹ và chạy được trên mọi máy.
 * Trả về hàm dừng. Chỉ vẽ khi canvas nằm trong màn hình và thẻ đang mở.
 */

const BPM = 124;
const HOT = [255, 61, 46]; // đỏ cam
const COLD = [74, 108, 255]; // xanh điện
const mix = (t: number) => HOT.map((h, i) => Math.round(h + (COLD[i] - h) * t)).join(',');

interface Beam {
  x: number; // vị trí nguồn trên giàn đèn
  speed: number;
  phase: number;
  tone: number; // 0 = nóng, 1 = lạnh
}

const BEAMS: Beam[] = Array.from({ length: 9 }, (_, i) => ({
  x: (i - 4) * 3.2,
  speed: 0.35 + (i % 3) * 0.14,
  phase: i * 1.7,
  tone: i % 2,
}));

export function startScene(canvas: HTMLCanvasElement, still: boolean): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  let width = 0;
  let height = 0;
  let frame = 0;
  let visible = true;
  let pointerX = 0; // -1..1, đã làm mượt
  let pointerTarget = 0;
  const started = performance.now();

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (still) draw(0.6);
  };

  /** Chiếu điểm (x, y, z) trong không gian sân khấu lên màn hình. Máy quay cao 2.2, nhìn về +z. */
  const project = (x: number, y: number, z: number) => {
    const focal = Math.max(width, height * 1.25) * 0.72;
    const depth = z + 7;
    const scale = focal / depth;
    return { x: width / 2 + (x - pointerX * 1.6) * scale, y: height * 0.56 - (y - 2.2) * scale, scale };
  };

  function draw(seconds: number) {
    const beat = (seconds * BPM) / 60;
    const kick = Math.exp(-(beat % 1) * 3.4); // nảy mạnh đầu mỗi phách rồi tắt dần

    ctx!.globalCompositeOperation = 'source-over';
    const sky = ctx!.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#05030d');
    sky.addColorStop(0.56, '#150a2e');
    sky.addColorStop(1, '#070411');
    ctx!.fillStyle = sky;
    ctx!.fillRect(0, 0, width, height);

    ctx!.globalCompositeOperation = 'lighter';

    // khói sáng ở chân trời, phồng theo phách
    const horizon = project(0, 2.2, 60);
    const haze = ctx!.createRadialGradient(horizon.x, horizon.y, 0, horizon.x, horizon.y, width * (0.42 + kick * 0.06));
    haze.addColorStop(0, `rgba(${mix(0.35)},${0.5 + kick * 0.25})`);
    haze.addColorStop(0.45, `rgba(${mix(0.8)},0.16)`);
    haze.addColorStop(1, 'rgba(0,0,0,0)');
    ctx!.fillStyle = haze;
    ctx!.fillRect(0, 0, width, height);

    // sàn LED: lưới điểm trôi về phía máy quay, sáng theo sóng lan từ sân khấu
    const drift = (seconds * 2.4) % 1;
    for (let row = 0; row < 46; row++) {
      const z = row - drift;
      if (z < -5.5) continue;
      for (let col = -16; col <= 16; col++) {
        const p = project(col * 1.15, 0, z);
        if (p.x < -20 || p.x > width + 20 || p.y > height + 20) continue;
        const wave = Math.sin(Math.hypot(col * 1.15, z - 30) * 0.55 - beat * Math.PI) * 0.5 + 0.5;
        const size = Math.max(0.6, p.scale * 0.055 * (0.5 + wave));
        const alpha = Math.min(1, (0.1 + wave * 0.75) * Math.min(1, (46 - row) / 14));
        ctx!.fillStyle = `rgba(${mix(Math.abs(col) / 16)},${alpha})`;
        ctx!.fillRect(p.x - size / 2, p.y - size / 2, size, size);
      }
    }

    // luồng đèn quét từ giàn treo phía xa
    for (const beam of BEAMS) {
      const source = project(beam.x, 11, 34);
      const sweep = Math.sin(seconds * beam.speed + beam.phase);
      const reach = 6 + Math.cos(seconds * beam.speed * 0.7 + beam.phase) * 10;
      const left = project(beam.x + sweep * 13 - 1.5, 0, reach);
      const right = project(beam.x + sweep * 13 + 1.5, 0, reach);
      const glow = ctx!.createLinearGradient(source.x, source.y, (left.x + right.x) / 2, left.y);
      const strength = 0.3 + kick * 0.3;
      glow.addColorStop(0, `rgba(${mix(beam.tone)},${strength})`);
      glow.addColorStop(1, `rgba(${mix(beam.tone)},0)`);
      ctx!.fillStyle = glow;
      ctx!.beginPath();
      ctx!.moveTo(source.x, source.y);
      ctx!.lineTo(left.x, left.y);
      ctx!.lineTo(right.x, right.y);
      ctx!.closePath();
      ctx!.fill();
      ctx!.fillStyle = `rgba(255,255,255,${0.7 + kick * 0.3})`;
      ctx!.beginPath();
      ctx!.arc(source.x, source.y, Math.max(1.2, source.scale * 0.09), 0, Math.PI * 2);
      ctx!.fill();
    }

    // bóng khán giả ở mép dưới, nhún theo phách
    ctx!.globalCompositeOperation = 'source-over';
    ctx!.fillStyle = '#04020a';
    ctx!.beginPath();
    ctx!.moveTo(0, height);
    const heads = Math.ceil(width / 26);
    for (let i = 0; i <= heads; i++) {
      const x = (i / heads) * width;
      const seed = Math.sin(i * 12.9898) * 43758.5453;
      const jitter = seed - Math.floor(seed);
      const bounce = kick * 7 * (0.4 + jitter);
      const top = height - 34 - jitter * 30 - bounce;
      ctx!.lineTo(x - 11, height - 16);
      if (jitter > 0.72) {
        // một cánh tay giơ lên
        ctx!.lineTo(x - 7, top - 30 - bounce);
        ctx!.lineTo(x - 2, top - 30 - bounce);
        ctx!.lineTo(x - 3, top + 4);
      }
      ctx!.quadraticCurveTo(x - 10, top, x, top);
      ctx!.quadraticCurveTo(x + 10, top, x + 11, height - 16);
    }
    ctx!.lineTo(width, height);
    ctx!.closePath();
    ctx!.fill();
  }

  const tick = (now: number) => {
    frame = 0;
    if (!visible || document.hidden) return;
    pointerX += (pointerTarget - pointerX) * 0.05;
    draw((now - started) / 1000);
    frame = requestAnimationFrame(tick);
  };
  const wake = () => {
    if (!still && !frame && visible && !document.hidden) frame = requestAnimationFrame(tick);
  };
  const onPointer = (event: PointerEvent) => {
    pointerTarget = (event.clientX / window.innerWidth) * 2 - 1;
  };

  const observer = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
    wake();
  });
  observer.observe(canvas);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', wake);
  if (!still) window.addEventListener('pointermove', onPointer, { passive: true });
  resize();
  wake();

  return () => {
    observer.disconnect();
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', wake);
    window.removeEventListener('pointermove', onPointer);
    if (frame) cancelAnimationFrame(frame);
  };
}
