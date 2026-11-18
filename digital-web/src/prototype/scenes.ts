import type { Block3D, FrameContext } from './webglBlocks';

function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ============================================================================
// NHÓM B: WebGL2 Khối Kiến Trúc Lắp Ghép (Scroll-Driven 3D Assembly)
// ============================================================================
export interface AssemblyState {
  scrollProgress: number;
  forcedStage: number | null;
  activeSolution: number;
  modeIndex: number;
}

interface AssemblyBlueprint {
  group: number; // 0: ban-hang, 1: dat-lich, 2: dich-vu, 3: landing, 4: quan-ly
  shape?: 'box' | 'crystal';
  assembled: { pos: [number, number, number]; scale: [number, number, number]; color: [number, number, number] };
  exploded: { pos: [number, number, number]; rot: [number, number, number]; scale?: [number, number, number] };
  tower: { pos: [number, number, number]; scale: [number, number, number] };
}

const BRAND_BLUE: [number, number, number] = [0.18, 0.38, 0.84];
const ELECTRIC_BLUE: [number, number, number] = [0.30, 0.54, 1.0];
const ICE_CYAN: [number, number, number] = [0.55, 0.80, 1.0];
const SLATE_DARK: [number, number, number] = [0.08, 0.14, 0.27];
const FROST_WHITE: [number, number, number] = [0.85, 0.91, 0.99];

