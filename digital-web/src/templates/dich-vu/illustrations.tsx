import type { ReactNode } from 'react';
import type { SceneKind, Tone } from './data';

const INK = '#2b2d30';
const CREAM = '#efe9dc';
const OCHRE = '#b9772e';
const CLAY = '#9c6b4f';
const SAGE = '#8d9788';
const GREY = '#b7b3aa';

interface GrainProps {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  vertical?: boolean;
}

/** Vài nét vân gỗ mảnh trên một tấm phẳng. */
function Grain({ x, y, w, h, color, vertical = false }: GrainProps) {
  const marks: ReadonlyArray<readonly [number, number, number]> = [
    [0.24, 0.08, 0.62],
    [0.52, 0.3, 0.94],
    [0.78, 0.12, 0.5],
  ];
  return (
    <g stroke={color} strokeWidth={1} opacity={0.45} strokeLinecap="round">
      {marks.map(([at, from, to]) =>
        vertical ? (
          <line key={at} x1={x + w * at} x2={x + w * at} y1={y + h * from} y2={y + h * to} />
        ) : (
          <line key={at} y1={y + h * at} y2={y + h * at} x1={x + w * from} x2={x + w * to} />
        ),
      )}
    </g>
  );
}

type Book = readonly [width: number, height: number, color: string];

/** Một hàng sách đứng, xếp từ trái sang, chân sách nằm trên đường base. */
function Books({ x, base, items }: { x: number; base: number; items: ReadonlyArray<Book> }) {
  let cursor = x;
  return (
    <g>
      {items.map(([w, h, color], index) => {
        const left = cursor;
        cursor += w + 1;
        return <rect key={index} x={left} y={base - h} width={w} height={h} fill={color} />;
      })}
    </g>
  );
}

function Kitchen({ t }: { t: Tone }) {
  const darkPanel = t.panel === '#3a3c40';
  const seam = darkPanel ? '#55585c' : '#d5d0c6';
  return (
    <>
      <rect width="400" height="300" fill={t.wall} />
      <rect y="236" width="400" height="64" fill={t.floor} />
      <rect x="44" y="236" width="312" height="6" fill="#000" opacity="0.08" />
      {/* Tủ cao */}
      <rect x="292" y="44" width="60" height="184" fill={t.wood} />
      <Grain x={292} y={44} w={60} h={76} color={t.woodDark} vertical />
      <Grain x={292} y={176} w={60} h={52} color={t.woodDark} vertical />
      <line x1="292" x2="352" y1="120" y2="120" stroke={t.woodDark} />
      <line x1="292" x2="352" y1="176" y2="176" stroke={t.woodDark} />
      <rect x="299" y="127" width="46" height="42" rx="2" fill={INK} />
      <rect x="304" y="140" width="36" height="24" rx="1" fill="#44474c" />
      <line x1="305" x2="339" y1="133" y2="133" stroke="#c9c6bf" strokeWidth="2" strokeLinecap="round" />
      {/* Tủ trên */}
      <rect x="48" y="44" width="244" height="60" fill={t.panel} />
      {[109, 170, 231].map((x) => (
        <line key={x} x1={x} x2={x} y1="44" y2="104" stroke={seam} />
      ))}
      {/* Kính ốp và bóng dưới tủ trên */}
      <rect x="48" y="104" width="244" height="56" fill={t.stone} />
      {[78, 108, 138, 168, 198, 228, 258].map((x) => (
        <line key={x} x1={x} x2={x} y1="104" y2="160" stroke="#000" opacity="0.06" />
      ))}
      <line x1="48" x2="292" y1="132" y2="132" stroke="#000" opacity="0.06" />
      <rect x="48" y="104" width="244" height="7" fill="#000" opacity="0.09" />
      {/* Đồ trên mặt bàn */}
      <rect x="124" y="146" width="24" height="12" rx="2" fill={INK} />
      <line x1="120" x2="152" y1="149" y2="149" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <rect x="118" y="157" width="44" height="3" fill={INK} />
      <path d="M206 160v-20q0-8 8-8h7" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      <rect x="250" y="138" width="6" height="22" rx="1" fill={OCHRE} />
      <rect x="259" y="145" width="9" height="15" rx="1" fill={SAGE} />
      <rect x="62" y="150" width="30" height="10" rx="1" fill={t.woodLight} />
      {/* Mặt bàn và tủ dưới */}
      <rect x="44" y="160" width="248" height="8" fill={darkPanel ? '#f1eee8' : '#dedad2'} />
      <rect x="48" y="168" width="244" height="60" fill={t.wood} />
      <Grain x={48} y={168} w={61} h={60} color={t.woodDark} />
      <Grain x={231} y={168} w={61} h={60} color={t.woodDark} />
      {[109, 170, 231].map((x) => (
        <line key={x} x1={x} x2={x} y1="168" y2="228" stroke={t.woodDark} />
      ))}
      <line x1="109" x2="170" y1="188" y2="188" stroke={t.woodDark} />
      <line x1="109" x2="170" y1="208" y2="208" stroke={t.woodDark} />
      {[68, 190, 251].map((x) => (
        <line key={x} x1={x} x2={x + 21} y1="176" y2="176" stroke={t.woodDark} strokeWidth="2" strokeLinecap="round" />
      ))}
      {[178, 198, 218].map((y) => (
        <line key={y} x1="129" x2="150" y1={y} y2={y} stroke={t.woodDark} strokeWidth="2" strokeLinecap="round" />
      ))}
      <rect x="52" y="228" width="296" height="8" fill={INK} />
    </>
  );
}

