export interface Block3D {
  /** Position in world units */
  pos: [number, number, number];
  /** Euler XYZ rotation in radians */
  rot: [number, number, number];
  /** Non-uniform scale in world units */
  scale: [number, number, number];
  /** Base RGB color in 0..1 */
  color: [number, number, number];
  /** Emissive/rim highlight intensity 0..1.5 */
  glow?: number;
  /** Opacity 0..1 (< 0.99 renders in translucent pass) */
  opacity?: number;
  /** Render crisp wireframe edge overlay (0..1 alpha) */
  wire?: number;
  /** Geometry type */
  shape?: 'box' | 'crystal';
}

export interface StageMetrics {
  fps: number;
  frameMs: number;
  webgl2: boolean;
}

export interface StagePointer {
  /** Normalized -1..1 across canvas */
  nx: number;
  /** Normalized -1..1 across canvas */
  ny: number;
  inside: boolean;
  /** Seconds since last click pulse */
  pulseAge: number;
  pulseOrigin: [number, number];
}

export interface FrameContext {
  time: number;
  dt: number;
  aspect: number;
  pointer: StagePointer;
  reducedMotion: boolean;
  cameraEye: [number, number, number];
  cameraTarget: [number, number, number];
  blocks: Block3D[];
}

export interface BlockStageOptions {
  /** Called each animation frame to update camera and blocks */
  onFrame: (ctx: FrameContext) => void;
  /** Called ~2x/sec with FPS telemetry */
  onMetrics?: (metrics: StageMetrics) => void;
  /** Background clear RGBA (transparent by default) */
  clearColor?: [number, number, number, number];
  /** Vertical field of view in degrees */
  fovDeg?: number;
  /** Initial reduced motion state */
  reducedMotion?: boolean;
}

export interface BlockStageController {
  setReducedMotion: (reduced: boolean) => void;
  setChoreography: (onFrame: (ctx: FrameContext) => void, fovDeg?: number) => void;
  triggerPulse: (nx?: number, ny?: number) => void;
  dispose: () => void;
}

/**
 * Generates a watertight 3D rounded/chamfered box mesh (-0.5..0.5) using a 3x3 grid per face
 * projected onto a rounded-cube SDF so all bevels & corners catch specular highlights cleanly.
 */
function buildRoundedBox(radius = 0.085): { verts: Float32Array; indices: Uint16Array } {
  const inner = 0.5 - radius;
  const stops = [-0.5, -inner, inner, 0.5];
  const uvStops = [0, 0.16, 0.84, 1];

  const faces: { n: [number, number, number]; u: [number, number, number]; v: [number, number, number] }[] = [
    { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },   // +Z
    { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] }, // -Z
    { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },  // +X
    { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },  // -X
    { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },  // +Y
    { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },  // -Y
  ];

  const verts: number[] = [];
  const indices: number[] = [];

  for (let f = 0; f < faces.length; f++) {
    const { n, u, v } = faces[f];
    const baseVertex = f * 16;

    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 4; i++) {
        const su = stops[i];
        const sv = stops[j];
        const px = n[0] * 0.5 + u[0] * su + v[0] * sv;
        const py = n[1] * 0.5 + u[1] * su + v[1] * sv;
        const pz = n[2] * 0.5 + u[2] * su + v[2] * sv;

        const cx = Math.max(-inner, Math.min(inner, px));
        const cy = Math.max(-inner, Math.min(inner, py));
        const cz = Math.max(-inner, Math.min(inner, pz));

        const dx = px - cx;
        const dy = py - cy;
        const dz = pz - cz;
        const len = Math.hypot(dx, dy, dz) || 1;
        const nx = dx / len;
        const ny = dy / len;
        const nz = dz / len;

        verts.push(
          cx + nx * radius,
          cy + ny * radius,
          cz + nz * radius,
          nx,
          ny,
          nz,
          uvStops[i],
          uvStops[j],
        );
      }
    }

    for (let j = 0; j < 3; j++) {
      for (let i = 0; i < 3; i++) {
        const a = baseVertex + j * 4 + i;
        const b = a + 1;
        const c = a + 4;
        const d = c + 1;
        indices.push(a, b, d, a, d, c);
      }
    }
  }

  return { verts: new Float32Array(verts), indices: new Uint16Array(indices) };
}

