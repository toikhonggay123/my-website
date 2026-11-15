// Aurora Flow kit: one shared WebGL stage, the 3D curtain material and kinetic type helpers.
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
export { THREE, gsap, ScrollTrigger };
let savedReduce = false;
try { savedReduce = localStorage.getItem('afyllx-reduce-motion') === '1'; } catch { /* Use the device preference. */ }
export const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || savedReduce;
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const mix = (a, b, t) => a + (b - a) * t;

// Brand light, as display values: cobalt #376bff, electric #4583ff, ice #8dc8ff.
export const GLSL = /* glsl */ `
const vec3 COBALT = vec3(.216,.42,1.), ELECTRIC = vec3(.27,.514,1.), ICE = vec3(.553,.784,1.), DEEP = vec3(.07,.16,.62);
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x), f.y); }
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<4;i++){ v+=a*noise(p); p=p*2.03+vec2(17.,9.); a*=.5; } return v; }
`;

export function createStage(canvas, { fov = 45, near = .1, far = 500 } = {}) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); }
  catch { document.body.classList.add('no-webgl'); return null; }
  renderer.setClearColor(0x01030a, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, near, far);
  const mobile = matchMedia('(max-width: 820px)').matches;
  let ratio = Math.min(devicePixelRatio, mobile ? 1.25 : 1.5);
  const s = { idle: false, t: reduce ? 31 : 0, dt: 0, p: 0, target: 0, vel: 0, px: 0, py: 0, w: 1, h: 1, mobile, ratio, render: null };
  const frames = [], resizes = [];
  let tx = 0, ty = 0, dirty = true, raf = 0, last = performance.now(), slow = 0, count = 0;

  const resize = () => {
    s.w = innerWidth; s.h = innerHeight; s.ratio = ratio;
    renderer.setPixelRatio(ratio); renderer.setSize(s.w, s.h, false);
    camera.aspect = s.w / s.h; camera.updateProjectionMatrix();
    resizes.forEach((f) => f()); dirty = true;
  };
  const readScroll = () => { s.target = scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight); dirty = true; };
  const onMove = (e) => { tx = e.clientX / innerWidth * 2 - 1; ty = e.clientY / innerHeight * 2 - 1; };
  addEventListener('resize', resize); addEventListener('scroll', readScroll, { passive: true });
  if (!reduce) addEventListener('pointermove', onMove, { passive: true });

  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, .05); last = now;
    if (document.hidden || s.idle) return;
    if (reduce) { if (!dirty) return; s.p = s.target; }
    else {
      s.t += dt; s.dt = dt;
      const k = 1 - Math.exp(-dt * 4.5), prev = s.p;
      s.p += (s.target - s.p) * k; s.vel = (s.p - prev) / Math.max(dt, .001);
      s.px += (tx - s.px) * (1 - Math.exp(-dt * 2.5)); s.py += (ty - s.py) * (1 - Math.exp(-dt * 2.5));
      // Drop resolution when the device cannot hold the frame rate.
      slow += (dt - slow) * .05;
      if (++count > 120 && slow > 1 / 34 && ratio > .75) { ratio -= .25; count = 0; resize(); }
    }
    dirty = false;
    frames.forEach((f) => f(s));
    if (s.render) s.render(); else renderer.render(scene, camera);
    if (!canvas.dataset.ready) canvas.dataset.ready = '1';
  };
  resize(); readScroll(); raf = requestAnimationFrame(loop);
  return {
    renderer, scene, camera, state: s,
    onFrame: (f) => frames.push(f), onResize: (f) => { resizes.push(f); f(); },
  };
}

