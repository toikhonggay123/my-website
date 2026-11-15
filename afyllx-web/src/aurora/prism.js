// Lăng kính: aurora refracted through three glass prisms around a core of light.
import { THREE, gsap, ScrollTrigger, reduce, smooth, mix, GLSL, createStage, sharedMotion } from './kit.js';

const canvas = document.querySelector('[data-stage]');
const stage = createStage(canvas, { fov: 35, far: 60 });
let readPage;
if (stage) {
  const { renderer, scene, camera, state } = stage;
  camera.position.set(0, 0, 10);

  // Pass 1: the aurora itself, rendered small into a texture.
  const rt = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const bgU = { uTime: { value: 0 }, uP: { value: 0 }, uAsp: { value: 1 } };
  const quad = new THREE.PlaneGeometry(2, 2);
  const bgScene = new THREE.Scene(), flat = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  bgScene.add(new THREE.Mesh(quad, new THREE.ShaderMaterial({
    uniforms: bgU, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: GLSL + /* glsl */ `
      uniform float uTime, uP, uAsp; varying vec2 vUv;
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
  const hitView = new THREE.Vector3();
  const glass = (bend = .17) => new THREE.ShaderMaterial({
    uniforms: { tBg: { value: rt.texture }, uRes: { value: res }, uGlow: { value: 0 }, uBend: { value: bend }, uCore: { value: 0 }, uLit: { value: 0 }, uHit: { value: hitView } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vP; varying vec3 vO;
      void main(){
        #ifdef USE_INSTANCING
          mat4 m = modelViewMatrix * instanceMatrix; vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
        #else
          mat4 m = modelViewMatrix; vN = normalize(normalMatrix * normal);
        #endif
        vO = position; vec4 mv = m * vec4(position, 1.); vP = mv.xyz; gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: GLSL + /* glsl */ `
      uniform sampler2D tBg; uniform vec2 uRes; uniform float uGlow, uBend, uCore, uLit; uniform vec3 uHit; varying vec3 vN; varying vec3 vP; varying vec3 vO;
      void main(){
        vec3 n = normalize(vN), v = normalize(-vP);
        vec2 uv = gl_FragCoord.xy / uRes, off = n.xy * uBend;
        vec3 col = vec3(texture2D(tBg, uv - off).r, texture2D(tBg, uv - off * 1.09).g, texture2D(tBg, uv - off * 1.2).b);
        float fres = pow(1. - max(dot(n, v), 0.), 2.6);
        col = col * (1.05 + .5 * uGlow) + mix(COBALT, ICE, fres) * fres * (.75 + uGlow * .5);
        col += ICE * pow(max(dot(reflect(-normalize(vec3(.35, .8, .5)), n), v), 0.), 70.) * 1.1;
        col += ELECTRIC * pow(max(dot(reflect(-normalize(vec3(-.7, .3, .6)), n), v), 0.), 18.) * .22;
        col += COBALT * (.035 + .1 * uGlow);
        // Light from the core soaks into the faces that look at it.
        col += mix(ELECTRIC, ICE, .5) * uCore * exp(-length(vO.xy) * 1.5) * .9;
        float dh = length(vP - uHit);
        col += uLit * (vec3(.9, .96, 1.) * exp(-dh * dh * 12.) * .65 + ICE * exp(-dh * 1.9) * .42 + ELECTRIC * (.1 + fres * .7));
        gl_FragColor = vec4(col, 1.);
      }`,
  });

  // Three clean takes on the glass. ?canh=tia|tang|lua picks one; the canvas attribute sets the default.
  const variant = new URLSearchParams(location.search).get('canh') || canvas.dataset.scene || 'tia';
  let focus = -1, cycle = false, opened = 0, chapter = -.5, turned = -.5; const held = [0, 0, 0];
  document.querySelectorAll('.au-scenes a').forEach((link) => link.classList.toggle('is-on', link.getAttribute('href').endsWith(variant)));
  const R = 1.45, H = 1.55, hex = (i) => new THREE.Vector2(Math.cos((i * 60 + 30) * Math.PI / 180) * R, Math.sin((i * 60 + 30) * Math.PI / 180) * R);
  const rhombus = (k, depth) => {
    const bevel = Math.min(.06, depth * .3);
    const g = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), hex(2 * k), hex(2 * k + 1), hex(2 * k + 2)]), { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3 });
    g.translate(0, 0, -depth / 2); return g;
  };
  const dirs = [0, 1, 2].map((k) => hex(2 * k + 1).normalize());
  const tilt = new THREE.Group(), spin = new THREE.Group(); tilt.add(spin); scene.add(tilt);
  const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
  const mats = [glass(), glass(), glass()];

  // A small light the glass closes around, and a soft halo behind it.
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.3, 3), new THREE.ShaderMaterial({
    ...additive, uniforms: { uGain: { value: 1 } },
    vertexShader: 'varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.); vP = mv.xyz; gl_Position = projectionMatrix * mv; }',
    fragmentShader: GLSL + 'uniform float uGain; varying vec3 vN; varying vec3 vP; void main(){ float f = pow(max(dot(normalize(vN), normalize(-vP)), 0.), 1.6); gl_FragColor = vec4(mix(ELECTRIC, vec3(1.), f) * (.35 + f) * uGain, 1.); }',
  }));
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    ...additive, uniforms: { uGain: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: GLSL + 'uniform float uGain; varying vec2 vUv; void main(){ float r = length(vUv - .5) * 2.; float g = exp(-r * r * 5.) * .5 + exp(-r * 9.) * .5; gl_FragColor = vec4(mix(COBALT, ICE, g) * g * uGain * smoothstep(1., .6, r), 1.); }',
  }));
  scene.add(halo);

  let update, lean = -1.02;
  if (variant === 'lua') {
    // Dải lụa: one unbroken ribbon of glass with three lobes, echoing the loop in the AFYLLX mark.
    lean = -.35;
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1.22, .36, 360, 40, 2, 3), glass(.26));
    spin.add(knot);
    update = (s, f) => {
      knot.material.uniforms.uGlow.value = Math.max(...f.on) * .7;
      knot.rotation.set(s.t * .09, s.t * .13 + s.p * 5.2, 0);
      knot.scale.setScalar(1.12 + f.open * .1);
    };
  } else if (variant === 'tang') {
    // Tầng kính: the column sliced into floating plates that breathe, twist and slide apart per field.
    const LAYERS = 8, D = .15, geos = [0, 1, 2].map((k) => rhombus(k, D));
    const layers = Array.from({ length: LAYERS }, () => {
      const g = new THREE.Group();
      g.userData.tiles = geos.map((geo, k) => { const m = new THREE.Mesh(geo, mats[k]); g.add(m); return m; });
      spin.add(g); return g;
    });
    spin.add(core);
    update = (s, f) => {
      const gap = .075 + f.open * .1 + .02 * Math.sin(s.t * .6);
      layers.forEach((g, i) => {
        const c = i - (LAYERS - 1) / 2, wave = Math.sin(s.t * .55 - i * .5);
        g.position.z = c * (D + gap) + wave * .03;
        g.rotation.z = wave * .05 + c * Math.sin(s.p * Math.PI * 3) * .09;
        g.userData.tiles.forEach((m, k) => {
          const out = .03 + f.on[k] * (.3 + .12 * Math.sin(s.t * .9 - i * .7) + .03 * Math.abs(c));
          m.position.set(dirs[k].x * out, dirs[k].y * out, 0);
        });
      });
      mats.forEach((m, k) => { m.uniforms.uGlow.value = f.on[k]; m.uniforms.uCore.value = .55 + f.open * .5; });
      core.material.uniforms.uGain.value = (.9 + f.open * .5) * f.pulse; core.scale.setScalar(1 + f.open * .3);
    };
  } else {
    // Tia sáng: a beam lands on the raised prism, crosses the glass and leaves as a fan of blues.
    const prisms = [0, 1, 2].map((k) => { const m = new THREE.Mesh(rhombus(k, H), mats[k]); spin.add(m); return m; });
    spin.add(core);
    const light = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShaderMaterial({
      ...additive, depthTest: false,
      uniforms: { uOn: { value: 0 }, uTint: { value: new THREE.Vector3(.27, .514, 1) }, uTime: { value: 0 }, uExit: { value: new THREE.Vector2(-.55, -1.2) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: GLSL + /* glsl */ `
        uniform float uOn, uTime; uniform vec3 uTint; uniform vec2 uExit; varying vec2 vUv;
        // A ray leaving o along d: tight at the start, opening with distance.
        float ray(vec2 p, vec2 o, vec2 d, float w, float open){
          vec2 q = p - o; float along = dot(q, d), across = q.x * d.y - q.y * d.x;
          float width = w + max(along, 0.) * open;
          return exp(-across * across / (width * width)) * smoothstep(-.02, .12, along);
        }
        vec2 dir(float a){ return vec2(cos(a), sin(a)); }
        void main(){
          vec2 p = (vUv - .5) * 40.; float r = length(p);
          float dust = .82 + .18 * noise(vec2(p.x * 1.7 + p.y * 2.3 - uTime * .35, p.y * .9));
          // In: a narrow white beam from the upper right, ending on the glass.
          vec2 din = dir(.98);
          vec3 col = vec3(.88, .95, 1.) * (ray(p, vec2(0.), din, .014, .0015) * 1.5 + ray(p, vec2(0.), din, .07, .012) * .22) * exp(-r * .045) * dust;
          // Where it lands: a small flare with a horizontal streak.
          col += vec3(.9, .96, 1.) * (exp(-r * r * 30.) * 1.05 + exp(-p.y * p.y * 260.) * exp(-abs(p.x) * 2.6) * .55 + exp(-r * 3.2) * .22);
          // Through: the faint path inside the glass.
          vec2 dthru = normalize(uExit); float inside = clamp(dot(p, dthru) / length(uExit), 0., 1.);
          col += mix(ICE, uTint, inside) * ray(p, vec2(0.), dthru, .03, .02) * step(dot(p, dthru), length(uExit)) * .5;
          // Out: the beam leaves the bottom edge at its own width and opens into one smooth band, deep blue to ice.
          vec2 q = p - uExit, dout = dir(atan(dthru.y, dthru.x) - .14);
          float along = dot(q, dout), across = q.x * dout.y - q.y * dout.x;
          float u = across / (.045 + max(along, 0.) * .2);
          float fan = smoothstep(1., .35, abs(u)) * smoothstep(-.01, .05, along) * exp(-max(along, 0.) * .11);
          float t = u * .5 + .5;
          vec3 hue = mix(DEEP * 1.7, COBALT, smoothstep(0., .3, t));
          hue = mix(hue, ELECTRIC, smoothstep(.25, .55, t)); hue = mix(hue, ICE, smoothstep(.5, .8, t)); hue = mix(hue, vec3(.86, .95, 1.), smoothstep(.8, 1., t));
          col += hue * mix(vec3(1.), uTint * 1.25, .3) * fan * 1.35 * dust;
          col += ICE * exp(-dot(q, q) * 60.) * .35;
          gl_FragColor = vec4(col * uOn, 1.);
        }`,
    }));
    light.renderOrder = 5; scene.add(light);
    const edge = new THREE.Vector3(), hit = new THREE.Vector3(), tints = [[.216, .42, 1], [.27, .514, 1], [.553, .784, 1]];
    let lit = 0;
    update = (s, f) => {
      const apart = .1 + .04 * Math.sin(s.t * .7) + f.open * .5;
      let lead = 0; f.on.forEach((v, k) => { if (v > f.on[lead]) lead = k; });
      // The beam switches on once the prism is nearly up and goes before it settles back.
      lit = smooth(.6, .97, f.on[lead]);
      prisms.forEach((m, k) => {
        const out = apart + f.on[k] * .3;
        m.position.set(dirs[k].x * out, dirs[k].y * out, f.on[k] * .75 + Math.sin(s.t * .8 + k * 2.1) * .03);
        mats[k].uniforms.uGlow.value = f.on[k] * .35; mats[k].uniforms.uCore.value = .4 + apart * .9;
        mats[k].uniforms.uLit.value = k === lead ? lit : lit * .12;
      });
      core.material.uniforms.uGain.value = (.8 + f.open * .3) * f.pulse; core.scale.setScalar(.6 + f.open * .2);
      // Aim at the middle of the raised prism's top face.
      hit.set(dirs[lead].x * R * .5, dirs[lead].y * R * .5, H / 2 + .06); prisms[lead].localToWorld(hit);
      hitView.copy(hit).sub(camera.position);
      light.position.copy(hit); light.scale.setScalar(tilt.scale.x);
      // The beam leaves at the middle of a bottom edge: whichever front face is on the left of the screen.
      // The edge sits at another depth than the light plane, so its position is corrected for perspective.
      let best = 1e9;
      [2 * lead, 2 * lead + 2].forEach((i) => {
        const side = hex(i);
        edge.set((dirs[lead].x * R + side.x) / 2, (dirs[lead].y * R + side.y) / 2, -H / 2 - .05); prisms[lead].localToWorld(edge);
        const fit = (camera.position.z - hit.z) / (camera.position.z - edge.z), x = edge.x * fit, y = edge.y * fit;
        if (x < best) { best = x; light.material.uniforms.uExit.value.set((x - hit.x) / tilt.scale.x, (y - hit.y) / tilt.scale.x); }
      });
      const u = light.material.uniforms;
      u.uTime.value = s.t; u.uOn.value = lit * (s.mobile ? .6 : 1) * (1 - f.toTail * .5);
      u.uTint.value.set(...tints[lead]);
    };
  }

  stage.onResize(() => {
    renderer.getDrawingBufferSize(res);
    rt.setSize(Math.max(2, Math.round(res.x * .55)), Math.max(2, Math.round(res.y * .55)));
    bgU.uAsp.value = state.w / state.h;
  });

  // What the current page asks of the glass: its chapters, a prism to hold up, or the three in turn.
  let fields = [], tail = null, close = null, wins = [], tailAt = 2, closeAt = 2, watch;
  const measure = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight), at = (el, k) => (el.getBoundingClientRect().top + scrollY - innerHeight * k) / max;
    wins = fields.map((f) => [at(f, .5), at(f, .5) + f.offsetHeight / max]);
    tailAt = tail ? at(tail, .75) : 2; closeAt = close ? at(close, .9) : 2;
  };
  readPage = (signal) => {
    const zone = document.querySelector('[data-aurora-zone]');
    focus = zone?.dataset.focus === undefined ? -1 : Number(zone.dataset.focus); cycle = !!zone && 'cycle' in zone.dataset;
    fields = [...document.querySelectorAll('[data-field]')]; tail = document.querySelector('[data-prism-tail]'); close = document.querySelector('[data-prism-close]');
    measure(); addEventListener('resize', measure, { signal }); addEventListener('load', measure, { signal });
    document.fonts?.ready.then(measure); setTimeout(measure, 700);
    // The scene stops drawing once its zone scrolls away.
    watch?.disconnect(); state.idle = false; canvas.style.visibility = '';
    if (zone) { watch = new IntersectionObserver(([entry]) => { state.idle = !entry.isIntersecting; canvas.style.visibility = entry.isIntersecting ? '' : 'hidden'; }); watch.observe(zone); }
    dispatchEvent(new Event('scroll')); setTimeout(() => dispatchEvent(new Event('scroll')), 60);
  };

  stage.onFrame((s) => {
    bgU.uTime.value = s.t; bgU.uP.value = s.p;
    const first = wins[0]?.[0] ?? .3, lastEnd = wins[2]?.[1] ?? .8, span = innerHeight / Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const f = {
      open: smooth(first - .14, first, s.p) - smooth(lastEnd - .02, lastEnd + .1, s.p),
      on: [0, 1, 2].map((k) => { const [a, b] = wins[k] ?? [0, 0], w = b - a; return smooth(a + w * .14, a + w * .34, s.p) - smooth(b - w * .34, b - w * .14, s.p); }),
      toTail: smooth(tailAt, tailAt + span * .6, s.p), toClose: smooth(closeAt, closeAt + span * .7, s.p),
      pulse: 1 + .12 * Math.sin(s.t * 1.7),
    };
    if (!wins.length) {
      const rise = smooth(.8, 2.6, s.t) * (1 - smooth(.25, .7, s.p)), beat = (s.t - 1) / 5, step = Math.floor(beat), part = beat - step;
      f.on = [0, 1, 2].map((k) => {
        if (focus >= 0) return k === focus ? rise : 0;
        if (!cycle || ((step % 3) + 3) % 3 !== k) return 0;
        return (smooth(.02, .2, part) - smooth(.6, .78, part)) * rise;
      });
      // Which prism faces the viewer: the page's own, or the next one in the cycle.
      chapter = focus >= 0 ? focus : cycle ? step + smooth(.8, 1, part) : -.5;
      f.open = Math.max(...f.on) * .55;
    }
    else {
      // On the home page the column turns between chapters so each field's prism arrives at the front.
      const nodes = [[0, -.5], ...wins.map(([a, b], k) => [(a + b) / 2, k]), [1, 2.5]];
      let i = 0; while (i < nodes.length - 2 && s.p > nodes[i + 1][0]) i++;
      const [p0, c0] = nodes[i], [p1, c1] = nodes[i + 1];
      chapter = c0 + (c1 - c0) * smooth(.38, .62, (s.p - p0) / Math.max(1e-4, p1 - p0));
    }
    // Ease every change, so moving between pages lowers one prism and raises the next.
    const ease = s.dt ? 1 - Math.exp(-s.dt * (wins.length ? 9 : 3)) : 1;
    f.on = f.on.map((v, k) => (held[k] += (v - held[k]) * ease));
    f.open = opened += (f.open - opened) * ease;
    while (chapter - turned > 1.5) turned += 3; while (turned - chapter > 1.5) turned -= 3;
    turned += (chapter - turned) * (s.dt ? 1 - Math.exp(-s.dt * (wins.length ? 7 : 2.6)) : 1);
    const m = s.mobile, side = m ? 0 : Math.min(2.7, s.w / s.h * 1.32);
    tilt.position.set(mix(side, 0, f.toTail), mix(m ? 1.35 : -.05, m ? .2 : -.55, f.toClose) + Math.sin(s.t * .6) * .07, 0);
    tilt.scale.setScalar((m ? .7 : 1.08) * mix(1, m ? .9 : 1.1, f.toClose));
    tilt.rotation.set(lean + s.py * .14 + Math.sin(s.t * .31) * .05, s.px * .28, Math.sin(s.t * .23) * .05);
    // Prism k points at the viewer when the column has turned k thirds of a circle.
    spin.rotation.z = Math.PI - turned * Math.PI * 2 / 3 + .2 + Math.sin(s.t * .3) * .035;
    core.rotation.set(s.t * .4, s.t * .3, 0);
    halo.position.copy(tilt.position); halo.position.z = -1.2;
    halo.scale.setScalar(tilt.scale.x * (7 + f.open * 2.5)); halo.material.uniforms.uGain.value = (.5 + f.open * .35) * f.pulse;
    update(s, f);
  });
  state.render = () => { renderer.setRenderTarget(rt); renderer.render(bgScene, flat); renderer.setRenderTarget(null); renderer.render(scene, camera); };
}

// Everything tied to the page's own markup runs again after each swap.
let pageAbort, visits = 0;
function page() {
  pageAbort?.abort(); pageAbort = new AbortController(); const { signal } = pageAbort;
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  readPage?.(signal);
  const first = visits++ === 0;

  if (!reduce) {
    gsap.from('.c2-copy .ln > span', { yPercent: 115, duration: first ? 1.5 : 1.1, ease: 'expo.out', stagger: .11, delay: first ? .3 : .05 });
    gsap.from('[data-in], .au-crumbs', { opacity: 0, y: 22, duration: first ? 1.4 : 1, ease: 'expo.out', stagger: .1, delay: first ? 1 : .25 });
    const rows = document.querySelectorAll('.au-index li');
    if (rows.length) gsap.from(rows, { opacity: 0, y: 34, duration: 1.2, ease: 'expo.out', stagger: .1, scrollTrigger: { trigger: '.au-index', start: 'top 85%' } });
    document.querySelectorAll('[data-lines]').forEach((el) => gsap.from(el.querySelectorAll('.ln > span'), { yPercent: 115, duration: 1.3, ease: 'expo.out', stagger: .09, scrollTrigger: { trigger: el, start: 'top 85%' } }));
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
    addEventListener('scroll', update, { passive: true, signal }); addEventListener('resize', update, { signal }); update();
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
  ScrollTrigger.refresh();
}
page();
document.addEventListener('astro:after-swap', page);
