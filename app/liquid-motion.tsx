"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { playScannerLaunch } from "@/lib/scanner-launch.mjs";

const easeOut = "cubic-bezier(0.23, 1, 0.32, 1)";
const easeDrawer = "cubic-bezier(0.32, 0.72, 0, 1)";
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Animate the existing surface, never remount the scanner or animate React state per frame.
export function usePageMotion(ref: RefObject<HTMLDivElement | null>, view: string, scannerLaunch: RefObject<boolean>) {
  const previous = useRef(view);
  const keyboard = useRef(false);
  const animation = useRef<Animation | null>(null);
  const launchCleanup = useRef<(() => void) | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const onKey = () => { keyboard.current = true; };
    const onPointer = (event: PointerEvent) => {
      keyboard.current = false;
      origin.current = { x: event.clientX, y: event.clientY };
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer, true);
    };
  }, []);
  useLayoutEffect(() => {
    if (previous.current === view) return;
    const fromOverview = previous.current === "overview";
    previous.current = view;
    const launch = scannerLaunch.current;
    scannerLaunch.current = false;
    launchCleanup.current?.();
    launchCleanup.current = null;
    const node = ref.current;
    if (!node?.animate || keyboard.current) {
      animation.current?.cancel();
      return;
    }
    if (launch && fromOverview && view === "scanner" && !reduced()) {
      animation.current?.cancel();
      launchCleanup.current = playScannerLaunch(node, origin.current);
      return;
    }
    const interrupted = animation.current?.playState === "running";
    const current = getComputedStyle(node);
    const from = interrupted
      ? { opacity: current.opacity, transform: current.transform }
      : { opacity: 0.65, transform: view === "scanner" || reduced() ? "none" : "translateY(6px)" };
    animation.current?.cancel();
    animation.current = node.animate([from, { opacity: 1, transform: "none" }], {
      duration: reduced() ? 90 : 180,
      easing: easeOut,
    });
  }, [ref, view, scannerLaunch]);
  useEffect(() => () => {
    animation.current?.cancel();
    launchCleanup.current?.();
  }, []);
}

// Retain the last visible content only during exit; reopening cancels that exit.
export function MotionPresence({ open, variant = "modal", children }: {
  open: boolean;
  variant?: "modal" | "popover" | "feedback";
  children: ReactNode;
}) {
  const [visible, setVisible] = useState(open);
  const [retained, setRetained] = useState(children);
  const root = useRef<HTMLDivElement>(null);
  const animations = useRef<Animation[]>([]);
  useLayoutEffect(() => {
    if (open) {
      setRetained(children);
      setVisible(true);
    }
  }, [open, children]);
  useLayoutEffect(() => {
    const outer = root.current?.firstElementChild as HTMLElement | undefined;
    if (!outer || !visible) return;
    const inner = outer.querySelector<HTMLElement>(".modal, .camera-feedback-glass") || outer;
    const wasRunning = animations.current.some(a => a.playState === "running");
    const outerOpacity = wasRunning ? getComputedStyle(outer).opacity : open ? 0 : 1;
    const innerTransform = wasRunning ? getComputedStyle(inner).transform : open ? "translateY(8px) scale(0.97)" : "none";
    animations.current.forEach(a => a.cancel());
    if (!outer.animate) { if (!open) setVisible(false); return; }
    const duration = reduced() ? 90 : open ? 240 : 180;
    const opacity = outer.animate([{ opacity: outerOpacity }, { opacity: open ? 1 : 0 }], { duration, easing: easeOut, fill: "both" });
    const transform = reduced() ? null : inner.animate([
      { transform: innerTransform },
      { transform: open ? "none" : "translateY(8px) scale(0.97)" },
    ], { duration, easing: variant === "popover" ? easeDrawer : easeOut, fill: "both" });
    const active = [opacity, ...(transform ? [transform] : [])];
    animations.current = active;
    void opacity.finished.then(() => {
      if (animations.current !== active) return;
      if (!open) setVisible(false);
      active.forEach(a => a.cancel());
    }).catch(() => {});
  }, [open, visible, variant]);
  useEffect(() => () => animations.current.forEach(a => a.cancel()), []);
  if (!visible) return null;
  return <div ref={root} className="motion-presence" data-exiting={!open || undefined} inert={!open}>{open ? children : retained}</div>;
}