const ASSEMBLY_BLUEPRINTS: AssemblyBlueprint[] = [
  // 0: Base browser chassis
  { group: 2, assembled: { pos: [-0.22, -0.1, -0.34], scale: [3.05, 1.95, 0.2], color: SLATE_DARK }, exploded: { pos: [-0.45, -0.15, -1.45], rot: [0.05, -0.18, 0] }, tower: { pos: [0, -1.35, 0], scale: [2.6, 0.36, 1.8] } },
  // 1: Top nav bar beam
  { group: 3, assembled: { pos: [-0.22, 0.72, -0.12], scale: [2.82, 0.22, 0.18], color: ELECTRIC_BLUE }, exploded: { pos: [-0.15, 1.32, -0.6], rot: [-0.08, 0.08, 0] }, tower: { pos: [0, 1.25, 0], scale: [1.5, 0.28, 1.1] } },
  // 2: Hero main monolith
  { group: 3, assembled: { pos: [-0.74, 0.18, 0.04], scale: [1.58, 0.7, 0.24], color: BRAND_BLUE }, exploded: { pos: [-1.18, 0.52, 0.22], rot: [0.1, 0.24, -0.04] }, tower: { pos: [0, 0.72, 0], scale: [1.85, 0.48, 1.25] } },
  // 3: Hero visual prism
  { group: 2, assembled: { pos: [0.58, 0.18, 0.06], scale: [0.92, 0.7, 0.28], color: ICE_CYAN }, exploded: { pos: [0.92, 0.62, 0.45], rot: [-0.1, -0.24, 0.06] }, tower: { pos: [0.65, 0.22, 0.35], scale: [0.72, 0.48, 0.72] } },
  // 4: Product / Service Cube 1
  { group: 0, assembled: { pos: [-1.1, -0.54, 0.08], scale: [0.8, 0.5, 0.26], color: FROST_WHITE }, exploded: { pos: [-1.42, -0.62, 0.72], rot: [0.22, 0.35, 0.08] }, tower: { pos: [-0.62, -0.35, 0.35], scale: [0.68, 0.44, 0.68] } },
  // 5: Product / Service Cube 2
  { group: 0, assembled: { pos: [-0.2, -0.54, 0.12], scale: [0.8, 0.5, 0.32], color: ELECTRIC_BLUE }, exploded: { pos: [-0.1, -0.66, 1.02], rot: [0.14, -0.2, 0] }, tower: { pos: [0.0, -0.35, -0.25], scale: [0.68, 0.44, 0.68] } },
  // 6: Product / Service Cube 3
  { group: 0, assembled: { pos: [0.7, -0.54, 0.08], scale: [0.8, 0.5, 0.26], color: FROST_WHITE }, exploded: { pos: [1.18, -0.62, 0.72], rot: [-0.18, -0.32, -0.05] }, tower: { pos: [0.62, -0.35, 0.35], scale: [0.68, 0.44, 0.68] } },
  // 7: Mobile companion slab
  { group: 1, assembled: { pos: [1.42, -0.32, 0.45], scale: [0.78, 1.38, 0.2], color: SLATE_DARK }, exploded: { pos: [1.92, -0.1, 1.15], rot: [0.05, -0.42, 0.04] }, tower: { pos: [-0.55, 0.22, -0.25], scale: [0.76, 0.48, 0.76] } },
  // 8: Mobile screen accent cube
  { group: 1, assembled: { pos: [1.42, -0.14, 0.6], scale: [0.56, 0.52, 0.12], color: ELECTRIC_BLUE }, exploded: { pos: [2.1, 0.15, 1.52], rot: [0.05, -0.42, 0.04] }, tower: { pos: [-0.55, 0.74, -0.25], scale: [0.44, 0.28, 0.44] } },
  // 9: Floating notification block top-left (clear of nav)
  { group: 1, assembled: { pos: [-1.42, 1.08, 0.46], scale: [0.84, 0.3, 0.16], color: FROST_WHITE }, exploded: { pos: [-1.85, 1.3, 1.18], rot: [0.18, 0.3, -0.06] }, tower: { pos: [0.52, 0.76, 0.25], scale: [0.55, 0.3, 0.55] } },
  // 10: Floating notification block bottom
  { group: 4, assembled: { pos: [0.05, -1.16, 0.52], scale: [0.92, 0.3, 0.16], color: ICE_CYAN }, exploded: { pos: [0.28, -1.42, 1.32], rot: [-0.15, 0.22, 0.05] }, tower: { pos: [0, -0.86, 0], scale: [2.15, 0.38, 1.45] } },
  // 11: Internal crystal core — tucked cleanly behind in assembled view, reveals in exploded & tower!
  { group: 4, shape: 'crystal', assembled: { pos: [0, 0.05, -0.78], scale: [0.34, 0.34, 0.34], color: ICE_CYAN }, exploded: { pos: [0, 0.08, 0.35], rot: [0.35, 0.78, 0.12], scale: [0.56, 0.56, 0.56] }, tower: { pos: [0, 1.78, 0], scale: [0.46, 0.46, 0.46] } },
  // 12: Architectural pillar left
  { group: 4, assembled: { pos: [-1.92, -0.18, -0.45], scale: [0.22, 1.15, 0.22], color: BRAND_BLUE }, exploded: { pos: [-2.22, -0.35, -0.85], rot: [0, 0.4, 0.12] }, tower: { pos: [-1.05, -0.86, -0.45], scale: [0.26, 0.9, 0.26] } },
  // 13: Architectural pillar right
  { group: 2, assembled: { pos: [1.85, 0.62, -0.42], scale: [0.24, 0.88, 0.24], color: ELECTRIC_BLUE }, exploded: { pos: [2.18, 0.9, -0.88], rot: [0.1, -0.35, -0.1] }, tower: { pos: [1.05, -0.86, -0.45], scale: [0.26, 0.9, 0.26] } },
];

