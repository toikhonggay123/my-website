import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);

// Bộ easing dùng chung. Tên ngắn để concept gọi: ease: 'afx.out'
CustomEase.create('afx.out', '0.16, 1, 0.3, 1'); // vào cảnh, dừng mềm
CustomEase.create('afx.inOut', '0.65, 0, 0.35, 1'); // chuyển cảnh, scrub
CustomEase.create('afx.in', '0.7, 0, 0.84, 0'); // rời cảnh
CustomEase.create('afx.cinema', '0.22, 1, 0.36, 1'); // hero, chậm và nặng

ScrollTrigger.config({ ignoreMobileResize: true });

export { gsap, ScrollTrigger, SplitText, CustomEase };

export const prefersReduced = () => typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const canHover = () => typeof window !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches;
