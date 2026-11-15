import { useId, useMemo } from 'react';
import { glazes, type GlazeId, type ShapeId } from './data';

/** Mọi hình trong bản mẫu đều vẽ bằng SVG tại chỗ, không tải ảnh ngoài. */

const RAW_CLAY = '#c9a17d';

interface VesselDef {
  body: string;
  /** cx, cy, rx, ry của miệng. */
  rim: [number, number, number, number];
  foot?: string;
  handle?: string;
  dipY: number;
  /** cx, cy, rx, ry của vệt sáng. */
  light: [number, number, number, number];
  shadowRx: number;
}

type VesselShape = Exclude<ShapeId, 'plate' | 'plateSmall'>;

const vessels: Record<VesselShape, VesselDef> = {
  bowl: {
    body: 'M70 170 C72 262 138 312 200 312 C262 312 328 262 330 170 Z',
    rim: [200, 170, 130, 24],
    foot: 'M162 304 h76 l-6 22 h-64 Z',
    dipY: 268,
    light: [118, 232, 12, 44],
    shadowRx: 124,
  },
  bowlWide: {
    body: 'M48 190 C56 268 132 308 200 308 C268 308 344 268 352 190 Z',
    rim: [200, 190, 152, 26],
    foot: 'M158 300 h84 l-6 24 h-72 Z',
    dipY: 276,
    light: [104, 240, 12, 34],
    shadowRx: 140,
  },
  bowlSmall: {
    body: 'M110 215 C112 275 158 308 200 308 C242 308 288 275 290 215 Z',
    rim: [200, 215, 90, 17],
    foot: 'M172 302 h56 l-5 20 h-46 Z',
    dipY: 280,
    light: [142, 256, 9, 28],
    shadowRx: 92,
  },
  cup: {
    body: 'M128 160 C126 230 138 300 168 312 L232 312 C262 300 274 230 272 160 Z',
    rim: [200, 160, 72, 15],
    foot: 'M170 308 h60 l-4 16 h-52 Z',
    dipY: 276,
    light: [150, 232, 9, 52],
    shadowRx: 84,
  },
  mug: {
    body: 'M118 140 L124 296 Q126 322 150 322 L238 322 Q262 322 264 296 L270 140 Z',
    rim: [194, 140, 76, 15],
    handle: 'M264 180 C326 172 330 268 262 266',
    dipY: 284,
    light: [142, 228, 9, 64],
    shadowRx: 104,
  },
  tumbler: {
    body: 'M136 110 L146 302 Q148 322 168 322 L232 322 Q252 322 254 302 L264 110 Z',
    rim: [200, 110, 64, 13],
    dipY: 262,
    light: [158, 212, 8, 78],
    shadowRx: 78,
  },
  vaseNeck: {
    body: 'M178 86 C180 140 112 168 112 242 C112 298 156 326 200 326 C244 326 288 298 288 242 C288 168 220 140 222 86 Z',
    rim: [200, 86, 22, 6],
    dipY: 290,
    light: [140, 240, 10, 42],
    shadowRx: 104,
  },
  vaseRound: {
    body: 'M170 120 C150 130 96 170 96 232 C96 294 150 326 200 326 C250 326 304 294 304 232 C304 170 250 130 230 120 Z',
    rim: [200, 120, 30, 8],
    dipY: 288,
    light: [128, 226, 11, 44],
    shadowRx: 116,
  },
};

const plates: Record<'plate' | 'plateSmall', number> = { plate: 150, plateSmall: 112 };

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Speck {
  x: number;
  y: number;
  r: number;
  o: number;
}

function useSpecks(seed: number, count: number): Speck[] {
  return useMemo(() => {
    const rand = mulberry(seed);
    return Array.from({ length: count }, () => ({
      x: 40 + rand() * 320,
      y: 60 + rand() * 280,
      r: 0.7 + rand() * 1.9,
      o: 0.25 + rand() * 0.5,
    }));
  }, [seed, count]);
}

