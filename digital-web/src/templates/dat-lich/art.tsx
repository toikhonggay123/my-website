/** Hình minh họa và biểu tượng vẽ bằng SVG nội tuyến. Tất cả đều trang trí (aria-hidden). */
import { useId } from 'react';

interface IconProps {
  size?: number;
}

const base = { 'aria-hidden': true, focusable: false } as const;

/** Mặt đồng hồ chỉ đúng chín giờ: biểu tượng của tiệm. */
export function ClockMark({ size = 36 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="19" fill="#c9f73b" />
      <path d="M20 9v11H10" fill="none" stroke="#160d33" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="20" cy="20" r="2.4" fill="#160d33" />
    </svg>
  );
}

export function ArrowIcon({ size = 20 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function BackIcon({ size = 20 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

export function CheckIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function PlusIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function TimeIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg {...base} width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
    </svg>
  );
}

/** Cây kéo lớn, dùng làm hình nền trang trí. */
export function ScissorsArt({ className }: { className?: string }) {
  return (
    <svg {...base} className={className} viewBox="0 0 220 220" fill="none">
      <path d="M78 132 190 44l8 14L92 144z" fill="currentColor" />
      <path d="M78 88l112 88 8-14L92 76z" fill="currentColor" opacity=".72" />
      <circle cx="54" cy="158" r="27" stroke="currentColor" strokeWidth="13" />
      <circle cx="54" cy="62" r="27" stroke="currentColor" strokeWidth="13" />
      <circle cx="122" cy="110" r="7" fill="#c9f73b" />
    </svg>
  );
}

/** Chiếc lược: dải răng đều nhau. */
export function CombArt({ className }: { className?: string }) {
  const teeth = Array.from({ length: 15 }, (_, i) => i);
  return (
    <svg {...base} className={className} viewBox="0 0 240 90" fill="currentColor">
      <rect x="0" y="0" width="240" height="30" rx="15" />
      {teeth.map((i) => (
        <rect key={i} x={10 + i * 15} y="24" width="7" height={i < 8 ? 62 : 44} rx="3.5" />
      ))}
    </svg>
  );
}

/** Lọn tóc uốn: vài đường sóng. */
export function WaveArt({ className }: { className?: string }) {
  return (
    <svg {...base} className={className} viewBox="0 0 200 120" fill="none" stroke="currentColor" strokeWidth="12" strokeLinecap="round">
      <path d="M10 26c22-22 38 22 60 0s38 22 60 0 38 22 60 0" />
      <path d="M10 62c22-22 38 22 60 0s38 22 60 0 38 22 60 0" opacity=".7" />
      <path d="M10 98c22-22 38 22 60 0s38 22 60 0 38 22 60 0" opacity=".45" />
    </svg>
  );
}

interface Palette {
  bg: string;
  skin: string;
  shade: string;
  hair: string;
  shirt: string;
}

const PALETTES: Palette[] = [
  { bg: '#c9f73b', skin: '#f2c9a5', shade: '#dba983', hair: '#2a1470', shirt: '#5b2ee6' },
  { bg: '#ffd7f0', skin: '#e3ae84', shade: '#c98f63', hair: '#160d33', shirt: '#160d33' },
  { bg: '#bfe3ff', skin: '#f6d3b3', shade: '#e0b38c', hair: '#b4321f', shirt: '#2a1470' },
  { bg: '#ffe08a', skin: '#d99f72', shade: '#bd8256', hair: '#5b2ee6', shirt: '#160d33' },
];

function Hair({ look, color }: { look: number; color: string }) {
  if (look === 0) {
    // Bob ngang cằm, mái bằng.
    return (
      <path
        fill={color}
        d="M30 78c-6-34 8-56 30-56s36 22 30 56c-1 6-5 9-10 9V50H40v37c-5 0-9-3-10-9zM40 36h40v16H40z"
      />
    );
  }
  if (look === 1) {
    // Fade với mái vuốt ngược.
    return (
      <>
        <path fill={color} opacity=".35" d="M38 58V44h44v14h-3V48H41v10z" />
        <path fill={color} d="M37 46c-3-16 9-26 25-26 13 0 24 5 22 24-7-7-14-8-23-8-9 0-16 3-24 10z" />
      </>
    );
  }
  if (look === 2) {
    // Tóc xoăn.
    return (
      <g fill={color}>
        <circle cx="38" cy="42" r="12" />
        <circle cx="50" cy="30" r="13" />
        <circle cx="68" cy="29" r="13" />
        <circle cx="82" cy="41" r="12" />
        <circle cx="32" cy="58" r="10" />
        <circle cx="88" cy="58" r="10" />
        <circle cx="60" cy="36" r="12" />
      </g>
    );
  }
  // Búi cao.
  return (
    <g fill={color}>
      <circle cx="60" cy="17" r="11" />
      <path d="M37 54c-2-20 9-30 23-30s25 10 23 30c-7-8-14-12-23-12s-16 4-23 12z" />
    </g>
  );
}

/** Chân dung thợ dạng hình học. */
export function Avatar({ look, className }: { look: 0 | 1 | 2 | 3; className?: string }) {
  const p = PALETTES[look];
  const clipId = `dl-av-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg {...base} className={className} viewBox="0 0 120 120">
      <rect width="120" height="120" rx="60" fill={p.bg} />
      <clipPath id={clipId}>
        <rect width="120" height="120" rx="60" />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <path d="M16 124c0-24 19-36 44-36s44 12 44 36z" fill={p.shirt} />
        <rect x="51" y="72" width="18" height="22" rx="8" fill={p.shade} />
        <rect x="39" y="34" width="42" height="50" rx="21" fill={p.skin} />
        <Hair look={look} color={p.hair} />
        <circle cx="52" cy="60" r="2.6" fill="#160d33" />
        <circle cx="68" cy="60" r="2.6" fill="#160d33" />
        <path d="M53 70q7 6 14 0" fill="none" stroke="#160d33" strokeWidth="2.4" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** Hình cho lựa chọn "Ai cũng được": ba vòng tròn chồng nhau. */
export function AnyAvatar({ className }: { className?: string }) {
  return (
    <svg {...base} className={className} viewBox="0 0 120 120">
      <rect width="120" height="120" rx="60" fill="#160d33" />
      <circle cx="44" cy="52" r="20" fill="#5b2ee6" />
      <circle cx="76" cy="52" r="20" fill="#c9f73b" />
      <circle cx="60" cy="76" r="20" fill="#ff8fd0" />
    </svg>
  );
}
