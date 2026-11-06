import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { createSculpture } from './sculpture-models.js';

const clamp = value => THREE.MathUtils.clamp(value, 0, 1);
const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const windowWeight = (value, start, peak, hold, end) => ease((value - start) / (peak - start)) * (1 - ease((value - hold) / (end - hold)));

function studioEnvironment(renderer) {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x030711);
  const geometry = new THREE.PlaneGeometry(1, 1);
  const materials = [];
  for (const [color, intensity, position, size] of [
    [0xcde5ff, 3.3, [-5, 5, 5], [1.5, 9]],
    [0x437fff, 3.5, [6, 3, -3], [1.2, 10]],
    [0xe8f3ff, 2.5, [0, 7, 0], [9, 1]],
    [0x163dbf, 1.8, [-5, -1, -5], [5, 7]],
    [0x8fbcff, .85, [0, 0, 7], [8, 1.6]],
  ]) {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide,
    });
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

function lightTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(100,155,255,1)');
  gradient.addColorStop(.17, 'rgba(42,102,255,.58)');
  gradient.addColorStop(.45, 'rgba(15,58,210,.16)');
  gradient.addColorStop(1, 'rgba(0,10,60,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

function createStage(scene, resources) {
  const { geometries, materials, textures } = resources;
  const texture = lightTexture();
  textures.add(texture);
  const plane = new THREE.PlaneGeometry(1, 1);
  geometries.add(plane);
  const haloMaterial = new THREE.MeshBasicMaterial({
    map: texture, color: 0x1b54ef, transparent: true, opacity: .24,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  materials.add(haloMaterial);
  const halo = new THREE.Mesh(plane, haloMaterial);
  halo.position.set(0, .2, -10);
  halo.scale.set(20, 15, 1);
  scene.add(halo);
  const pools = [-4.2, 0, 4.2].map(x => {
    const material = new THREE.MeshBasicMaterial({
      map: texture, color: 0x376fff, transparent: true, opacity: .31,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    materials.add(material);
    const pool = new THREE.Mesh(plane, material);
    pool.position.set(x, -2.44, -1.5);
    pool.rotation.x = -Math.PI / 2;
    pool.scale.set(7.4, 6.0, 1);
    scene.add(pool);
    return pool;
  });

  const mirrorShader = {
    name: 'AFYLLX soft obsidian reflection',
    uniforms: { tDiffuse: { value: null }, color: { value: new THREE.Color(0x01040c) }, textureMatrix: { value: new THREE.Matrix4() } },
    vertexShader: [
      'uniform mat4 textureMatrix;',
      'varying vec4 reflectedUV;',
      'varying vec3 worldPosition;',
      'void main(){',
      'reflectedUV = textureMatrix * vec4(position,1.0);',
      'worldPosition = (modelMatrix * vec4(position,1.0)).xyz;',
      'gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);',
      '}',
    ].join('\n'),
    fragmentShader: [
      'uniform sampler2D tDiffuse;',
      'uniform vec3 color;',
      'varying vec4 reflectedUV;',
      'varying vec3 worldPosition;',
      'void main(){',
      'vec3 reflection = texture2DProj(tDiffuse,reflectedUV).rgb;',
      'float fade = exp(-length(worldPosition.xz-vec2(0.0,-1.0))*.085);',
      'float alpha = (1.0-smoothstep(8.0,35.0,length(worldPosition.xz)))*.78;',
      'gl_FragColor = vec4(color + reflection * .16 * fade,alpha);',
      '}',
    ].join('\n'),
  };
  const floorGeometry = new THREE.PlaneGeometry(160, 160);
  geometries.add(floorGeometry);
  const floor = new Reflector(floorGeometry, {
    color: 0x01040c, clipBias: .003, textureWidth: 1024, textureHeight: 768,
    multisample: 0, shader: mirrorShader,
  });
  floor.position.set(0, -2.48, -2);
  floor.rotation.x = -Math.PI / 2;
  floor.material.transparent = true;
  floor.material.depthWrite = false;
  scene.add(floor);
  return { halo, pools, floor };
}

function cameraPose(progress) {
  const poses = [
    { at: 0, position: [0, 3.6, 18.2], target: [0, 3.6, -1.5] },
    { at: .18, position: [-.4, 4.6, 20.0], target: [0, 4.7, -1.5] },
    { at: .36, position: [-6.4, 1.6, 10.5], target: [-6.4, .15, -1.5] },
    { at: .58, position: [0, 2.7, 13.6], target: [0, 2.65, -1.5] },
    { at: .80, position: [6.4, 1.6, 10.8], target: [6.4, .15, -1.5] },
    { at: 1, position: [.4, 4.2, 20.5], target: [0, .5, -1.5] },
  ];
  const next = poses.findIndex(pose => pose.at >= progress);
  const index = Math.max(0, next - 1);
  const from = poses[index], to = poses[index + 1] || from;
  const t = ease((progress - from.at) / Math.max(.001, to.at - from.at));
  return {
    position: new THREE.Vector3(...from.position).lerp(new THREE.Vector3(...to.position), t),
    target: new THREE.Vector3(...from.target).lerp(new THREE.Vector3(...to.target), t),
  };
}

/** One continuous optical sculpture installation, framed for the surrounding copy. */
export function createDepthScene(canvas, { mode = 'journey' } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas, alpha: false, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x01030a, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.03;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x01030a);
  scene.fog = new THREE.FogExp2(0x010613, .017);
  const camera = new THREE.PerspectiveCamera(37, 1, .1, 160);
  const resources = { geometries: new Set(), materials: new Set(), textures: new Set() };
  const environment = studioEnvironment(renderer);
  scene.environment = environment.texture;
  scene.environmentIntensity = .56;
  scene.add(new THREE.HemisphereLight(0x7cafff, 0x01040d, .38));
  const key = new THREE.DirectionalLight(0xcce2ff, 2.2);
  key.position.set(-5, 7, 6);
  const rim = new THREE.DirectionalLight(0x3d6dff, 4.2);
  rim.position.set(7, 3, -6);
  const fill = new THREE.DirectionalLight(0x3664ce, .30);
  fill.position.set(0, 1, 9);
  scene.add(key, rim, fill);

  const models = ['edu', 'digital', 'gov'].map((kind, index) => {
    const model = createSculpture(kind, resources);
    model.origin = new THREE.Vector3((index - 1) * 4.2, 0, index === 1 ? -1.25 : -2.2);
    scene.add(model.group);
    return model;
  });
  const stage = createStage(scene, resources);
  const renderTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0 });
  // Keep bloom targets single-sampled: MSAA + bloom loses frames on NVIDIA/ANGLE.
  const composer = new EffectComposer(renderer, renderTarget);
  const passes = [
    new RenderPass(scene, camera),
    new UnrealBloomPass(new THREE.Vector2(1, 1), .42, .65, 1.05),
    new SMAAPass(),
    new OutputPass(),
  ];
  passes.forEach(pass => composer.addPass(pass));
  let last = [0, 0, 0, 0];
  let disposed = false;

  function render(progress = 0, time = 0, pointerX = 0, pointerY = 0) {
    if (disposed) return;
    const p = clamp(progress), x = THREE.MathUtils.clamp(pointerX, -1, 1), y = THREE.MathUtils.clamp(pointerY, -1, 1);
    last = [p, time, x, y];
    const weights = [
      windowWeight(p, .19, .33, .39, .50),
      windowWeight(p, .40, .55, .62, .73),
      windowWeight(p, .63, .77, .84, .98),
    ];
    const focusWeight = Math.max(...weights);
    const portrait = camera.aspect < .90;
    const opening = 1 - ease((p - .03) / .20);
    models.forEach((model, index) => {
      const weight = weights[index];
      const others = Math.max(...weights.filter((_, other) => other !== index));
      const group = model.group;
      group.visible = mode !== 'detail' || focusWeight < .1 || weight > .1;
      group.position.copy(model.origin);
      group.position.x += (weights[0] - weights[2]) * others * 3.4;
      group.position.z += weight * .35 - others * 1.8;
      group.position.y += Math.sin(time * .28 + index * 1.1) * .045;
      if (portrait) group.position.x *= 1 - opening * .49;
      group.rotation.set(
        -.04 + Math.sin(time * .18 + index) * .018,
        [ .22, -.12, -.22 ][index] + Math.sin(time * .16 + index) * .035 + x * .04,
        [ -.05, -.04, .04 ][index],
      );
      group.scale.setScalar(1.05 + weight * .10 - others * .28 + (portrait && index === 1 ? opening * .18 : 0));
      model.update(weight, time);
      stage.pools[index].material.opacity = group.visible ? .22 + weight * .20 : 0;
    });
    const pose = cameraPose(p);
    const focus = models.reduce((sum, model, index) => sum + model.group.position.x * weights[index], 0) / Math.max(.001, weights.reduce((sum, value) => sum + value, 0));
    if (mode === 'detail') {
      pose.position.set(focusWeight > .1 ? focus + .5 : 0, 1.4, 12.0);
      pose.target.set(focusWeight > .1 ? focus : 0, .1, -1.6);
    } else if (portrait) {
      pose.position.x = THREE.MathUtils.lerp(pose.position.x, focus, focusWeight);
      pose.target.x = THREE.MathUtils.lerp(pose.target.x, focus, focusWeight);
      pose.position.z = THREE.MathUtils.lerp(pose.position.z, 14.7, focusWeight);
      pose.position.y = THREE.MathUtils.lerp(pose.position.y, 2.6, focusWeight);
      pose.target.y = THREE.MathUtils.lerp(pose.target.y, 2.35, focusWeight);
    } else {
      const offset = (weights[2] - weights[0]) * Math.max(0, 1.30 - camera.aspect) * 1.8;
      pose.position.x -= offset;
      pose.target.x -= offset;
      pose.position.z += Math.max(0, 1.22 / camera.aspect - 1) * 4.0;
    }
    if (mode === 'detail' && portrait) {
      pose.position.z += 4.0;
      pose.position.y = 1.8;
      pose.target.y = .3;
    }
    camera.position.copy(pose.position);
    camera.position.x += x * .20;
    camera.position.y += y * .12;
    pose.target.x += x * .08;
    camera.lookAt(pose.target);
    stage.halo.position.x = focusWeight > .1 ? focus * .68 : 0;
    stage.halo.material.opacity = .18 + focusWeight * .12;
    composer.render();
  }

  function resize() {
    if (disposed) return;
    const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
    const dpr = Math.min(Math.max(1.5, window.devicePixelRatio || 1), 2, Math.sqrt(4_200_000 / (width * height)));
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    composer.setPixelRatio(dpr);
    composer.setSize(width, height);
    stage.floor.getRenderTarget().setSize(Math.min(1280, Math.round(width * dpr * .72)), Math.min(960, Math.round(height * dpr * .72)));
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render(...last);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    stage.floor.dispose();
    resources.geometries.forEach(geometry => geometry.dispose());
    resources.materials.forEach(material => material.dispose());
    resources.textures.forEach(texture => texture.dispose());
    environment.dispose();
    passes.forEach(pass => pass.dispose());
    composer.dispose();
    renderer.dispose();
  }
  resize();
  return { render, resize, dispose };
}
