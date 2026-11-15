// Lăng kính: aurora and a band of words refracted through three glass prisms.
import { THREE, gsap, reduce, smooth, GLSL, createStage, sharedMotion } from './kit.js';

const canvas = document.querySelector('[data-stage]');
const stage = createStage(canvas, { fov: 35, far: 60 });
if (stage) {
  const { renderer, scene, camera, state } = stage;
  camera.position.set(0, 0, 10);

  // Kinetic type lives inside the scene: a slow band of words the glass can bend.
  const cv = document.createElement('canvas'); cv.width = 4096; cv.height = 320;
  const words = new THREE.CanvasTexture(cv); words.wrapS = THREE.RepeatWrapping;
  const draw = () => {
    const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
    c.fillStyle = '#fff'; c.textBaseline = 'middle'; c.font = '600 250px Lexend, "Be Vietnam Pro", Arial, sans-serif';
    let x = 40; ['AFYLLX', 'Edu', 'Digital', 'Gov'].forEach((w) => { c.fillText(w, x, 170); x += c.measureText(w).width + 190; });
    words.needsUpdate = true;
  };
  draw(); document.fonts.load('600 250px Lexend').then(draw).catch(() => {});

  // Pass 1: the aurora itself, rendered small into a texture.
  const rt = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const bgU = { uTime: { value: 0 }, uP: { value: 0 }, uAsp: { value: 1 }, tText: { value: words } };
  const quad = new THREE.PlaneGeometry(2, 2);
  const bgScene = new THREE.Scene(), flat = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  bgScene.add(new THREE.Mesh(quad, new THREE.ShaderMaterial({
    uniforms: bgU, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: GLSL + /* glsl */ `
      uniform float uTime, uP, uAsp; uniform sampler2D tText; varying vec2 vUv;
      void main(){
        vec2 p = vec2((vUv.x - .5) * uAsp, vUv.y - .5);
        float a = -.5; p = mat2(cos(a), -sin(a), sin(a), cos(a)) * p;
        vec2 w = p + .4 * (vec2(fbm(p * 1.1 + vec2(0., uTime * .03)), fbm(p * 1.1 + vec2(5.2, -uTime * .024))) - .5);
        w.y += uP * .5;
        vec3 col = vec3(0.);
        for (int i = 0; i < 4; i++) {
          float f = float(i);
          float d = w.y - (f - 1.5) * .34 - .16 * sin(w.x * 1.5 + uTime * .05 + f * 2.1) - .1 * (fbm(vec2(w.x * .8 + f * 9., uTime * .03)) - .5);
          float rays = .5 + .5 * noise(vec2(w.x * 16. + f * 7., uTime * .06 + d * 2.));
          float glow = exp(-d * d * 55.) * .85 + exp(-abs(d) * 6.) * .22 * step(0., d) + exp(-abs(d) * 14.) * .1;
          col += (i == 1 ? ICE : (i == 2 ? COBALT : ELECTRIC)) * glow * rays * (.55 + .2 * f);
        }
        vec2 t = vec2(vUv.x * uAsp * .23 + uTime * .008 + uP * .9, (vUv.y - .5) * 1.75 + .5);
        float ink = texture2D(tText, t).a * step(0., t.y) * step(t.y, 1.);
        col += ICE * ink * .11;
        vec2 q = vUv - .5; col *= 1. - dot(q, q) * 1.1;
        col = 1. - exp(-col * 1.35);
        gl_FragColor = vec4(col + vec3(.004, .012, .04), 1.);
      }`,
  })));

  // Pass 2: that texture as the backdrop, then glass that bends it.
  const back = new THREE.Mesh(quad, new THREE.ShaderMaterial({
    uniforms: { tBg: { value: rt.texture } }, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1., 1.); }',
    fragmentShader: 'uniform sampler2D tBg; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tBg, vUv); }',
  }));
  back.frustumCulled = false; back.renderOrder = -1; scene.add(back);

  const res = new THREE.Vector2(1, 1);
  const glass = () => new THREE.ShaderMaterial({
    uniforms: { tBg: { value: rt.texture }, uRes: { value: res }, uGlow: { value: 0 } },
    vertexShader: 'varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.); vP = mv.xyz; gl_Position = projectionMatrix * mv; }',
    fragmentShader: GLSL + /* glsl */ `
      uniform sampler2D tBg; uniform vec2 uRes; uniform float uGlow; varying vec3 vN; varying vec3 vP;
      void main(){
        vec3 n = normalize(vN), v = normalize(-vP);
        vec2 uv = gl_FragCoord.xy / uRes, off = n.xy * .17;
        vec3 col = vec3(texture2D(tBg, uv - off).r, texture2D(tBg, uv - off * 1.09).g, texture2D(tBg, uv - off * 1.2).b);
        float fres = pow(1. - max(dot(n, v), 0.), 2.6);
        col = col * (1.05 + .5 * uGlow) + mix(COBALT, ICE, fres) * fres * (.75 + uGlow * .5);
        col += ICE * pow(max(dot(reflect(-normalize(vec3(.35, .8, .5)), n), v), 0.), 70.) * 1.1;
        col += ELECTRIC * pow(max(dot(reflect(-normalize(vec3(-.7, .3, .6)), n), v), 0.), 18.) * .22;
        col += COBALT * (.035 + .1 * uGlow);
        gl_FragColor = vec4(col, 1.);
      }`,
  });

  // One hexagonal column cut into three rhombic prisms: one company, three fields.
  const R = 1.45, H = 1.55, hex = (i) => new THREE.Vector2(Math.cos((i * 60 + 30) * Math.PI / 180) * R, Math.sin((i * 60 + 30) * Math.PI / 180) * R);
  const tilt = new THREE.Group(), spin = new THREE.Group(); tilt.add(spin); scene.add(tilt);
  const prisms = [0, 1, 2].map((k) => {
    const pts = [new THREE.Vector2(0, 0), hex(2 * k), hex(2 * k + 1), hex(2 * k + 2)];
    const c = pts.reduce((a, p) => a.add(p), new THREE.Vector2()).multiplyScalar(.25);
    const shape = new THREE.Shape(pts.map((p) => p.clone().sub(c).multiplyScalar(.9).add(c)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: H, bevelEnabled: true, bevelThickness: .06, bevelSize: .06, bevelSegments: 3 });
    g.translate(0, 0, -H / 2);
    const mesh = new THREE.Mesh(g, glass()); spin.add(mesh);
    return { mesh, dir: hex(2 * k + 1).normalize() };
  });

  stage.onResize(() => {
    renderer.getDrawingBufferSize(res);
    rt.setSize(Math.max(2, Math.round(res.x * .55)), Math.max(2, Math.round(res.y * .55)));
    bgU.uAsp.value = state.w / state.h;
  });

  // Scroll windows for Edu, Digital, Gov read from the page so text and glass stay in step.
  const fields = [...document.querySelectorAll('[data-field]')];
  let wins = [];
  const measure = () => { const max = Math.max(1, document.documentElement.scrollHeight - innerHeight); wins = fields.map((f) => { const top = f.getBoundingClientRect().top + scrollY; return [(top - innerHeight * .5) / max, (top + f.offsetHeight - innerHeight * .5) / max]; }); };
  measure(); addEventListener('resize', measure); addEventListener('load', measure);

  stage.onFrame((s) => {
    bgU.uTime.value = s.t; bgU.uP.value = s.p;
    const first = wins[0]?.[0] ?? .3, lastEnd = wins[2]?.[1] ?? .8;
    const apart = smooth(first - .14, first, s.p) - smooth(lastEnd - .02, lastEnd + .1, s.p);
    prisms.forEach(({ mesh, dir }, k) => {
      const [a, b] = wins[k] ?? [0, 0], e = (b - a) * .22;
      const on = smooth(a, a + e, s.p) - smooth(b - e, b, s.p);
      mesh.position.set(dir.x * (apart * .55 + on * .25), dir.y * (apart * .55 + on * .25), on * .95);
      mesh.material.uniforms.uGlow.value = on;
    });
    const m = s.mobile, size = (m ? .78 : 1.2) * (1 + .06 * Math.sin(s.t * .5));
    tilt.position.set(m ? 0 : Math.min(3.1, s.w / s.h * 1.55), m ? 1.35 : -.1 + Math.sin(s.t * .6) * .08, 0);
    tilt.scale.setScalar(size);
    tilt.rotation.set(-1.02 + s.py * .14 + Math.sin(s.t * .31) * .05, s.px * .28, Math.sin(s.t * .23) * .05);
    spin.rotation.z = s.t * .07 + s.p * Math.PI * 2.67 + .35;
  });
  // On the home page the scene only covers the opening chapters: stop drawing once they scroll away.
  const zone = document.querySelector('[data-aurora-zone]');
  if (zone) new IntersectionObserver(([entry]) => { state.idle = !entry.isIntersecting; canvas.style.visibility = entry.isIntersecting ? '' : 'hidden'; }).observe(zone);
  state.render = () => { renderer.setRenderTarget(rt); renderer.render(bgScene, flat); renderer.setRenderTarget(null); renderer.render(scene, camera); };
}