export function createAssemblyChoreography(getState: () => AssemblyState) {
  let smoothStage = 0;
  let camRotX = 0.22;
  let camRotY = -0.36;

  const current = ASSEMBLY_BLUEPRINTS.map((bp) => ({
    pos: [...bp.assembled.pos] as [number, number, number],
    rot: [0, 0, 0] as [number, number, number],
    scale: [...bp.assembled.scale] as [number, number, number],
    glow: 0.14,
  }));

  return (ctx: FrameContext) => {
    const state = getState();
    const targetStage = state.forcedStage !== null ? state.forcedStage : state.scrollProgress * 3;
    const rate = ctx.reducedMotion ? 60 : 6.5;
    smoothStage = damp(smoothStage, targetStage, rate, ctx.dt);

    const targetYaw = ctx.reducedMotion ? -0.34 : -0.34 + ctx.pointer.nx * 0.34 + Math.sin(ctx.time * 0.45) * 0.08;
    const targetPitch = ctx.reducedMotion ? 0.2 : 0.2 - ctx.pointer.ny * 0.2 + Math.cos(ctx.time * 0.35) * 0.04;
    camRotY = damp(camRotY, targetYaw, rate, ctx.dt);
    camRotX = damp(camRotX, targetPitch, rate, ctx.dt);

    const radius = lerp(7.3, 8.4, clamp01(smoothStage / 2));
    ctx.cameraEye = [
      Math.sin(camRotY) * Math.cos(camRotX) * radius,
      Math.sin(camRotX) * radius + 0.18,
      Math.cos(camRotY) * Math.cos(camRotX) * radius,
    ];
    ctx.cameraTarget = [0, 0, 0];

    const s = smoothStage;
    const explodeW = s <= 1 ? clamp01(s) : clamp01(2 - s);
    const towerW = clamp01(s - 2);
    const monoW = s > 1 && s < 2.6 ? clamp01(1 - Math.abs(s - 2)) : 0;

    const pulseWave = ctx.pointer.pulseAge < 1.2 ? Math.sin(ctx.pointer.pulseAge * Math.PI * 2.5) * Math.exp(-ctx.pointer.pulseAge * 3) : 0;

    ctx.blocks = ASSEMBLY_BLUEPRINTS.map((bp, i) => {
      const c = current[i];
      const modeShift = state.modeIndex * 0.14 * ((i % 3) - 1);
      const bob = ctx.reducedMotion ? 0 : Math.sin(ctx.time * 1.4 + i * 0.55) * 0.05;

      let tx = lerp(bp.assembled.pos[0], bp.exploded.pos[0], explodeW);
      let ty = lerp(bp.assembled.pos[1], bp.exploded.pos[1], explodeW) + bob + modeShift * 0.35;
      let tz = lerp(bp.assembled.pos[2], bp.exploded.pos[2], explodeW);

      if (monoW > 0.01) {
        const col = (i % 3) - 1;
        const row = Math.floor(i / 5) - 1;
        tx = lerp(tx, col * 1.45, monoW);
        ty = lerp(ty, row * 0.48, monoW);
        tz = lerp(tz, ((i % 4) - 1.5) * 0.35, monoW);
      }

      tx = lerp(tx, bp.tower.pos[0], towerW);
      ty = lerp(ty, bp.tower.pos[1], towerW);
      tz = lerp(tz, bp.tower.pos[2], towerW);

      const expScale = bp.exploded.scale ?? bp.assembled.scale;
      const sxBase = lerp(bp.assembled.scale[0], expScale[0], explodeW);
      const syBase = lerp(bp.assembled.scale[1], expScale[1], explodeW);
      const szBase = lerp(bp.assembled.scale[2], expScale[2], explodeW);

      const tsx = lerp(sxBase, bp.tower.scale[0], towerW);
      const tsy = lerp(syBase, bp.tower.scale[1], towerW);
      const tsz = lerp(szBase, bp.tower.scale[2], towerW);

      const rx = lerp(0, bp.exploded.rot[0], explodeW) + (bp.shape === 'crystal' && !ctx.reducedMotion ? ctx.time * 0.45 : 0);
      const ry = lerp(0, bp.exploded.rot[1], explodeW) + modeShift + (bp.shape === 'crystal' && !ctx.reducedMotion ? ctx.time * 0.8 : 0);
      const rz = lerp(0, bp.exploded.rot[2], explodeW);

      const isFocused = state.activeSolution === bp.group;
      const targetGlow = isFocused ? 1.15 : 0.14 + explodeW * 0.15 + Math.abs(pulseWave) * 0.5;
      if (isFocused) tz += 0.35;
      tz += pulseWave * 0.25 * Math.cos(i * 0.7);

      c.pos[0] = damp(c.pos[0], tx, rate, ctx.dt);
      c.pos[1] = damp(c.pos[1], ty, rate, ctx.dt);
      c.pos[2] = damp(c.pos[2], tz, rate, ctx.dt);
      c.rot[0] = damp(c.rot[0], rx, rate, ctx.dt);
      c.rot[1] = damp(c.rot[1], ry, rate, ctx.dt);
      c.rot[2] = damp(c.rot[2], rz, rate, ctx.dt);
      c.scale[0] = damp(c.scale[0], tsx, rate, ctx.dt);
      c.scale[1] = damp(c.scale[1], tsy, rate, ctx.dt);
      c.scale[2] = damp(c.scale[2], tsz, rate, ctx.dt);
      c.glow = damp(c.glow, targetGlow, rate, ctx.dt);

      const color: [number, number, number] = isFocused ? [0.46, 0.76, 1.0] : bp.assembled.color;

      return {
        pos: [c.pos[0], c.pos[1], c.pos[2]],
        rot: [c.rot[0], c.rot[1], c.rot[2]],
        scale: [c.scale[0], c.scale[1], c.scale[2]],
        color,
        glow: c.glow,
        opacity: 1,
        shape: bp.shape ?? 'box',
      } satisfies Block3D;
    });
  };
}