// A sheet of aurora: geometry needs uv.x along the curtain and uv.y from hem (0) to top (1).
// It folds along its normal, so the same material drives flat curtains and polar rings.
export function curtainMaterial({ seed = 0, len = 60, amp = 4, gain = 1, ring = 0, near = 1, far = 120 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uSeed: { value: seed }, uLen: { value: len }, uAmp: { value: amp },
      uGain: { value: gain }, uRing: { value: ring }, uNear: { value: near }, uFar: { value: far },
    },
    vertexShader: GLSL + /* glsl */ `
      uniform float uTime, uSeed, uLen, uAmp, uRing;
      varying vec2 vUv; varying vec2 vC; varying float vDist;
      void main(){
        vUv = uv; float a = uv.x * 6.2831853;
        vC = mix(vec2(uv.x * uLen, 0.), vec2(cos(a), sin(a)) * uLen, uRing) + uSeed;
        float fold = (fbm(vC * .16 + vec2(uTime * .022, uSeed)) - .5) * 2. + .3 * sin(vC.x * .9 + uTime * .11 + uSeed);
        vec3 p = position + normal * fold * uAmp * (.45 + .55 * uv.y);
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        vDist = -mv.z; gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: GLSL + /* glsl */ `
      uniform float uTime, uSeed, uGain, uRing, uNear, uFar;
      varying vec2 vUv; varying vec2 vC; varying float vDist;
      void main(){
        float y = vUv.y;
        float rays = .3 + .7 * noise(vec2(vC.x * 5.5 + vC.y * 5.5, uTime * .07 + uSeed));
        rays *= .55 + .45 * noise(vec2(vC.x * 1.3 - uTime * .05, y * 2. + uTime * .09));
        float body = smoothstep(0., .05, y) * exp(-y * 3.4);
        float hem = exp(-pow((y - .045) * 20., 2.));
        float patches = smoothstep(.22, .68, noise(vC * .11 + vec2(uTime * .014, uSeed * 3.)));
        float ends = mix(smoothstep(0., .1, vUv.x) * smoothstep(1., .9, vUv.x), 1., uRing);
        vec3 col = mix(ICE, ELECTRIC, smoothstep(0., .16, y));
        col = mix(col, COBALT, smoothstep(.12, .5, y)); col = mix(col, DEEP, smoothstep(.45, 1., y));
        float a = (body * rays + hem * .55 * (.5 + .5 * rays)) * patches * ends * uGain;
        a *= smoothstep(uNear * .3, uNear * 3., vDist) * smoothstep(uFar, uFar * .35, vDist);
        gl_FragColor = vec4(col * a, 1.);
      }`,
  });
}

export function stars(count = 1400, radius = 220) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * 6.2832, r = Math.sqrt(1 - u * u);
    pos.set([r * Math.cos(a) * radius, u * radius, r * Math.sin(a) * radius], i * 3);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xbfd9ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: .6, depthWrite: false }));
  points.frustumCulled = false; return points;
}

// Split text into word > character spans. Combined Vietnamese glyphs stay whole (NFC).
export function splitChars(el) {
  const chars = [];
  el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  const walk = (node) => [...node.childNodes].forEach((n) => {
    if (n.nodeType === 3) {
      const frag = document.createDocumentFragment();
      n.textContent.normalize('NFC').split(/(\s+)/).forEach((word) => {
        if (!word) return;
        if (/^\s+$/.test(word)) { frag.append(' '); return; }
        const w = document.createElement('span'); w.className = 'kw'; w.setAttribute('aria-hidden', 'true');
        Array.from(word).forEach((c) => { const k = document.createElement('span'); k.className = 'kc'; k.textContent = c; w.append(k); chars.push(k); });
        frag.append(w);
      });
      n.replaceWith(frag);
    } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
  });
  walk(el); return chars;
}

// Everything the three concepts share below the hero.
export function sharedMotion() {
  const scrub = document.querySelector('[data-scrub]');
  if (scrub) {
    splitChars(scrub);
    if (!reduce) gsap.fromTo(scrub.querySelectorAll('.kw'), { opacity: .13 }, { opacity: 1, stagger: .1, ease: 'none', scrollTrigger: { trigger: scrub, start: 'top 78%', end: 'bottom 45%', scrub: .6 } });
  }
  if (reduce) return;
  document.querySelectorAll('[data-field]').forEach((field, i) => {
    gsap.from(field.querySelectorAll('.ln > span'), { yPercent: 115, duration: 1.3, ease: 'expo.out', stagger: .09, scrollTrigger: { trigger: field.querySelector('h2'), start: 'top 82%' } });
    gsap.from(field.querySelectorAll('[data-soft]'), { opacity: 0, y: 18, duration: 1.2, ease: 'expo.out', stagger: .08, delay: .25, scrollTrigger: { trigger: field.querySelector('h2'), start: 'top 82%' } });
    const ghost = field.querySelector('[data-ghost]');
    if (ghost) gsap.fromTo(ghost, { xPercent: i % 2 ? -28 : 22 }, { xPercent: i % 2 ? 22 : -28, ease: 'none', scrollTrigger: { trigger: field, start: 'top bottom', end: 'bottom top', scrub: .8 } });
  });
  const steps = document.querySelectorAll('.au-steps li');
  if (steps.length) gsap.from(steps, { opacity: 0, y: 30, duration: 1.2, ease: 'expo.out', stagger: .1, scrollTrigger: { trigger: '.au-steps', start: 'top 85%' } });
}

export function riseIn(el, delay = 0) {
  const chars = splitChars(el);
  if (!reduce) gsap.from(chars, { yPercent: 120, rotateX: -75, opacity: 0, filter: 'blur(10px)', duration: 1.5, ease: 'expo.out', stagger: .022, delay, clearProps: 'filter' });
  return chars;
}
