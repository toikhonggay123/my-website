import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
gsap.ticker.lagSmoothing(0);

const journey = document.querySelector('[data-journey]');
const canvas = journey?.querySelector('[data-depth-canvas]');
const poster = journey?.querySelector('[data-journey-poster]');
const mobilePoster = journey?.querySelector('[data-journey-poster-mobile]');
const film = journey?.querySelector('[data-hero-film]');
const sections = [...(journey?.querySelectorAll('[data-scene]') ?? [])];
const nav = journey?.querySelector('[data-journey-nav]');
const links = [...(nav?.querySelectorAll('[data-chapter-link]') ?? [])];
const toggle = journey?.querySelector('[data-motion-toggle]');
const count = journey?.querySelector('[data-scene-count]');
const systemReduced = matchMedia('(prefers-reduced-motion: reduce)');
const preferenceKey = 'afyllx-reduce-motion';
const pose = { hero: 0, intro: .18, edu: .36, digital: .58, gov: .8 };
let manualReduced = false;
try { manualReduced = localStorage.getItem(preferenceKey) === '1'; } catch { /* Use session preference. */ }
let scene;
let context;
let observer;
let frame = 0;
let current = 'hero';
let stops = [];
let active = true;
let pending = false;
let failed = false;
let pointerX = 0;
let pointerY = 0;
let renderedProgress;
let lastFrameTime;

const reduced = () => systemReduced.matches || manualReduced;

function measure() {
  if (!journey) return;
  const origin = journey.getBoundingClientRect().top + scrollY;
  const extent = Math.max(1, journey.offsetHeight - innerHeight);
  stops = sections.map((section, index) => ({
    offset: index === 0 ? 0 : (section.getBoundingClientRect().top + scrollY - origin + section.offsetHeight / 2 - innerHeight / 2) / extent,
    progress: pose[section.dataset.scene],
  }));
  stops.push({ offset: 1, progress: 1 });
}

function sceneProgress(value) {
  const next = stops.findIndex((stop) => stop.offset >= value);
  if (next <= 0) return next === 0 ? 0 : 1;
  const from = stops[next - 1];
  const to = stops[next];
  const between = Math.max(0, Math.min(1, (value - from.offset) / (to.offset - from.offset)));
  return from.progress + (to.progress - from.progress) * between;
}

function setChapter() {
  const midpoint = innerHeight * .5;
  const section = sections.find((item) => {
    const rect = item.getBoundingClientRect();
    return rect.top <= midpoint && rect.bottom > midpoint;
  });
  const name = section?.dataset.scene ?? 'hero';
  if (name === current) return;
  current = name;
  journey.dataset.current = name;
  for (const link of links) {
    if (link.dataset.chapterLink === name) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  }
  if (poster) poster.src = `/afyllx-media/depth-${name === 'intro' ? 'hero' : name}.webp`;
  if (mobilePoster) mobilePoster.srcset = `/afyllx-media/depth-${name === 'intro' ? 'hero' : name}-mobile.webp`;
  if (count) count.textContent = `0${Math.max(1, sections.indexOf(section) + 1)} / 05`;
}

function tick(time) {
  frame = 0;
  if (!scene || !active || document.hidden || reduced()) return;
  const extent = Math.max(1, journey.offsetHeight - innerHeight);
  const scrollProgress = Math.max(0, Math.min(1, -journey.getBoundingClientRect().top / extent));
  const target = sceneProgress(scrollProgress);
  const elapsed = lastFrameTime === undefined ? 1 : Math.min(1, (time - lastFrameTime) / 1000);
  renderedProgress = renderedProgress === undefined ? target : renderedProgress + (target - renderedProgress) * (1 - Math.exp(-elapsed / .12));
  lastFrameTime = time;
  try {
    scene.render(renderedProgress, time / 1000, pointerX, pointerY);
  } catch {
    failed = true;
    teardown();
    return;
  }
  frame = requestAnimationFrame(tick);
}