if (!reduce) {
  gsap.from('.c2-copy .ln > span', { yPercent: 115, duration: 1.5, ease: 'expo.out', stagger: .11, delay: .3 });
  gsap.from('[data-in]', { opacity: 0, y: 22, duration: 1.4, ease: 'expo.out', stagger: .12, delay: 1 });
}
sharedMotion();

// Chapter rail: which field is on screen and how far through it the reader is.
const rail = document.querySelector('[data-rail]');
if (rail) {
  const links = [...rail.querySelectorAll('[data-rail-link]')], fields = [...document.querySelectorAll('[data-field]')];
  const update = () => {
    const mid = innerHeight * .5; let any = false;
    fields.forEach((field, i) => {
      const r = field.getBoundingClientRect(), on = r.top <= mid && r.bottom > mid;
      any ||= on;
      links[i].setAttribute('aria-current', String(on));
      links[i].style.setProperty('--fill', String(Math.min(1, Math.max(0, (mid - r.top) / r.height))));
    });
    rail.classList.toggle('is-on', any);
  };
  addEventListener('scroll', update, { passive: true }); addEventListener('resize', update); update();
}

// The motion switch keeps the site-wide preference and restarts the page in the chosen mode.
const toggle = document.querySelector('[data-motion-toggle]');
if (toggle) {
  const system = matchMedia('(prefers-reduced-motion: reduce)').matches;
  toggle.hidden = false; toggle.disabled = system;
  toggle.setAttribute('aria-pressed', String(reduce));
  toggle.textContent = system ? 'Đang giảm chuyển động theo thiết bị' : reduce ? 'Bật chuyển động' : 'Giảm chuyển động';
  toggle.addEventListener('click', () => {
    try { if (reduce) localStorage.removeItem('afyllx-reduce-motion'); else localStorage.setItem('afyllx-reduce-motion', '1'); } catch { return; }
    location.reload();
  });
}