/** Faceted 3D crystal / octahedron with outward CCW normals. */
function buildCrystal(): { verts: Float32Array; indices: Uint16Array } {
  const top: [number, number, number] = [0, 0.68, 0];
  const bot: [number, number, number] = [0, -0.68, 0];
  const ring: [number, number, number][] = [
    [0, 0, 0.5],
    [0.5, 0, 0],
    [0, 0, -0.5],
    [-0.5, 0, 0],
  ];

  const verts: number[] = [];
  const indices: number[] = [];
  let idx = 0;

  function pushTri(a: [number, number, number], b: [number, number, number], c: [number, number, number]) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    verts.push(a[0], a[1], a[2], nx, ny, nz, 0.5, 1);
    verts.push(b[0], b[1], b[2], nx, ny, nz, 0, 0);
    verts.push(c[0], c[1], c[2], nx, ny, nz, 1, 0);
    indices.push(idx, idx + 1, idx + 2);
    idx += 3;
  }

  for (let i = 0; i < 4; i++) {
    const next = (i + 1) % 4;
    pushTri(top, ring[i], ring[next]);
    pushTri(bot, ring[next], ring[i]);
  }

  return { verts: new Float32Array(verts), indices: new Uint16Array(indices) };
}

const BOX_MESH = buildRoundedBox(0.075);
const CRYSTAL_MESH = buildCrystal();

const WIRE_VERTS = new Float32Array([
  -0.504, -0.504,  0.504,   0.504, -0.504,  0.504,
   0.504, -0.504,  0.504,   0.504,  0.504,  0.504,
   0.504,  0.504,  0.504,  -0.504,  0.504,  0.504,
  -0.504,  0.504,  0.504,  -0.504, -0.504,  0.504,

  -0.504, -0.504, -0.504,   0.504, -0.504, -0.504,
   0.504, -0.504, -0.504,   0.504,  0.504, -0.504,
   0.504,  0.504, -0.504,  -0.504,  0.504, -0.504,
  -0.504,  0.504, -0.504,  -0.504, -0.504, -0.504,

  -0.504, -0.504, -0.504,  -0.504, -0.504,  0.504,
   0.504, -0.504, -0.504,   0.504, -0.504,  0.504,
   0.504,  0.504, -0.504,   0.504,  0.504,  0.504,
  -0.504,  0.504, -0.504,  -0.504,  0.504,  0.504,
]);

const BLOCK_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUv;

uniform mat4 uProjView;
uniform mat4 uModel;
uniform mat3 uNormalMat;

out vec3 vWorldPos;
out vec3 vNormal;
out vec2 vUv;

void main() {
  vec4 wp = uModel * vec4(aPos, 1.0);
  vWorldPos = wp.xyz;
  vNormal = normalize(uNormalMat * aNormal);
  vUv = aUv;
  gl_Position = uProjView * wp;
}`;

const BLOCK_FS = `#version 300 es
precision highp float;

in vec3 vWorldPos;
in vec3 vNormal;
in vec2 vUv;

uniform vec3 uCamPos;
uniform vec3 uColor;
uniform float uGlow;
uniform float uOpacity;

out vec4 fragColor;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCamPos - vWorldPos);

  vec3 L1 = normalize(vec3(0.55, 0.88, 0.62));
  vec3 L2 = normalize(vec3(-0.72, 0.25, 0.45));
  vec3 L3 = normalize(vec3(0.0, -0.75, -0.55));

  float diff1 = max(dot(N, L1), 0.0);
  float diff2 = max(dot(N, L2), 0.0);
  float diff3 = max(dot(N, L3), 0.0);

  vec3 H1 = normalize(L1 + V);
  float spec = pow(max(dot(N, H1), 0.0), 48.0);
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.6);

  vec3 base = uColor * (0.32 + 0.60 * diff1 + 0.24 * diff2 + 0.10 * diff3);
  vec3 rimColor = mix(vec3(0.45, 0.74, 1.0), vec3(0.86, 0.95, 1.0), clamp(uGlow * 0.55, 0.0, 1.0));
  vec3 lit = base
    + rimColor * (fresnel * (0.38 + 0.62 * uGlow))
    + vec3(0.94, 0.97, 1.0) * (spec * 0.42)
    + uColor * (uGlow * 0.24);

  float alpha = clamp(uOpacity + fresnel * (1.0 - uOpacity) * 0.45, 0.0, 1.0);
  fragColor = vec4(lit * alpha, alpha);
}`;

const WIRE_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
uniform mat4 uProjView;
uniform mat4 uModel;
void main() {
  gl_Position = uProjView * uModel * vec4(aPos, 1.0);
}`;