// ============================================================================
// NHÓM C: Ma Trận Khối Lập Phương Đàn Hồi (Physics Voxel Matrix)
// ============================================================================
export interface VoxelState {
  modeIndex: number;
}

interface VoxelParticle {
  col: number;
  row: number;
  layer: number;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  rx: number; ry: number;
  vrx: number; vry: number;
  scale: number;
  glow: number;
}

export function createVoxelPhysicsChoreography(getState: () => VoxelState) {
  const cols = 5;
  const rows = 5;
  const layers = 2;
  const voxels: VoxelParticle[] = [];

  for (let l = 0; l < layers; l++) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        voxels.push({
          col: c, row: r, layer: l,
          x: (c - 2) * 0.72, y: (r - 2) * 0.72, z: (l - 0.5) * 0.78,
          vx: 0, vy: 0, vz: 0,
          rx: 0, ry: 0,
          vrx: 0, vry: 0,
          scale: 0.48,
          glow: 0.14,
        });
      }
    }
  }

  let prevPulseAge = 99;
  let camX = 1.9;
  let camY = 1.35;

  return (ctx: FrameContext) => {
    const { modeIndex } = getState();
    const pointerWorldX = ctx.pointer.nx * 2.1;
    const pointerWorldY = ctx.pointer.ny * 1.85;
    const justPulsed = ctx.pointer.pulseAge < prevPulseAge;
    prevPulseAge = ctx.pointer.pulseAge;

    const rate = ctx.reducedMotion ? 60 : 6;
    camX = damp(camX, 1.9 + ctx.pointer.nx * 0.9, rate, ctx.dt);
    camY = damp(camY, 1.35 + ctx.pointer.ny * 0.7, rate, ctx.dt);
    ctx.cameraEye = [camX, camY, 6.8];
    ctx.cameraTarget = [0, 0, 0];

    const stiffness = 135;
    const damping = 12;
    const dt = Math.min(ctx.dt, 0.033);

    ctx.blocks = voxels.map((v, idx) => {
      const cx = v.col - 2;
      const cy = v.row - 2;
      const cz = v.layer - 0.5;

      let tx = cx * 0.68;
      let ty = cy * 0.68;
      let tz = cz * 0.78;
      let targetScale = 0.45;
      let baseGlow = 0.14;
      let color: [number, number, number] = (v.col + v.row) % 2 === 0 ? BRAND_BLUE : ELECTRIC_BLUE;

      if (modeIndex === 0) {
        tz += (2 - Math.abs(cx)) * 0.26 - v.row * 0.08;
        if (v.row === 2 && v.col >= 1 && v.col <= 3) {
          baseGlow = 0.48;
          color = ICE_CYAN;
        }
      } else if (modeIndex === 1) {
        const arch = Math.cos(cx * 0.65) * 0.55;
        ty = cy * 0.62 + arch * 0.45;
        tz = Math.abs(cx) * 0.32 + cz * 0.72;
        if (v.col === 2) {
          color = FROST_WHITE;
          baseGlow = 0.35;
        }
      } else {
        const distCenter = Math.abs(cx) + Math.abs(cy);
        tz = (v.layer === 1 ? 0.46 : -0.46) + Math.sin(distCenter * 0.7) * 0.25;
        if (v.col === 2 && v.row === 2) {
          targetScale = 0.6;
          color = ICE_CYAN;
          baseGlow = 0.65;
        } else if (v.row === 4) {
          color = SLATE_DARK;
        }
      }

      if (!ctx.reducedMotion) {
        const wave = Math.sin(ctx.time * 2.1 + v.col * 0.55 + v.row * 0.45 + v.layer * 0.9) * 0.14;
        tz += wave;

        if (ctx.pointer.inside) {
          const dx = v.x - pointerWorldX;
          const dy = v.y - pointerWorldY;
          const dist = Math.hypot(dx, dy);
          if (dist < 1.65) {
            const strength = 1 - dist / 1.65;
            tz -= strength * 1.15;
            tx += (dx / (dist + 0.1)) * strength * 0.28;
            ty += (dy / (dist + 0.1)) * strength * 0.28;
            baseGlow += strength * 0.95;
          }
        }

        if (justPulsed) {
          const pdx = v.x - ctx.pointer.pulseOrigin[0] * 2.0;
          const pdy = v.y - ctx.pointer.pulseOrigin[1] * 1.8;
          const pdist = Math.hypot(pdx, pdy);
          const kick = Math.max(0, 1 - pdist / 3.4);
          v.vz += kick * 9.5;
          v.vrx += kick * 8.0 * (v.row % 2 === 0 ? 1 : -1);
          v.vry += kick * 8.0 * (v.col % 2 === 0 ? 1 : -1);
        }

        v.vx += ((tx - v.x) * stiffness - v.vx * damping) * dt;
        v.vy += ((ty - v.y) * stiffness - v.vy * damping) * dt;
        v.vz += ((tz - v.z) * stiffness - v.vz * damping) * dt;
        v.x += v.vx * dt;
        v.y += v.vy * dt;
        v.z += v.vz * dt;

        const targetRx = ctx.pointer.inside ? (pointerWorldY - v.y) * 0.24 : Math.sin(ctx.time + idx * 0.2) * 0.14;
        const targetRy = ctx.pointer.inside ? (v.x - pointerWorldX) * 0.24 : Math.cos(ctx.time * 0.9 + idx * 0.2) * 0.16;
        v.vrx += ((targetRx - v.rx) * 90 - v.vrx * 9) * dt;
        v.vry += ((targetRy - v.ry) * 90 - v.vry * 9) * dt;
        v.rx += v.vrx * dt;
        v.ry += v.vry * dt;
      } else {
        v.x = tx; v.y = ty; v.z = tz;
        v.rx = 0.12; v.ry = -0.18;
      }

      v.scale = damp(v.scale, targetScale, 8, ctx.dt);
      v.glow = damp(v.glow, baseGlow, 10, ctx.dt);

      return {
        pos: [v.x, v.y, v.z],
        rot: [v.rx, v.ry, 0],
        scale: [v.scale, v.scale, v.scale],
        color,
        glow: v.glow,
        opacity: 1,
        shape: 'box',
      } satisfies Block3D;
    });
  };
}

