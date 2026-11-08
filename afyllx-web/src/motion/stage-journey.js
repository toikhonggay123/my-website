/*
 * Scroll controller for the pinned 3D stage on the home page.
 * The stage section is N chapters tall; scroll position maps to a chapter
 * index and a local time 0–1 that drives both the copy and the 3D object
 * on the same timeline (see TIMELINE in stage-scene.js).
 */
const stage = document.querySelector('[data-stage]');
const N = 3;
const IDS = ['edu', 'digital', 'gov'];
const clamp = value => Math.min(1, Math.max(0, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const step = (value, from, to) => smooth((value - from) / (to - from));
const STEP_AT = [.34, .64, .92];
/** Spring time constant (s) and top playback speed (chapters per second). */
const SPRING = .45;
const MAX_SPEED = .38;

if (stage) {
  const canvas = stage.querySelector('[data-stage-canvas]');
  const copies = [...stage.querySelectorAll('[data-stage-copy]')];
  const links = [...stage.querySelectorAll('[data-stage-link]')];
  const posters = [...stage.querySelectorAll('[data-stage-poster]')];
  const toggle = stage.querySelector('[data-motion-toggle]');
  const systemReduced = matchMedia('(prefers-reduced-motion: reduce)');
  const preferenceKey = 'afyllx-reduce-motion';
  let manualReduced = false;
  try { manualReduced = localStorage.getItem(preferenceKey) === '1'; } catch { /* Session preference only. */ }
  const reduced = () => systemReduced.matches || manualReduced;

  let scene;
  let pending = false;
  let failed = false;
  let frame = 0;
  let visible = false;
  let shown;
  let lastTime;
  let pointerX = 0, pointerY = 0, smoothX = 0, smoothY = 0;
  let current = -1;
  // Frame-time governor: average frame length (s) and when the render scale last changed.
  let frameAvg;
  let lastAdjust = 0;
  const SLOW_FRAME = 1 / 40;

  stage.classList.add('is-ready');

  /** Scroll position as chapters: 0 when the stage starts to pin, N at its end. */
  function target() {
    const rect = stage.getBoundingClientRect();
    const lead = innerHeight * .35;
    const extent = Math.max(1, stage.offsetHeight - innerHeight + lead);
    return Math.min(N - 1e-4, clamp((lead - rect.top) / extent) * N);
  }

  function paint(position) {
    const index = Math.min(N - 1, Math.floor(position));
    const local = position - index;
    const enter = step(local, 0, .12);
    // Same timeline as stage-scene.js: enter, expand, hold, collapse, exit.
    const exit = step(local, .9, 1);
    const build = step(local, .12, .66) * (1 - step(local, .78, .94));
    copies.forEach((copy, i) => {
      const active = i === index;
      copy.classList.toggle('is-active', active);
      copy.setAttribute('aria-hidden', String(!active));
      if (!active) { copy.style.opacity = '0'; return; }
      copy.style.opacity = String(enter * (1 - exit));
      copy.style.transform = `translateY(${((1 - enter) * 36 - exit * 36).toFixed(1)}px)`;
      [...copy.querySelectorAll('[data-stage-reveal]')].forEach((item, j) => {
        const t = step(local, .02 + j * .025, .12 + j * .025);
        item.style.opacity = String(t);
        item.style.transform = `translateY(${((1 - t) * 18).toFixed(1)}px)`;
      });
      copy.querySelectorAll('[data-stage-step]').forEach((item, k) => item.classList.toggle('is-on', build >= STEP_AT[k]));
    });
    links.forEach((link, i) => {
      const fill = i < index ? 1 : i === index ? local : 0;
      link.style.setProperty('--fill', fill.toFixed(3));
      if (i === index) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
    posters.forEach((poster, i) => poster.classList.toggle('is-active', i === index));
    if (index !== current) {
      current = index;
      stage.dataset.current = IDS[index];
    }
    return { index, local };
  }

  function tick(time) {
    frame = 0;
    visible = inView();
    if (!visible || document.hidden) return;
    const goal = target();
    if (reduced() || !scene) {
      // Without motion the chapter switches at its hold point.
      const index = Math.min(N - 1, Math.floor(goal));
      paint(index + .72);
      return;
    }
    const elapsed = lastTime === undefined ? 0 : Math.min(.1, (time - lastTime) / 1000);
    lastTime = time;
    // Playback is decoupled from the wheel: the stage follows the scroll
    // position with a soft spring and a speed limit, so a hard wheel flick
    // still plays every step at a readable pace. Crossing a chapter boundary
    // is continuous, so the old object finishes collapsing and leaving before
    // the next one enters. Only far jumps (anchor links) snap.
    if (shown === undefined || Math.abs(goal - shown) > 1) shown = goal;
    else {
      const eased = (goal - shown) * (1 - Math.exp(-elapsed / SPRING));
      const limit = MAX_SPEED * elapsed;
      shown += Math.max(-limit, Math.min(limit, eased));
    }
    const follow = 1 - Math.exp(-elapsed / .2);
    smoothX += (pointerX - smoothX) * follow;
    smoothY += (pointerY - smoothY) * follow;
    const { index, local } = paint(shown);
    frameObject(index);
    // A GPU that cannot keep up (integrated graphics, battery saver) gets fewer pixels
    // instead of a stuttering stage: step the render scale down while frames stay slow.
    if (elapsed > 0) {
      frameAvg = frameAvg === undefined ? elapsed : frameAvg * .9 + elapsed * .1;
      if (frameAvg > SLOW_FRAME && time - lastAdjust > 1500 && scene.quality > .6) {
        scene.setQuality(scene.quality * .8);
        lastAdjust = time;
        frameAvg = undefined;
      }
    }
    try {
      scene.render(index, local, time / 1000, smoothX, smoothY);
    } catch {
      failed = true;
      teardown();
      return;
    }
    frame = requestAnimationFrame(tick);
  }

  /*
   * The object never sits under the copy panel: measure the free area around
   * the active chapter's panel (layout boxes, so transforms don't jitter it).
   * Side by side when the panel leaves room on the right, otherwise above it.
   */
  const sticky = stage.querySelector('.stage-sticky');
  const bottom = stage.querySelector('.stage-bottom');
  let framedIndex = -1;
  let framedSize = '';
  function frameObject(index) {
    const size = `${sticky.clientWidth}x${sticky.clientHeight}`;
    if (!scene || (index === framedIndex && size === framedSize)) return;
    framedIndex = index;
    framedSize = size;
    const copy = copies[index];
    const width = sticky.clientWidth, height = sticky.clientHeight;
    const header = (document.querySelector('.header-inner')?.getBoundingClientRect().bottom ?? 80) + 12;
    const railTop = bottom ? bottom.offsetTop - 12 : height - 24;
    const gutter = Math.max(16, width * .03);
    const layout = copy.offsetParent;
    const left = (layout?.offsetLeft ?? 0) + copy.offsetLeft, right = left + copy.offsetWidth;
    const top = (layout?.offsetTop ?? 0) + copy.offsetTop;
    if (right + 160 < width * .8) {
      scene.setFreeArea({ left: right + gutter, top: header, right: width - gutter, bottom: railTop });
    } else {
      scene.setFreeArea({ left: gutter, top: header, right: width - gutter, bottom: top - 12 });
    }
  }

  // Measured directly as well as observed: a layout change (resize, rotation)
  // can leave the observer's last report stale.
  function inView() {
    const rect = stage.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < innerHeight;
  }

  function schedule() {
    visible = inView();
    if (!frame && visible && !document.hidden) frame = requestAnimationFrame(tick);
  }

  function teardown() {
    cancelAnimationFrame(frame);
    frame = 0;
    scene?.dispose();
    scene = undefined;
    framedIndex = -1;
    shown = undefined;
    lastTime = undefined;
    stage.classList.remove('is-rendered');
  }

  async function setup() {
    if (!canvas || pending || scene || failed || reduced()) return;
    pending = true;
    try {
      const { createStageScene } = await import('./stage-scene.js');
      if (reduced()) return;
      scene = createStageScene(canvas, { mode: 'journey' });
      stage.classList.add('is-rendered');
      schedule();
    } catch (error) {
      failed = true;
      teardown();
      console.info('Sân khấu AFYLLX đang hiển thị ảnh.', error instanceof Error ? error.message : 'WebGL không khả dụng.');
    } finally {
      pending = false;
    }
  }

  function syncPreference() {
    document.documentElement.dataset.motion = reduced() ? 'reduced' : 'full';
    if (toggle) {
      toggle.hidden = false;
      toggle.disabled = systemReduced.matches;
      toggle.setAttribute('aria-pressed', String(reduced()));
      toggle.textContent = systemReduced.matches ? 'Đang giảm chuyển động theo thiết bị' : reduced() ? 'Bật chuyển động' : 'Giảm chuyển động';
    }
    if (reduced()) teardown();
    else if (visible) void setup();
    schedule();
  }

  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) { if (!reduced()) void setup(); schedule(); }
  }, { rootMargin: '25% 0px' }).observe(stage);

  document.addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', () => { scene?.resize(); schedule(); }, { passive: true });
  addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') return;
    pointerX = (event.clientX / innerWidth - .5) * .8;
    pointerY = (event.clientY / innerHeight - .5) * .6;
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { pointerX = pointerY = 0; });
  toggle?.addEventListener('click', () => {
    manualReduced = !manualReduced;
    try { localStorage.setItem(preferenceKey, manualReduced ? '1' : '0'); } catch { /* Session preference only. */ }
    syncPreference();
  });
  canvas?.addEventListener('webglcontextlost', () => { failed = true; teardown(); schedule(); });
  systemReduced.addEventListener('change', syncPreference);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    else { lastTime = undefined; frameAvg = undefined; schedule(); }
  });
  addEventListener('pagehide', event => { if (!event.persisted) teardown(); });
  paint(target());
  syncPreference();
}