const WIRE_FS = `#version 300 es
precision highp float;
uniform vec4 uWireColor;
out vec4 fragColor;
void main() {
  fragColor = vec4(uWireColor.rgb * uWireColor.a, uWireColor.a);
}`;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error('Unable to create shader');
  gl.shaderSource(sh, source);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(sh) || 'Shader compile error';
    gl.deleteShader(sh);
    throw new Error(info);
  }
  return sh;
}

function createProgram(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  const prog = gl.createProgram();
  if (!prog) throw new Error('Unable to create program');
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(prog) || 'Program link error';
    gl.deleteProgram(prog);
    throw new Error(info);
  }
  return prog;
}

function uploadMesh(gl: WebGL2RenderingContext, mesh: { verts: Float32Array; indices: Uint16Array }) {
  const vao = gl.createVertexArray()!;
  const vbo = gl.createBuffer()!;
  const ebo = gl.createBuffer()!;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.verts, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
  const stride = 8 * 4;
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * 4);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 6 * 4);
  gl.bindVertexArray(null);
  return { vao, vbo, ebo, count: mesh.indices.length };
}

function mat4Perspective(out: Float32Array, fovy: number, aspect: number, near: number, far: number) {
  const f = 1.0 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  out.fill(0);
  out[0] = f / Math.max(aspect, 0.01);
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
}

function mat4LookAt(out: Float32Array, eye: [number, number, number], target: [number, number, number]) {
  let zx = eye[0] - target[0];
  let zy = eye[1] - target[1];
  let zz = eye[2] - target[2];
  let len = Math.hypot(zx, zy, zz) || 1;
  zx /= len; zy /= len; zz /= len;

  let xx = 1 * zz - 0 * zy;
  let xy = 0 * zx - 0 * zz;
  let xz = 0 * zy - 1 * zx;
  len = Math.hypot(xx, xy, xz);
  if (len < 1e-5) {
    xx = 1; xy = 0; xz = 0;
  } else {
    xx /= len; xy /= len; xz /= len;
  }

  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
  out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
  out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  out[15] = 1;
}