const safeId = (id: string): string => `ml${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;

interface PotProps {
  shape: ShapeId;
  glaze: GlazeId;
  dip?: boolean;
  seed?: number;
  stems?: boolean;
}

/** Một món gốm trong hệ tọa độ 400×400, mặt bàn ở y ≈ 326. */
export function Pot({ shape, glaze, dip = false, seed = 7, stems = false }: PotProps) {
  const uid = safeId(useId());
  const g = glazes[glaze];
  const specks = useSpecks(seed, 46);
  const shade = (
    <linearGradient id={`${uid}s`} gradientUnits="userSpaceOnUse" x1="50" y1="0" x2="350" y2="0">
      <stop offset="0" stopColor="#fff" stopOpacity="0.3" />
      <stop offset="0.42" stopColor="#fff" stopOpacity="0" />
      <stop offset="1" stopColor="#1d120a" stopOpacity="0.3" />
    </linearGradient>
  );
  const dots = specks.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={g.speck} opacity={s.o} />);

  if (shape === 'plate' || shape === 'plateSmall') {
    const r = plates[shape];
    return (
      <g>
        <defs>
          {shade}
          <clipPath id={`${uid}c`}>
            <circle cx="200" cy="200" r={r} />
          </clipPath>
        </defs>
        <ellipse cx="208" cy="214" rx={r + 2} ry={r - 2} fill="#3b2a1c" opacity="0.18" />
        <g clipPath={`url(#${uid}c)`}>
          <rect width="400" height="400" fill={g.body} />
          {dots}
          <rect width="400" height="400" fill={`url(#${uid}s)`} />
        </g>
        <circle cx="200" cy="200" r={r - 3} fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" />
        <circle cx="200" cy="200" r={r * 0.68} fill={g.inner} opacity="0.4" />
        <circle cx="200" cy="200" r={r * 0.68} fill="none" stroke="#1d120a" strokeOpacity="0.14" strokeWidth="2" />
        <path
          d={`M${200 - r * 0.5} ${200 - r * 0.24} A${r * 0.56} ${r * 0.56} 0 0 1 ${200 - r * 0.1} ${200 - r * 0.55}`}
          fill="none"
          stroke="#fff"
          strokeOpacity="0.45"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </g>
    );
  }

  const v = vessels[shape];
  const [rcx, rcy, rrx, rry] = v.rim;
  const [lx, ly, lrx, lry] = v.light;
  const d = v.dipY;
  return (
    <g>
      <defs>
        {shade}
        <clipPath id={`${uid}c`}>
          <path d={v.body} />
        </clipPath>
      </defs>
      <ellipse cx="204" cy="328" rx={v.shadowRx} ry="11" fill="#3b2a1c" opacity="0.18" />
      {v.handle && (
        <>
          <path d={v.handle} fill="none" stroke={g.inner} strokeWidth="20" strokeLinecap="round" />
          <path d={v.handle} fill="none" stroke="#1d120a" strokeOpacity="0.16" strokeWidth="20" strokeLinecap="round" />
        </>
      )}
      {v.foot && <path d={v.foot} fill={RAW_CLAY} />}
      {v.foot && <path d={v.foot} fill="#1d120a" opacity="0.12" />}
      <g clipPath={`url(#${uid}c)`}>
        <rect width="400" height="400" fill={g.body} />
        {dots}
        {dip && (
          <path
            d={`M0 ${d} C90 ${d + 16} 150 ${d - 12} 205 ${d + 5} S330 ${d + 14} 400 ${d - 8} V400 H0 Z`}
            fill={RAW_CLAY}
          />
        )}
        <rect width="400" height="400" fill={`url(#${uid}s)`} />
        <ellipse cx={lx} cy={ly} rx={lrx} ry={lry} fill="#fff" opacity="0.22" transform={`rotate(8 ${lx} ${ly})`} />
      </g>
      <ellipse cx={rcx} cy={rcy} rx={rrx} ry={rry} fill={g.inner} />
      <ellipse cx={rcx + rrx * 0.08} cy={rcy + rry * 0.2} rx={rrx * 0.84} ry={rry * 0.7} fill="#1d120a" opacity="0.2" />
      {stems && (
        <g fill="none" stroke="#5c4a36" strokeWidth="3" strokeLinecap="round">
          <path d={`M${rcx} ${rcy} C${rcx - 6} ${rcy - 70} ${rcx - 44} ${rcy - 120} ${rcx - 60} ${rcy - 196}`} />
          <path d={`M${rcx + 2} ${rcy} C${rcx + 10} ${rcy - 60} ${rcx + 40} ${rcy - 96} ${rcx + 62} ${rcy - 150}`} />
          <path d={`M${rcx - 30} ${rcy - 108} C${rcx - 52} ${rcy - 120} ${rcx - 70} ${rcy - 122} ${rcx - 92} ${rcy - 140}`} />
          <path d={`M${rcx + 30} ${rcy - 82} C${rcx + 54} ${rcy - 84} ${rcx + 76} ${rcy - 78} ${rcx + 98} ${rcy - 92}`} />
          <g stroke="none" fill="#b5603c">
            <circle cx={rcx - 60} cy={rcy - 200} r="8" />
            <circle cx={rcx - 96} cy={rcy - 143} r="7" />
            <circle cx={rcx + 64} cy={rcy - 155} r="8" />
            <circle cx={rcx + 102} cy={rcy - 95} r="6" />
            <circle cx={rcx - 40} cy={rcy - 150} r="5" />
            <circle cx={rcx + 46} cy={rcy - 118} r="5" />
          </g>
        </g>
      )}
      <ellipse cx={rcx} cy={rcy} rx={rrx} ry={rry} fill="none" stroke={g.body} strokeWidth="5" />
      <ellipse cx={rcx} cy={rcy} rx={rrx} ry={rry} fill="none" stroke="#fff" strokeOpacity="0.3" strokeWidth="1.5" />
    </g>
  );
}

interface ProductArtProps {
  shape: ShapeId;
  glaze: GlazeId;
  dip?: boolean;
  seed: number;
}