function Wardrobe({ t }: { t: Tone }) {
  return (
    <>
      <rect width="400" height="300" fill={t.wall} />
      <rect y="244" width="400" height="56" fill={t.floor} />
      <rect x="52" y="244" width="324" height="6" fill="#000" opacity="0.08" />
      <rect x="56" y="36" width="288" height="208" fill={t.woodDark} />
      {/* Hai cánh đóng */}
      <rect x="60" y="40" width="68" height="200" fill={t.wood} />
      <rect x="130" y="40" width="68" height="200" fill={t.wood} />
      <Grain x={60} y={40} w={68} h={200} color={t.woodDark} vertical />
      <Grain x={130} y={40} w={68} h={200} color={t.woodDark} vertical />
      <line x1="123" x2="123" y1="118" y2="162" stroke={t.woodLight} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="135" x2="135" y1="118" y2="162" stroke={t.woodLight} strokeWidth="2.5" strokeLinecap="round" />
      {/* Khoang mở */}
      <rect x="200" y="40" width="140" height="200" fill={t.woodLight} />
      <rect x="200" y="40" width="140" height="8" fill="#000" opacity="0.1" />
      <rect x="210" y="54" width="28" height="12" rx="1" fill={CREAM} />
      <rect x="210" y="50" width="28" height="4" rx="1" fill={GREY} />
      <rect x="246" y="52" width="30" height="14" rx="1" fill={SAGE} />
      <rect x="298" y="56" width="32" height="10" rx="1" fill={CLAY} />
      <rect x="200" y="66" width="140" height="4" fill={t.woodDark} />
      <line x1="206" x2="334" y1="80" y2="80" stroke={INK} strokeWidth="2" />
      {(
        [
          [212, 16, 72, INK],
          [231, 14, 60, CREAM],
          [248, 16, 82, OCHRE],
          [267, 14, 56, SAGE],
          [284, 16, 68, '#f7f4ee'],
          [303, 14, 78, '#55585c'],
          [320, 12, 58, CLAY],
        ] as const
      ).map(([x, w, h, color]) => (
        <rect key={x} x={x} y="82" width={w} height={h} rx="2" fill={color} />
      ))}
      <rect x="200" y="180" width="140" height="4" fill={t.woodDark} />
      <rect x="200" y="184" width="140" height="56" fill={t.wood} />
      <line x1="200" x2="340" y1="203" y2="203" stroke={t.woodDark} />
      <line x1="200" x2="340" y1="222" y2="222" stroke={t.woodDark} />
      {[193, 212, 231].map((y) => (
        <line key={y} x1="258" x2="282" y1={y} y2={y} stroke={t.woodLight} strokeWidth="2" strokeLinecap="round" />
      ))}
      {/* Cánh đang mở */}
      <polygon points="340,40 372,50 372,250 340,240" fill={t.woodDark} />
      <polygon points="340,40 372,50 372,250 340,240" fill="#000" opacity="0.12" />
    </>
  );
}