function mat4Multiply(out: Float32Array, a: Float32Array, b: Float32Array) {
  for (let col = 0; col < 4; col++) {
    const b0 = b[col * 4];
    const b1 = b[col * 4 + 1];
    const b2 = b[col * 4 + 2];
    const b3 = b[col * 4 + 3];
    out[col * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    out[col * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    out[col * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    out[col * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
}

function composeModelAndNormal(
  model: Float32Array,
  normalMat: Float32Array,
  pos: [number, number, number],
  rot: [number, number, number],
  scale: [number, number, number],
) {
  const cx = Math.cos(rot[0]), sx = Math.sin(rot[0]);
  const cy = Math.cos(rot[1]), sy = Math.sin(rot[1]);
  const cz = Math.cos(rot[2]), sz = Math.sin(rot[2]);

  const r00 = cz * cy;
  const r01 = cz * sy * sx - sz * cx;
  const r02 = cz * sy * cx + sz * sx;

  const r10 = sz * cy;
  const r11 = sz * sy * sx + cz * cx;
  const r12 = sz * sy * cx - cz * sx;

  const r20 = -sy;
  const r21 = cy * sx;
  const r22 = cy * cx;

  const sxv = Math.max(Math.abs(scale[0]), 1e-4) * (scale[0] < 0 ? -1 : 1);
  const syv = Math.max(Math.abs(scale[1]), 1e-4) * (scale[1] < 0 ? -1 : 1);
  const szv = Math.max(Math.abs(scale[2]), 1e-4) * (scale[2] < 0 ? -1 : 1);

  model[0] = r00 * sxv; model[1] = r10 * sxv; model[2] = r20 * sxv; model[3] = 0;
  model[4] = r01 * syv; model[5] = r11 * syv; model[6] = r21 * syv; model[7] = 0;
  model[8] = r02 * szv; model[9] = r12 * szv; model[10] = r22 * szv; model[11] = 0;
  model[12] = pos[0];   model[13] = pos[1];   model[14] = pos[2];   model[15] = 1;

  const isx = 1 / sxv;
  const isy = 1 / syv;
  const isz = 1 / szv;
  normalMat[0] = r00 * isx; normalMat[1] = r10 * isx; normalMat[2] = r20 * isx;
  normalMat[3] = r01 * isy; normalMat[4] = r11 * isy; normalMat[5] = r21 * isy;
  normalMat[6] = r02 * isz; normalMat[7] = r12 * isz; normalMat[8] = r22 * isz;
}

export function createBlockStage(canvas: HTMLCanvasElement, options: BlockStageOptions): BlockStageController {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
    premultipliedAlpha: true,
  });

  if (!gl) {
    options.onMetrics?.({ fps: 0, frameMs: 0, webgl2: false });
    return {
      setReducedMotion: () => {},
      setChoreography: () => {},
      triggerPulse: () => {},
      dispose: () => {},
    };
  }

  const blockProg = createProgram(gl, BLOCK_VS, BLOCK_FS);
  const wireProg = createProgram(gl, WIRE_VS, WIRE_FS);

  const boxMesh = uploadMesh(gl, BOX_MESH);
  const crystalMesh = uploadMesh(gl, CRYSTAL_MESH);

  const wireVao = gl.createVertexArray()!;
  const wireVbo = gl.createBuffer()!;
  gl.bindVertexArray(wireVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, wireVbo);
  gl.bufferData(gl.ARRAY_BUFFER, WIRE_VERTS, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 3 * 4, 0);
  gl.bindVertexArray(null);

  const uBlock = {
    projView: gl.getUniformLocation(blockProg, 'uProjView'),
    model: gl.getUniformLocation(blockProg, 'uModel'),
    normalMat: gl.getUniformLocation(blockProg, 'uNormalMat'),
    camPos: gl.getUniformLocation(blockProg, 'uCamPos'),
    color: gl.getUniformLocation(blockProg, 'uColor'),
    glow: gl.getUniformLocation(blockProg, 'uGlow'),
    opacity: gl.getUniformLocation(blockProg, 'uOpacity'),
  };
  const uWire = {
    projView: gl.getUniformLocation(wireProg, 'uProjView'),
    model: gl.getUniformLocation(wireProg, 'uModel'),
    wireColor: gl.getUniformLocation(wireProg, 'uWireColor'),
  };

  const proj = new Float32Array(16);
  const view = new Float32Array(16);
  const projView = new Float32Array(16);
  const model = new Float32Array(16);
  const normalMat = new Float32Array(9);

  const pointer: StagePointer = {
    nx: 0,
    ny: 0,
    inside: false,
    pulseAge: 99,
    pulseOrigin: [0, 0],
  };

  const ctx: FrameContext = {
    time: 0,
    dt: 0.016,
    aspect: 1,
    pointer,
    reducedMotion: Boolean(options.reducedMotion),
    cameraEye: [0, 0, 8],
    cameraTarget: [0, 0, 0],
    blocks: [],
  };

  let activeOnFrame = options.onFrame;
  let fovRad = ((options.fovDeg ?? 36) * Math.PI) / 180;
  let width = 1;
  let height = 1;
  let isVisible = true;
  let isDocHidden = document.hidden;
  let disposed = false;
  let rafId = 0;
  let lastTs = 0;
  let fpsAccum = 0;
  let fpsFrames = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.round(rect.width * dpr));
    height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.aspect = width / height;
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const io = new IntersectionObserver(
    (entries) => {
      isVisible = entries[0]?.isIntersecting ?? true;
      if (isVisible && !isDocHidden && !rafId && !disposed) {
        lastTs = 0;
        rafId = requestAnimationFrame(tick);
      }
    },
    { threshold: 0.01 },
  );
  io.observe(canvas);

  const onVisibility = () => {
    isDocHidden = document.hidden;
    if (!isDocHidden && isVisible && !rafId && !disposed) {
      lastTs = 0;
      rafId = requestAnimationFrame(tick);
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  const onPointerMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    pointer.nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
    pointer.inside = true;
  };
  const onPointerLeave = () => {
    pointer.inside = false;
  };
  const onPointerDown = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    pointer.pulseOrigin = [
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -(((e.clientY - r.top) / r.height) * 2 - 1),
    ];
    pointer.pulseAge = 0;
  };
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('pointerdown', onPointerDown);

  const clear = options.clearColor ?? [0, 0, 0, 0];

  function drawBlockMesh(b: Block3D) {
    if (!gl) return;
    const mesh = b.shape === 'crystal' ? crystalMesh : boxMesh;
    gl.bindVertexArray(mesh.vao);
    composeModelAndNormal(model, normalMat, b.pos, b.rot, b.scale);
    gl.uniformMatrix4fv(uBlock.model, false, model);
    gl.uniformMatrix3fv(uBlock.normalMat, false, normalMat);
    gl.uniform3f(uBlock.color, b.color[0], b.color[1], b.color[2]);
    gl.uniform1f(uBlock.glow, b.glow ?? 0);
    gl.uniform1f(uBlock.opacity, b.opacity ?? 1);
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
  }

  function renderFrame() {
    if (!gl || disposed) return;
    resize();
    if (width <= 1 || height <= 1) return;

    gl.viewport(0, 0, width, height);
    gl.clearColor(clear[0], clear[1], clear[2], clear[3]);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    mat4Perspective(proj, fovRad, ctx.aspect, 0.2, 60);
    mat4LookAt(view, ctx.cameraEye, ctx.cameraTarget);
    mat4Multiply(projView, proj, view);

    const opaque: Block3D[] = [];
    const translucent: { b: Block3D; distSq: number }[] = [];
    const wireItems: Block3D[] = [];

    for (let i = 0; i < ctx.blocks.length; i++) {
      const b = ctx.blocks[i];
      const op = b.opacity ?? 1;
      if (op <= 0.01) continue;
      if (op < 0.99) {
        const dx = b.pos[0] - ctx.cameraEye[0];
        const dy = b.pos[1] - ctx.cameraEye[1];
        const dz = b.pos[2] - ctx.cameraEye[2];
        translucent.push({ b, distSq: dx * dx + dy * dy + dz * dz });
      } else {
        opaque.push(b);
      }
      if ((b.wire ?? 0) > 0.01 && b.shape !== 'crystal') wireItems.push(b);
    }

    gl.useProgram(blockProg);
    gl.uniformMatrix4fv(uBlock.projView, false, projView);
    gl.uniform3f(uBlock.camPos, ctx.cameraEye[0], ctx.cameraEye[1], ctx.cameraEye[2]);

    gl.disable(gl.BLEND);
    gl.depthMask(true);
    for (let i = 0; i < opaque.length; i++) {
      drawBlockMesh(opaque[i]);
    }

    if (translucent.length > 0) {
      translucent.sort((a, c) => c.distSq - a.distSq);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      for (let i = 0; i < translucent.length; i++) {
        drawBlockMesh(translucent[i].b);
      }
      gl.depthMask(true);
    }

    if (wireItems.length > 0) {
      gl.useProgram(wireProg);
      gl.bindVertexArray(wireVao);
      gl.uniformMatrix4fv(uWire.projView, false, projView);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      for (let i = 0; i < wireItems.length; i++) {
        const b = wireItems[i];
        composeModelAndNormal(model, normalMat, b.pos, b.rot, b.scale);
        gl.uniformMatrix4fv(uWire.model, false, model);
        gl.uniform4f(uWire.wireColor, 0.58, 0.82, 1.0, b.wire ?? 0.35);
        gl.drawArrays(gl.LINES, 0, 24);
      }
    }

    gl.bindVertexArray(null);
  }

  function tick(ts: number) {
    rafId = 0;
    if (disposed || !isVisible || isDocHidden) return;

    if (!lastTs) lastTs = ts;
    const rawDt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;
    ctx.dt = rawDt || 0.016;
    if (!ctx.reducedMotion) {
      ctx.time += ctx.dt;
      pointer.pulseAge += ctx.dt;
    }

    activeOnFrame(ctx);
    renderFrame();

    if (options.onMetrics) {
      fpsAccum += rawDt;
      fpsFrames += 1;
      if (fpsAccum >= 0.45) {
        options.onMetrics({
          fps: Math.round(fpsFrames / fpsAccum),
          frameMs: Number(((fpsAccum / fpsFrames) * 1000).toFixed(1)),
          webgl2: true,
        });
        fpsAccum = 0;
        fpsFrames = 0;
      }
    }

    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);

  return {
    setReducedMotion(reduced: boolean) {
      ctx.reducedMotion = reduced;
      activeOnFrame(ctx);
      renderFrame();
    },
    setChoreography(onFrame: (ctx: FrameContext) => void, nextFovDeg?: number) {
      activeOnFrame = onFrame;
      if (nextFovDeg !== undefined) fovRad = (nextFovDeg * Math.PI) / 180;
      activeOnFrame(ctx);
      renderFrame();
    },
    triggerPulse(nx = 0, ny = 0) {
      pointer.pulseOrigin = [nx, ny];
      pointer.pulseAge = 0;
    },
    dispose() {
      disposed = true;
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('pointerdown', onPointerDown);
      gl.deleteBuffer(boxMesh.vbo);
      gl.deleteBuffer(boxMesh.ebo);
      gl.deleteVertexArray(boxMesh.vao);
      gl.deleteBuffer(crystalMesh.vbo);
      gl.deleteBuffer(crystalMesh.ebo);
      gl.deleteVertexArray(crystalMesh.vao);
      gl.deleteBuffer(wireVbo);
      gl.deleteVertexArray(wireVao);
      gl.deleteProgram(blockProg);
      gl.deleteProgram(wireProg);
    },
  };
}