// ============================================================================
// NHÓM D: Monolith Kính & Chiều Sâu (Cinematic Depth Glass Monoliths)
// ============================================================================
export interface MonolithState {
  scrollProgress: number;
  hoveredDemo: number;
}

interface MonolithDef {
  basePos: [number, number, number];
  scale: [number, number, number];
  rotSpeed: [number, number, number];
  parallaxRate: number;
  color: [number, number, number];
  opacity: number;
  wire?: number;
  shape?: 'box' | 'crystal';
}

const MONOLITHS: MonolithDef[] = [
  // Solid obsidian/sapphire anchor slabs for strong depth contrast behind glass
  { basePos: [-2.15, -0.25, -2.0], scale: [0.98, 2.55, 0.65], rotSpeed: [0.02, 0.09, 0], parallaxRate: 0.45, color: SLATE_DARK, opacity: 1 },
  { basePos: [2.15, -0.15, -1.85], scale: [0.92, 2.25, 0.6], rotSpeed: [-0.02, -0.09, 0], parallaxRate: 0.5, color: [0.12, 0.24, 0.54], opacity: 1 },
  { basePos: [0.0, 0.1, -1.35], scale: [1.15, 2.3, 0.42], rotSpeed: [0.03, 0.11, 0.02], parallaxRate: 0.65, color: BRAND_BLUE, opacity: 1 },
  // Translucent frosted sapphire glass monoliths
  { basePos: [-1.3, 0.25, -0.25], scale: [0.9, 2.25, 0.36], rotSpeed: [0.05, 0.16, 0.03], parallaxRate: 0.85, color: ELECTRIC_BLUE, opacity: 0.64, wire: 0.28 },
  { basePos: [0.18, -0.08, 0.45], scale: [1.28, 2.65, 0.32], rotSpeed: [-0.04, 0.12, 0.04], parallaxRate: 1.05, color: ICE_CYAN, opacity: 0.52, wire: 0.35 },
  { basePos: [1.45, 0.32, 0.15], scale: [0.84, 2.05, 0.38], rotSpeed: [0.06, -0.15, 0.03], parallaxRate: 0.95, color: ELECTRIC_BLUE, opacity: 0.62, wire: 0.28 },
  // Foreground floating glass cards
  { basePos: [-0.62, -0.88, 1.1], scale: [1.05, 0.62, 0.22], rotSpeed: [0.08, 0.1, -0.04], parallaxRate: 1.32, color: FROST_WHITE, opacity: 0.72, wire: 0.24 },
  { basePos: [0.98, -0.78, 1.28], scale: [0.64, 1.02, 0.2], rotSpeed: [-0.05, -0.14, 0.05], parallaxRate: 1.4, color: ICE_CYAN, opacity: 0.68, wire: 0.28 },
  // Orbiting 3D faceted crystal prisms
  { basePos: [-0.32, 1.18, 0.85], scale: [0.46, 0.46, 0.46], rotSpeed: [0.22, 0.35, 0.14], parallaxRate: 1.48, color: ICE_CYAN, opacity: 0.92, shape: 'crystal' },
  { basePos: [0.88, 1.12, 0.15], scale: [0.38, 0.38, 0.38], rotSpeed: [-0.24, 0.24, -0.12], parallaxRate: 1.25, color: FROST_WHITE, opacity: 0.94, shape: 'crystal' },
];