function Shelf({ t }: { t: Tone }) {
  const cols = [52, 128, 204, 280];
  const rows: ReadonlyArray<readonly [number, number]> = [
    [40, 52],
    [96, 52],
    [152, 44],
  ];
  return (
    <>
      <rect width="400" height="300" fill={t.wall} />
      <rect y="244" width="400" height="56" fill={t.floor} />
      <rect x="44" y="244" width="312" height="6" fill="#000" opacity="0.08" />
      <rect x="48" y="36" width="304" height="208" fill={t.wood} />
      {rows.map(([y, h]) =>
        cols.map((x) => (
          <g key={`${x}-${y}`}>
            <rect x={x} y={y} width="68" height={h} fill={t.woodLight} />
            <rect x={x} y={y} width="68" height="6" fill="#000" opacity="0.08" />
          </g>
        )),
      )}
      <Books x={56} base={92} items={[[6, 38, INK], [5, 32, CREAM], [7, 40, OCHRE], [5, 34, GREY], [6, 30, SAGE], [8, 36, INK]]} />
      <Books x={132} base={92} items={[[7, 30, CLAY], [5, 36, CREAM], [6, 28, INK]]} />
      <rect x="170" y="80" width="22" height="12" rx="1" fill={GREY} />
      <rect x="170" y="74" width="22" height="6" rx="1" fill={CREAM} />
      <rect x="216" y="52" width="44" height="34" fill={CREAM} />
      <circle cx="238" cy="69" r="9" fill={OCHRE} />
      <rect x="216" y="86" width="44" height="6" fill={t.woodDark} opacity="0.5" />
      <Books x={284} base={92} items={[[6, 34, SAGE], [6, 40, INK], [5, 30, CREAM], [7, 36, CLAY], [5, 32, GREY]]} />
      <path d="M72 148q-2-22 10-30q12 8 10 30z" fill={INK} />
      <path d="M82 118q-10-16-2-20M82 118q10-12 6-22M82 118q0-14 0-24" fill="none" stroke={SAGE} strokeWidth="2.5" strokeLinecap="round" />
      <Books x={132} base={148} items={[[6, 36, INK], [6, 40, OCHRE], [5, 32, CREAM], [7, 38, GREY], [6, 30, INK], [5, 36, SAGE], [7, 34, CREAM]]} />
      <Books x={208} base={148} items={[[7, 38, CREAM], [5, 30, CLAY], [6, 36, INK], [6, 28, GREY]]} />
      <rect x="244" y="138" width="20" height="10" rx="1" fill={OCHRE} />
      <rect x="290" y="126" width="18" height="22" rx="9" fill={CREAM} />
      <rect x="316" y="112" width="24" height="36" fill={INK} />
      <rect x="320" y="116" width="16" height="28" fill={t.woodLight} />
      <Books x={56} base={196} items={[[8, 30, CLAY], [6, 34, INK], [6, 26, CREAM]]} />
      <rect x="86" y="184" width="26" height="12" rx="1" fill={SAGE} />
      <rect x="140" y="176" width="44" height="20" rx="2" fill={INK} />
      <circle cx="152" cy="186" r="5" fill="#55585c" />
      <circle cx="172" cy="186" r="5" fill="#55585c" />
      <Books x={208} base={196} items={[[6, 32, GREY], [7, 36, OCHRE], [5, 28, INK], [6, 34, CREAM], [6, 30, SAGE], [7, 36, INK]]} />
      <rect x="292" y="182" width="44" height="14" rx="7" fill={CREAM} />
      {/* Tủ đáy có cánh */}
      {cols.map((x) => (
        <g key={x}>
          <rect x={x} y="200" width="68" height="40" fill={t.woodDark} />
          <Grain x={x} y={200} w={68} h={40} color={t.wood} />
        </g>
      ))}
    </>
  );
}