function schedule() {
  const rect = journey?.getBoundingClientRect();
  active = !!rect && rect.bottom > 0 && rect.top < innerHeight;
  if (!frame && scene && active && !document.hidden && !reduced()) frame = requestAnimationFrame(tick);
}

function teardown() {
  cancelAnimationFrame(frame);
  frame = 0;
  context?.revert();
  context = undefined;
  scene?.dispose();
  scene = undefined;
  renderedProgress = undefined;
  lastFrameTime = undefined;
  journey?.classList.remove('is-rendered');
}

async function setup() {
  if (!journey || !canvas || pending || scene || failed || reduced()) return;
  pending = true;
  try {
    const { createDepthScene } = await import('./depth-scene.js');
    if (reduced()) return;
    scene = createDepthScene(canvas);
    measure();
    context = gsap.context(() => {
      ScrollTrigger.create({
        trigger: journey,
        start: 'top top',
        end: 'bottom bottom',
        onRefresh: () => { measure(); scene?.resize(); },
      });
      const heroCopy = journey.querySelector('[data-hero-copy]');
      if (film) gsap.to(film, {
        opacity: 0, scale: 1.07, yPercent: -3, ease: 'none',
        scrollTrigger: { trigger: sections[1], start: 'top 100%', end: 'top 8%', scrub: .65 },
      });
      if (heroCopy) gsap.to(heroCopy, {
        opacity: .05, y: -60, scale: .97, ease: 'none',
        scrollTrigger: { trigger: sections[0], start: 'top top', end: 'bottom 15%', scrub: .5 },
      });
      for (const copy of journey.querySelectorAll('[data-choreography]')) {
        gsap.from(copy.children, {
          opacity: .08, y: 50, stagger: .07, ease: 'none',
          scrollTrigger: { trigger: copy, start: 'top 91%', end: 'top 42%', scrub: .6 },
        });
      }
    }, journey);
    const extent = Math.max(1, journey.offsetHeight - innerHeight);
    renderedProgress = sceneProgress(Math.max(0, Math.min(1, -journey.getBoundingClientRect().top / extent)));
    scene.render(renderedProgress, 0);
    journey.classList.add('is-rendered');
    schedule();
    ScrollTrigger.refresh();
  } catch (error) {
    failed = true;
    teardown();
    console.info('Không gian AFYLLX đang hiển thị ảnh.', error instanceof Error ? error.message : 'WebGL không khả dụng.');
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
  else void setup();
}

if (journey) {
  if (nav) nav.hidden = false;
  if (count) count.hidden = false;
  journey.dataset.current = 'hero';
  const updateScroll = () => {
    setChapter();
    const rect = journey.getBoundingClientRect();
    nav?.classList.toggle('is-visible', rect.top < -innerHeight * .5 && rect.bottom > innerHeight * .4);
    schedule();
  };
  document.addEventListener('scroll', updateScroll, { passive: true });
  updateScroll();
  observer = new IntersectionObserver(([entry]) => {
    active = entry.isIntersecting;
    if (active) schedule();
    else { cancelAnimationFrame(frame); frame = 0; }
  });
  observer.observe(journey);
  document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('resize', () => { measure(); scene?.resize(); }, { passive: true });
  journey.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    pointerX = (event.clientX / innerWidth - .5) * .7;
    pointerY = (event.clientY / innerHeight - .5) * .5;
  });
  journey.addEventListener('pointerleave', () => { pointerX = pointerY = 0; });
  toggle?.addEventListener('click', () => {
    manualReduced = !manualReduced;
    try { localStorage.setItem(preferenceKey, manualReduced ? '1' : '0'); } catch { /* Use session preference. */ }
    syncPreference();
  });
  canvas?.addEventListener('webglcontextlost', () => { failed = true; teardown(); });
  systemReduced.addEventListener('change', syncPreference);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    else schedule();
  });
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) { observer?.disconnect(); teardown(); }
  });
  syncPreference();
}