export function createGlassMonolithChoreography(getState: () => MonolithState) {
  let camX = 0.65;
  let camY = 0.35;

  return (ctx: FrameContext) => {
    const state = getState();
    const rate = ctx.reducedMotion ? 60 : 5.5;
    const targetCamX = ctx.reducedMotion ? 0.65 : 0.65 + ctx.pointer.nx * 0.95;
    const targetCamY = ctx.reducedMotion ? 0.35 : 0.35 + ctx.pointer.ny * 0.65;
    camX = damp(camX, targetCamX, rate, ctx.dt);
    camY = damp(camY, targetCamY, rate, ctx.dt);

    ctx.cameraEye = [camX, camY, 7.2];
    ctx.cameraTarget = [0, 0, 0];

    const t = ctx.reducedMotion ? 0.4 : ctx.time;
    const scrollShift = (state.scrollProgress - 0.15) * 2.2;

    ctx.blocks = MONOLITHS.map((m, i) => {
      const hoverBoost = state.hoveredDemo >= 0 && i % 3 === state.hoveredDemo ? 0.45 : 0;
      const py = m.basePos[1] + scrollShift * (m.parallaxRate - 0.85) + (ctx.reducedMotion ? 0 : Math.sin(t * 0.9 + i * 1.1) * 0.12);
      const pz = m.basePos[2] + hoverBoost;

      return {
        pos: [m.basePos[0], py, pz],
        rot: [
          0.18 + t * m.rotSpeed[0],
          -0.32 + t * m.rotSpeed[1] + state.scrollProgress * 0.45 * m.parallaxRate,
          t * m.rotSpeed[2],
        ],
        scale: m.scale,
        color: m.color,
        glow: 0.36 + hoverBoost * 1.1,
        opacity: m.opacity,
        wire: m.wire,
        shape: m.shape ?? 'box',
      } satisfies Block3D;
    });
  };
}