function Dining({ t }: { t: Tone }) {
  return (
    <>
      <rect width="400" height="300" fill={t.wall} />
      <rect y="222" width="400" height="78" fill={t.floor} />
      {/* Cửa sổ */}
      <rect x="52" y="36" width="150" height="124" fill="#f7f6f1" />
      <rect x="52" y="36" width="150" height="124" fill="none" stroke={INK} strokeWidth="2" />
      <line x1="127" x2="127" y1="36" y2="160" stroke={INK} strokeWidth="2" />
      <polygon points="60,222 190,222 250,300 80,300" fill="#fff" opacity="0.22" />
      {/* Tranh */}
      <rect x="268" y="56" width="72" height="92" fill={t.woodLight} />
      <rect x="276" y="64" width="56" height="76" fill={CREAM} />
      <circle cx="304" cy="96" r="16" fill={OCHRE} />
      <rect x="284" y="116" width="40" height="14" fill={INK} />
      {/* Đèn thả */}
      <line x1="200" x2="200" y1="0" y2="72" stroke={INK} strokeWidth="1.5" />
      <polygon points="188,72 212,72 224,98 176,98" fill={INK} />
      <ellipse cx="200" cy="262" rx="160" ry="14" fill="#000" opacity="0.07" />
      {/* Ghế phía sau */}
      <rect x="126" y="130" width="42" height="40" rx="4" fill={t.woodDark} />
      <rect x="232" y="130" width="42" height="40" rx="4" fill={t.woodDark} />
      {/* Ghế hai đầu */}
      <g fill={t.woodDark}>
        <rect x="46" y="136" width="6" height="118" rx="2" />
        <rect x="46" y="194" width="42" height="7" rx="2" />
        <rect x="82" y="198" width="5" height="56" rx="2" />
        <rect x="348" y="136" width="6" height="118" rx="2" />
        <rect x="312" y="194" width="42" height="7" rx="2" />
        <rect x="313" y="198" width="5" height="56" rx="2" />
      </g>
      {/* Bàn */}
      <path d="M178 154h44q-4 12-22 12t-22-12z" fill={t.stone} />
      <rect x="244" y="142" width="10" height="24" rx="2" fill={INK} />
      <path d="M249 142q-6-14-2-22M249 142q8-10 6-20" fill="none" stroke={SAGE} strokeWidth="2.5" strokeLinecap="round" />
      <rect x="84" y="166" width="232" height="11" rx="2" fill={t.wood} />
      <Grain x={84} y={166} w={232} h={11} color={t.woodLight} />
      <rect x="104" y="177" width="192" height="6" fill={t.woodDark} />
      <polygon points="100,177 113,177 108,256 100,256" fill={t.wood} />
      <polygon points="300,177 287,177 292,256 300,256" fill={t.wood} />
    </>
  );
}

