import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createObject, step } from './stage-objects.js';

export const CHAPTERS = ['edu', 'digital', 'gov'];

/*
 * Timeline of one chapter, as `local` runs 0 → 1 while it owns the stage:
 *   enter     0.00 – 0.12   the compact object rises in and the lights come up
 *   expand    0.12 – 0.66   its sequence plays forward, scrubbed by scroll
 *   hold      0.66 – 0.78   fully expanded, free to follow the pointer
 *   collapse  0.78 – 0.94   the same sequence plays back until it is compact again
 *   exit      0.90 – 1.00   the compact object lifts away
 * Only one object is on stage at a time, so hand-overs never overlap.
 */
export const TIMELINE = { enter: [0, .12], build: [.12, .66], collapse: [.78, .94], exit: [.9, 1] };
export const HOLD = .72;
/** Build state 0–1 of a chapter at local time: expands, holds, then collapses. */
export const buildAt = local => step(local, ...TIMELINE.build) * (1 - step(local, ...TIMELINE.collapse));

const ACCENTS = { edu: 0x2d68ff, digital: 0x3f86ff, gov: 0x7d95ff };
/** Visual bounds of each fully built object at scale 1: width, height and centre. */
const BOUNDS = {
  edu: { w: 4.2, h: 4.9, cx: -.1, cy: .25 },
  digital: { w: 5.0, h: 2.7, cx: -.15, cy: 0 },
  gov: { w: 3.6, h: 3.7, cx: 0, cy: .15 },
};
const SCALE = { edu: 1, digital: .8, gov: .78 };
const PORTRAIT_SCALE = { edu: .62, digital: .44, gov: .56 };

function studioEnvironment(renderer) {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x040814);
  const geometry = new THREE.PlaneGeometry(1, 1);
  const materials = [];
  for (const [color, intensity, position, size] of [
    [0xd6e8ff, 3.4, [-5, 5, 5], [1.6, 9]],
    [0x4a86ff, 3.4, [6, 3, -3], [1.2, 10]],
    [0xeaf3ff, 2.6, [0, 7, 0], [9, 1]],
    [0x1a42c4, 1.8, [-5, -1, -5], [5, 7]],
    [0x9cc4ff, 1.1, [0, 0, 7], [8, 1.6]],
  ]) {
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide });
    const panel = new THREE.Mesh(geometry, material);
    panel.position.set(...position);
    panel.scale.set(size[0], size[1], 1);
    panel.lookAt(0, 0, 0);
    studio.add(panel);
    materials.push(material);
  }
  const generator = new THREE.PMREMGenerator(renderer);
  const environment = generator.fromScene(studio, .035);
  geometry.dispose();
  materials.forEach(material => material.dispose());
  generator.dispose();
  return environment;
}

function radialTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(.22, 'rgba(255,255,255,.5)');
  gradient.addColorStop(.55, 'rgba(255,255,255,.12)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ mode?: 'journey'|'detail'|'lineup', focus?: string }} options
 *   journey: one chapter at a time beside the copy; detail: one object centred;
 *   lineup: all three finished objects side by side.
 */
export function createStageScene(canvas, { mode = 'journey', focus = 'edu' } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x050915, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050915);
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 100);
  camera.position.set(0, .35, 13);
  camera.lookAt(0, .1, 0);
  const resources = { geometries: new Set(), materials: new Set(), textures: new Set() };
  const environment = studioEnvironment(renderer);
  scene.environment = environment.texture;
  scene.environmentIntensity = .62;
  const hemi = new THREE.HemisphereLight(0x8ab4ff, 0x02050f, .45);
  const key = new THREE.DirectionalLight(0xdbe9ff, 2.4);
  key.position.set(-5, 7, 7);
  const rim = new THREE.DirectionalLight(0x4a7dff, 4.0);
  rim.position.set(6, 3, -6);
  const fill = new THREE.DirectionalLight(0x4a6fd4, .5);
  fill.position.set(0, -2, 9);
  scene.add(hemi, key, rim, fill);
  const lights = [[hemi, .45], [key, 2.4], [rim, 4.0], [fill, .5]];

  const glowTexture = radialTexture();
  resources.textures.add(glowTexture);
  const plane = new THREE.PlaneGeometry(1, 1);
  resources.geometries.add(plane);
  const makeGlow = () => {
    const material = new THREE.MeshBasicMaterial({ map: glowTexture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    resources.materials.add(material);
    const item = new THREE.Mesh(plane, material);
    scene.add(item);
    return item;
  };

  const kinds = mode === 'detail' ? [focus] : CHAPTERS;
  const actors = kinds.map(kind => {
    const object = createObject[kind](resources);
    const holder = new THREE.Group();
    const aim = new THREE.Group();
    holder.add(aim);
    aim.add(object.group);
    scene.add(holder);
    const halo = makeGlow();
    const floor = makeGlow();
    floor.rotation.x = -Math.PI / 2;
    return { kind, object, holder, aim, halo, floor };
  });

  const renderTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0 });
  // Keep bloom targets single-sampled: MSAA + bloom loses frames on NVIDIA/ANGLE.
  const composer = new EffectComposer(renderer, renderTarget);
  const passes = [new RenderPass(scene, camera), new UnrealBloomPass(new THREE.Vector2(1, 1), .5, .6, 1.0), new SMAAPass(), new OutputPass()];
  passes.forEach(pass => composer.addPass(pass));
  let last = [0, 0, 0, 0, 0];
  let disposed = false;
  // Render scale chosen by the page from measured frame times (1 = full). Bloom and SMAA cost
  // grows with every pixel, so a slow GPU (integrated, on battery) renders fewer of them.
  let quality = 1;
  // Free screen area for the object, in canvas pixels, measured by the page
  // around the copy panel and chapter rail. Null falls back to fixed framing.
  let free = null;

  function place(actor, { x, y, scale, visibility, enter, exit, build, time, px, py }) {
    const { holder, aim, object, halo, floor, kind } = actor;
    holder.visible = visibility > .002;
    halo.visible = floor.visible = holder.visible;
    if (!holder.visible) return;
    holder.position.set(x, y - (1 - enter) * 1.4 + exit * 1.2, 0);
    holder.rotation.set(0, -(1 - enter) * .7 + exit * .7, 0);
    holder.scale.setScalar(scale * (.78 + .22 * enter) * (1 - .22 * exit));
    // The object turns toward the pointer; the effect is strongest once built.
    const look = .4 + .6 * build;
    aim.rotation.set(py * .55 * look, px * .95 * look, 0);
    object.update(build, time);
    halo.material.color.set(ACCENTS[kind]);
    halo.position.set(x, y + .2, -3.2);
    halo.scale.setScalar(9.5 * scale);
    halo.material.opacity = .42 * visibility;
    floor.material.color.set(ACCENTS[kind]);
    floor.position.set(x, y - 2.05 * scale, -.2);
    floor.scale.set(6 * scale, 4 * scale, 1);
    floor.material.opacity = .3 * visibility;
  }

  /**
   * @param {number} index chapter index (journey) – ignored in detail/lineup
   * @param {number} local journey: chapter time 0–1; detail/lineup: build 0–1
   */
  function render(index = 0, local = 0, time = 0, pointerX = 0, pointerY = 0) {
    if (disposed) return;
    last = [index, local, time, pointerX, pointerY];
    const px = THREE.MathUtils.clamp(pointerX, -1, 1), py = THREE.MathUtils.clamp(pointerY, -1, 1);
    const portrait = camera.aspect < .9;
    const halfHeight = camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const halfWidth = halfHeight * camera.aspect;
    let brightness = 1;
    if (mode === 'journey') {
      actors.forEach((actor, i) => {
        if (i !== index) { place(actor, { visibility: 0 }); return; }
        const enter = step(local, ...TIMELINE.enter);
        const exit = step(local, ...TIMELINE.exit);
        const visibility = enter * (1 - exit);
        brightness = .35 + .65 * visibility;
        let x = portrait ? 0 : halfWidth * .44;
        let y = portrait ? halfHeight * .44 : -.1;
        let scale = portrait ? PORTRAIT_SCALE[actor.kind] : SCALE[actor.kind] * Math.min(1, camera.aspect / 1.25);
        if (free) {
          // Fit the object's built bounds inside the free area and centre it there.
          const width = canvas.clientWidth || 1, height = canvas.clientHeight || 1;
          const bounds = BOUNDS[actor.kind];
          const areaW = (free.right - free.left) / width * 2 * halfWidth;
          const areaH = (free.bottom - free.top) / height * 2 * halfHeight;
          scale = Math.max(.2, Math.min(SCALE[actor.kind] * 1.15, .9 * Math.min(areaW / bounds.w, areaH / bounds.h)));
          x = ((free.left + free.right) / width - 1) * halfWidth - bounds.cx * scale;
          y = (1 - (free.top + free.bottom) / height) * halfHeight - bounds.cy * scale;
        }
        place(actor, { x, y, scale, visibility, enter, exit, build: buildAt(local), time, px, py });
      });
    } else if (mode === 'detail') {
      place(actors[0], { x: 0, y: -.05, scale: SCALE[actors[0].kind] * (portrait ? .7 : 1.05), visibility: 1, enter: 1, exit: 0, build: local, time, px, py });
    } else {
      const spacing = Math.min(4.2, halfWidth * .66);
      actors.forEach((actor, i) => place(actor, {
        x: (i - 1) * spacing, y: -.1, scale: SCALE[actor.kind] * .62 * Math.min(1, spacing / 4.2),
        visibility: 1, enter: 1, exit: 0, build: local, time, px, py,
      }));
    }
    for (const [light, intensity] of lights) light.intensity = intensity * brightness;
    camera.position.x = px * .25;
    camera.position.y = .35 + py * .15;
    camera.lookAt(0, .1, 0);
    composer.render();
  }

  function resize() {
    if (disposed) return;
    const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
    // Native density up to 1.5 (no forced supersampling past the screen), capped near 4.2 MP,
    // then scaled down by the measured quality.
    const native = Math.min(Math.max(1, window.devicePixelRatio || 1), 1.5, Math.sqrt(4_200_000 / (width * height)));
    const dpr = Math.max(.5, native * quality);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    composer.setPixelRatio(dpr);
    composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render(...last);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    resources.geometries.forEach(geometry => geometry.dispose());
    resources.materials.forEach(material => material.dispose());
    resources.textures.forEach(texture => texture.dispose());
    environment.dispose();
    passes.forEach(pass => pass.dispose());
    composer.dispose();
    renderer.dispose();
  }
  /** @param {{left:number, top:number, right:number, bottom:number} | null} area */
  function setFreeArea(area) {
    free = area && area.right - area.left > 40 && area.bottom - area.top > 40 ? area : null;
  }
  /** @param {number} value render scale between .6 and 1 */
  function setQuality(value) {
    const next = Math.min(1, Math.max(.6, value));
    if (Math.abs(next - quality) < .01) return;
    quality = next;
    resize();
  }
  resize();
  return { render, resize, dispose, setFreeArea, setQuality, get quality() { return quality; } };
}
