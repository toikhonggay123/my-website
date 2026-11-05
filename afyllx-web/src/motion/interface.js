const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let savedReduced = false;
try { savedReduced = localStorage.getItem('afyllx-reduce-motion') === '1'; } catch { /* Use device preference. */ }
document.documentElement.dataset.motion = reduced.matches || savedReduced ? 'reduced' : 'full';
const motionReduced = () => reduced.matches || document.documentElement.dataset.motion === 'reduced';
reduced.addEventListener('change', () => {
  document.documentElement.dataset.motion = reduced.matches || savedReduced ? 'reduced' : 'full';
});
const header = document.querySelector('.site-header');
function updateHeader() { header?.classList.toggle('is-scrolled', scrollY > 35); }
document.addEventListener('scroll', updateHeader, { passive: true });
updateHeader();

if (!document.body.classList.contains('is-home') && !motionReduced()) {
  document.querySelector('main')?.animate([
    { opacity: .25, transform: 'translateY(15px)' }, { opacity: 1, transform: 'translateY(0)' },
  ], { duration: 500, easing: 'cubic-bezier(.23, 1, .32, 1)' });
}

if ('IntersectionObserver' in window) {
  const reveal = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      reveal.unobserve(entry.target);
      if (!motionReduced()) entry.target.animate([
        { opacity: .1, transform: 'translateY(35px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ], { duration: 900, easing: 'cubic-bezier(.23, 1, .32, 1)' });
      const line = entry.target.querySelector('.step-light');
      if (line && !motionReduced()) line.animate([
        { transform: 'scaleX(0)', opacity: 0 }, { transform: 'scaleX(1)', opacity: 1 },
      ], { duration: 1000, delay: 100, easing: 'cubic-bezier(.23, 1, .32, 1)' });
    }
  }, { threshold: .12 });
  document.querySelectorAll('[data-reveal]').forEach((element) => reveal.observe(element));
}

if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  for (const card of document.querySelectorAll('[data-light-card]')) card.addEventListener('pointermove', (event) => {
    const bounds = card.getBoundingClientRect();
    card.style.setProperty('--light-x', `${event.clientX - bounds.left}px`);
    card.style.setProperty('--light-y', `${event.clientY - bounds.top}px`);
  });
}

const poses = { hero: 0, edu: .36, digital: .58, gov: .8 };
for (const visual of document.querySelectorAll('[data-depth-visual]')) {
  let scene;
  let frame = 0;
  let resize;
  let pending = false;
  let visible = false;
  const canvas = visual.querySelector('canvas');
  const progress = poses[visual.dataset.depthVisual] ?? 0;
  function tick(time) {
    frame = 0;
    if (!scene || !visible || document.hidden || motionReduced()) return;
    scene.render(progress, time / 1000);
    frame = requestAnimationFrame(tick);
  }
  function schedule() {
    if (!frame && scene && visible && !document.hidden && !motionReduced()) frame = requestAnimationFrame(tick);
  }
  function dispose() {
    cancelAnimationFrame(frame);
    frame = 0;
    resize?.disconnect();
    scene?.dispose();
    scene = undefined;
    visual.classList.remove('is-rendered');
  }
  async function setup() {
    if (pending || scene || motionReduced()) return;
    pending = true;
    try {
      const { createDepthScene } = await import('./depth-scene.js');
      if (motionReduced()) return;
      scene = createDepthScene(canvas, { mode: 'detail' });
      scene.render(progress, 0);
      visual.classList.add('is-rendered');
      resize = new ResizeObserver(() => scene?.resize());
      resize.observe(canvas);
      schedule();
    } catch { dispose(); }
    finally { pending = false; }
  }
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) { void setup(); schedule(); }
    else { cancelAnimationFrame(frame); frame = 0; }
  });
  observer.observe(visual);
  reduced.addEventListener('change', () => { if (reduced.matches) dispose(); else void setup(); });
  canvas?.addEventListener('webglcontextlost', dispose);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    else schedule();
  });
  window.addEventListener('pagehide', (event) => { if (!event.persisted) { observer.disconnect(); dispose(); } });
}