function Bedroom({ t }: { t: Tone }) {
  const slats: number[] = [];
  for (let x = 56; x < 360; x += 16) slats.push(x);
  return (
    <>
      <rect width="400" height="300" fill={t.wall} />
      <rect y="236" width="400" height="64" fill={t.floor} />
      {/* Vách đầu giường */}
      <rect x="40" y="62" width="320" height="130" fill={t.wood} />
      {slats.map((x) => (
        <line key={x} x1={x} x2={x} y1="62" y2="192" stroke={t.woodDark} opacity="0.55" />
      ))}
      <rect x="40" y="62" width="320" height="5" fill={t.woodLight} />
      {/* Tab treo */}
      <rect x="44" y="180" width="56" height="12" fill={t.woodDark} />
      <rect x="300" y="180" width="56" height="12" fill={t.woodDark} />
      <rect x="68" y="160" width="4" height="20" fill={INK} />
      <circle cx="70" cy="152" r="11" fill="#f6ecd4" />
      <rect x="312" y="172" width="30" height="4" fill={CREAM} />
      <rect x="314" y="176" width="26" height="4" fill={OCHRE} />
      <rect x="320" y="158" width="10" height="14" rx="2" fill={INK} />
      {/* Giường */}
      <ellipse cx="200" cy="244" rx="150" ry="9" fill="#000" opacity="0.08" />
      <rect x="112" y="150" width="80" height="30" rx="9" fill="#fbf9f4" />
      <rect x="208" y="150" width="80" height="30" rx="9" fill="#fbf9f4" />
      <rect x="100" y="172" width="200" height="40" rx="7" fill="#f1ece2" />
      <rect x="100" y="188" width="200" height="26" rx="4" fill={t.textile} />
      <rect x="100" y="188" width="200" height="7" rx="3" fill="#fbf9f4" opacity="0.85" />
      <rect x="94" y="210" width="212" height="22" fill={t.woodDark} />
      <Grain x={94} y={210} w={212} h={22} color={t.wood} />
      <rect x="102" y="232" width="8" height="8" fill={INK} />
      <rect x="290" y="232" width="8" height="8" fill={INK} />
    </>
  );
}

const sceneMap: Record<SceneKind, (props: { t: Tone }) => ReactNode> = {
  kitchen: Kitchen,
  wardrobe: Wardrobe,
  shelf: Shelf,
  dining: Dining,
  bedroom: Bedroom,
};

interface SceneProps {
  kind: SceneKind;
  tone: Tone;
  /** Có mô tả thì ảnh được đọc như hình; không có thì coi là trang trí. */
  label?: string;
  className?: string;
}

export function Scene({ kind, tone, label, className }: SceneProps) {
  const Draw = sceneMap[kind];
  return (
    <svg
      className={className}
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <Draw t={tone} />
    </svg>
  );
}