/** Ảnh sản phẩm. Nền ô do CSS của khung chứa đặt. */
export function ProductArt(props: ProductArtProps) {
  return (
    <svg className="ml-art" viewBox="0 0 400 400" aria-hidden="true" focusable="false">
      <Pot {...props} />
    </svg>
  );
}

/** Tĩnh vật ở phần đầu trang. Phần bên trái để trống cho tiêu đề chồng lên. */
export function HeroArt() {
  return (
    <svg className="ml-hero-svg" viewBox="0 0 720 720" aria-hidden="true" focusable="false">
      <rect width="720" height="720" rx="28" fill="#ebe1d0" />
      <path d="M292 720 V338 A194 194 0 0 1 680 338 V720 Z" fill="#cfdccb" />
      <circle className="ml-hero-sun" cx="262" cy="168" r="52" fill="#d08a62" />
      <path d="M0 612 H720 V692 A28 28 0 0 1 692 720 H28 A28 28 0 0 1 0 692 Z" fill="#dccbb2" />
      <path d="M0 612 H720" stroke="#bfa98b" strokeWidth="2" />
      <g className="ml-hero-pot ml-hero-pot--a" transform="translate(350 250) scale(1.1)">
        <Pot shape="vaseNeck" glaze="lam" seed={5} stems />
      </g>
      <g className="ml-hero-pot ml-hero-pot--b" transform="translate(150 340) scale(0.82)">
        <Pot shape="bowl" glaze="nga" dip seed={9} />
      </g>
      <g className="ml-hero-pot ml-hero-pot--c" transform="translate(392 452) scale(0.52)">
        <Pot shape="cup" glaze="datNung" seed={14} />
      </g>
    </svg>
  );
}

/** Minh họa ba bước làm gốm. */
export function StepArt({ step }: { step: 1 | 2 | 3 }) {
  const uid = safeId(useId());
  if (step === 1) {
    return (
      <svg className="ml-art" viewBox="0 0 320 320" aria-hidden="true" focusable="false">
        <ellipse cx="160" cy="262" rx="124" ry="24" fill="#8f7a60" />
        <ellipse cx="160" cy="252" rx="124" ry="24" fill="#b9a58a" />
        <ellipse cx="160" cy="252" rx="92" ry="17" fill="none" stroke="#8f7a60" strokeWidth="2" strokeDasharray="10 14" />
        <ellipse cx="160" cy="252" rx="58" ry="10" fill="none" stroke="#8f7a60" strokeWidth="2" strokeDasharray="6 12" />
        <g transform="translate(60 86) scale(0.5)">
          <Pot shape="cup" glaze="datNung" seed={3} />
        </g>
        <path d="M52 120 q-14 30 0 60 M268 120 q14 30 0 60" fill="none" stroke="#8f7a60" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  if (step === 2) {
    return (
      <svg className="ml-art" viewBox="0 0 320 320" aria-hidden="true" focusable="false">
        <g transform="translate(40 70) scale(0.6)">
          <Pot shape="bowl" glaze="lam" dip seed={21} />
        </g>
        <g fill="#7fa491">
          <path d="M160 36 c10 16 14 24 14 32 a14 14 0 0 1 -28 0 c0 -8 4 -16 14 -32 Z" />
          <path d="M112 70 c7 11 10 17 10 22 a10 10 0 0 1 -20 0 c0 -5 3 -11 10 -22 Z" opacity="0.8" />
          <path d="M210 62 c7 11 10 17 10 22 a10 10 0 0 1 -20 0 c0 -5 3 -11 10 -22 Z" opacity="0.8" />
        </g>
      </svg>
    );
  }
  return (
    <svg className="ml-art" viewBox="0 0 320 320" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${uid}g`} cx="0.5" cy="0.9" r="0.9">
          <stop offset="0" stopColor="#f6c56b" />
          <stop offset="0.5" stopColor="#d9743a" />
          <stop offset="1" stopColor="#3a2418" />
        </radialGradient>
      </defs>
      <path d="M48 286 V160 A112 112 0 0 1 272 160 V286 Z" fill="#a9623f" />
      <g stroke="#8a4a2c" strokeWidth="2" fill="none">
        <path d="M48 250 H272 M48 214 H272 M50 178 H270 M62 142 H258 M86 106 H234" />
        <path d="M90 250 V286 M230 250 V286 M70 214 V250 M250 214 V250 M92 178 V214 M228 178 V214 M76 142 V178 M244 142 V178 M120 106 V142 M200 106 V142 M160 50 V106" />
      </g>
      <path d="M100 286 V176 A60 60 0 0 1 220 176 V286 Z" fill={`url(#${uid}g)`} />
      <g fill="#2a1a10" opacity="0.78">
        <path d="M118 286 c0 -34 6 -46 20 -46 s20 12 20 46 Z" />
        <path d="M166 286 v-30 q0 -8 8 -8 h14 q8 0 8 8 v30 Z" />
      </g>
      <rect x="32" y="286" width="256" height="12" rx="4" fill="#8f7a60" />
    </svg>
  );
}