/** Minh họa lớn ở hero: mảng tường âm kín với kệ, tủ và góc làm việc. */
export function HeroScene({ className }: { className?: string }) {
  const wood = '#c9a473';
  const woodDark = '#a5804e';
  const woodLight = '#e4cfab';
  const shelfCols = [556, 672, 788];
  const shelfRows = [118, 240, 362];
  return (
    <svg
      className={className}
      viewBox="0 0 1200 900"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="Hình minh họa: mảng tường gỗ sồi đóng kín từ sàn tới trần, gồm tủ cao, kệ sách và góc làm việc."
      focusable="false"
    >
      <rect width="1200" height="900" fill="#e9e5dc" />
      <rect y="660" width="1200" height="240" fill="#d2c4ad" />
      {[720, 790, 870].map((y) => (
        <line key={y} x1="0" x2="1200" y1={y} y2={y} stroke="#000" opacity="0.05" />
      ))}
      {/* Cửa sổ */}
      <rect x="60" y="120" width="240" height="540" fill="#f8f7f2" />
      <rect x="60" y="120" width="240" height="540" fill="none" stroke={INK} strokeWidth="3" />
      <line x1="180" x2="180" y1="120" y2="660" stroke={INK} strokeWidth="3" />
      <line x1="60" x2="300" y1="300" y2="300" stroke={INK} strokeWidth="2" />
      <polygon points="70,660 300,660 520,900 150,900" fill="#fff" opacity="0.25" />
      {/* Đường kích thước */}
      <g stroke="#6b6d70" strokeWidth="1.5">
        <line x1="380" x2="1140" y1="76" y2="76" />
        <line x1="380" x2="380" y1="66" y2="86" />
        <line x1="1140" x2="1140" y1="66" y2="86" />
        <line x1="1168" x2="1168" y1="110" y2="660" />
        <line x1="1158" x2="1178" y1="110" y2="110" />
        <line x1="1158" x2="1178" y1="660" y2="660" />
      </g>
      <text x="760" y="60" textAnchor="middle" fontSize="20" fill="#55575a" letterSpacing="1">
        3 600
      </text>
      <text x="1150" y="392" textAnchor="middle" fontSize="20" fill="#55575a" letterSpacing="1" transform="rotate(-90 1150 392)">
        2 600
      </text>
      {/* Khối tủ âm tường */}
      <rect x="372" y="110" width="776" height="556" fill="#000" opacity="0.06" />
      <rect x="380" y="110" width="760" height="550" fill={woodDark} />
      {/* Tủ cao bên trái */}
      <rect x="388" y="118" width="78" height="534" fill={wood} />
      <rect x="470" y="118" width="78" height="534" fill={wood} />
      <Grain x={388} y={118} w={78} h={534} color={woodDark} vertical />
      <Grain x={470} y={118} w={78} h={534} color={woodDark} vertical />
      <line x1="460" x2="460" y1="340" y2="430" stroke={woodLight} strokeWidth="4" strokeLinecap="round" />
      <line x1="476" x2="476" y1="340" y2="430" stroke={woodLight} strokeWidth="4" strokeLinecap="round" />
      {/* Kệ hở giữa */}
      {shelfRows.map((y) =>
        shelfCols.map((x) => (
          <g key={`${x}-${y}`}>
            <rect x={x} y={y} width="108" height="114" fill={woodLight} />
            <rect x={x} y={y} width="108" height="10" fill="#000" opacity="0.08" />
          </g>
        )),
      )}
      <Books x={564} base={232} items={[[12, 78, INK], [10, 66, CREAM], [14, 84, OCHRE], [10, 70, GREY], [12, 60, SAGE], [14, 76, INK]]} />
      <rect x="690" y="150" width="72" height="72" fill={CREAM} />
      <circle cx="726" cy="186" r="20" fill={OCHRE} />
      <rect x="690" y="222" width="72" height="10" fill={woodDark} opacity="0.5" />
      <Books x={796} base={232} items={[[12, 70, SAGE], [12, 82, INK], [10, 62, CREAM], [14, 74, CLAY]]} />
      <rect x="856" y="208" width="34" height="24" rx="2" fill={GREY} />
      <path d="M596 354q-4-44 18-58q22 14 18 58z" fill={INK} />
      <path d="M614 296q-18-28-4-40M614 296q20-22 12-44M614 296q0-26 0-50" fill="none" stroke={SAGE} strokeWidth="4" strokeLinecap="round" />
      <Books x={680} base={354} items={[[12, 74, INK], [12, 84, OCHRE], [10, 66, CREAM], [14, 78, GREY], [12, 62, INK], [10, 74, SAGE], [12, 70, CREAM]]} />
      <Books x={796} base={354} items={[[14, 78, CREAM], [10, 62, CLAY], [12, 74, INK]]} />
      <rect x="846" y="318" width="40" height="36" rx="18" fill={CREAM} />
      <Books x={564} base={476} items={[[14, 64, CLAY], [12, 72, INK], [12, 56, CREAM]]} />
      <rect x="612" y="450" width="50" height="26" rx="2" fill={SAGE} />
      <rect x="686" y="430" width="80" height="46" rx="4" fill={INK} />
      <circle cx="708" cy="453" r="11" fill="#55585c" />
      <circle cx="744" cy="453" r="11" fill="#55585c" />
      <Books x={796} base={476} items={[[12, 68, GREY], [14, 76, OCHRE], [10, 58, INK], [12, 70, CREAM], [12, 64, SAGE], [14, 76, INK]]} />
      {shelfCols.map((x) => (
        <g key={x}>
          <rect x={x} y="484" width="108" height="168" fill={wood} />
          <Grain x={x} y={484} w={108} h={168} color={woodDark} vertical />
          <line x1={x + 34} x2={x + 74} y1="500" y2="500" stroke={woodLight} strokeWidth="4" strokeLinecap="round" />
        </g>
      ))}
      {/* Góc làm việc bên phải */}
      <rect x="908" y="118" width="110" height="132" fill="#3a3c40" />
      <rect x="1022" y="118" width="110" height="132" fill="#3a3c40" />
      <rect x="908" y="258" width="224" height="212" fill={woodLight} />
      <rect x="908" y="258" width="224" height="12" fill="#000" opacity="0.1" />
      <rect x="908" y="258" width="224" height="4" fill="#fff6dc" />
      <rect x="930" y="352" width="120" height="8" fill={woodDark} />
      <Books x={936} base={352} items={[[10, 50, INK], [10, 44, CREAM], [12, 54, OCHRE]]} />
      <rect x="1000" y="328" width="34" height="24" rx="2" fill={SAGE} />
      <rect x="1052" y="388" width="60" height="70" rx="3" fill={INK} />
      <rect x="1058" y="394" width="48" height="52" fill="#55585c" />
      <rect x="1074" y="458" width="16" height="12" fill={INK} />
      <path d="M950 470v-50q0-16 16-16h14" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <polygon points="974,396 1002,396 1010,418 966,418" fill={OCHRE} />
      <rect x="900" y="470" width="240" height="14" fill={wood} />
      <rect x="908" y="484" width="100" height="168" fill={wood} />
      <line x1="908" x2="1008" y1="540" y2="540" stroke={woodDark} />
      <line x1="908" x2="1008" y1="596" y2="596" stroke={woodDark} />
      {[512, 568, 624].map((y) => (
        <line key={y} x1="940" x2="976" y1={y} y2={y} stroke={woodLight} strokeWidth="4" strokeLinecap="round" />
      ))}
      <rect x="1012" y="484" width="120" height="168" fill="#8f6e42" />
      {/* Ghế làm việc */}
      <rect x="1040" y="520" width="74" height="66" rx="10" fill={INK} />
      <rect x="1034" y="592" width="86" height="16" rx="6" fill={INK} />
      <line x1="1046" x2="1040" y1="608" y2="672" stroke={wood} strokeWidth="7" strokeLinecap="round" />
      <line x1="1108" x2="1114" y1="608" y2="672" stroke={wood} strokeWidth="7" strokeLinecap="round" />
      <rect x="380" y="652" width="760" height="8" fill={INK} />
      {/* Thảm, ghế thư giãn, đèn cây */}
      <ellipse cx="400" cy="822" rx="360" ry="40" fill="#b3a68f" opacity="0.55" />
      <ellipse cx="96" cy="806" rx="38" ry="8" fill={INK} />
      <path d="M96 804V470q0-62 62-62h40" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" />
      <polygon points="180,408 232,408 248,462 164,462" fill="#f6ecd4" />
      <rect x="196" y="590" width="50" height="150" rx="16" fill="#3a3c40" />
      <rect x="206" y="700" width="190" height="44" rx="14" fill="#44474c" />
      <rect x="200" y="676" width="200" height="12" rx="6" fill={wood} />
      <line x1="224" x2="212" y1="744" y2="812" stroke={wood} strokeWidth="9" strokeLinecap="round" />
      <line x1="380" x2="392" y1="744" y2="812" stroke={wood} strokeWidth="9" strokeLinecap="round" />
      <ellipse cx="490" cy="740" rx="50" ry="10" fill={wood} />
      <line x1="490" x2="490" y1="746" y2="816" stroke={INK} strokeWidth="5" />
      <ellipse cx="490" cy="818" rx="26" ry="5" fill={INK} />
      <rect x="474" y="712" width="22" height="24" rx="3" fill={CREAM} />
    </svg>
  );
}

/** Dấu hiệu chim én gấp bằng hai nét. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M3 9l13 6 13-9-8 14-5-3-5 9z" fill="currentColor" />
    </svg>
  );
}
