"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { playScannerLaunch } from "@/lib/scanner-launch.mjs";
import { capturePage, playPageEntrance, playPageExit } from "@/lib/page-motion.mjs";

const easeOut = "cubic-bezier(0.23, 1, 0.32, 1)";
const easeDrawer = "cubic-bezier(0.32, 0.72, 0, 1)";
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Animate the existing surface, never remount the scanner or animate React state per frame.
export function usePageMotion(ref: RefObject<HTMLDivElement | null>, view: string, scannerLaunch: RefObject<boolean>) {
  const previous = useRef(view);
  const previousView = useRef(view);
  const keyboard = useRef(false);
  const entranceCleanup = useRef<(() => void) | null>(null);
  const exitCleanup = useRef<(() => void) | null>(null);
  const snapshot = useRef<HTMLElement | null>(null);
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
    entranceCleanup.current?.();
    exitCleanup.current?.();
    const node = ref.current;
    if (!node?.animate) {
      snapshot.current?.remove(); snapshot.current = null;
      return;
    }
    const order = ["overview", "scanner", "attendance", "missing", "students", "qrcards", "reports", "settings", "guide"];
    const direction = order.indexOf(view) >= order.indexOf(previousView.current) ? 1 : -1;
    previousView.current = view;
    const gentle = reduced() || keyboard.current;
    if (gentle) snapshot.current?.remove();
    else exitCleanup.current = playPageExit(snapshot.current, direction);
    snapshot.current = null;
    if (launch && fromOverview && view === "scanner" && !gentle) {
      launchCleanup.current = playScannerLaunch(node, origin.current);
      return;
    }
    entranceCleanup.current = playPageEntrance(node, direction, gentle);
  }, [ref, view, scannerLaunch]);
  useEffect(() => () => {
    entranceCleanup.current?.();
    exitCleanup.current?.();
    launchCleanup.current?.();
    snapshot.current?.remove();
  }, []);
  return () => {
    entranceCleanup.current?.(); exitCleanup.current?.(); launchCleanup.current?.();
    snapshot.current?.remove();
    snapshot.current = !keyboard.current && !reduced() ? capturePage(ref.current) : null;
  };
}

export function useLiquidIndicator(ref: RefObject<HTMLElement | null>, selection: string, selector = "button.active") {
  const animation = useRef<Animation | null>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const update = () => {
      const target = root.querySelector<HTMLElement>(selector);
      const indicator = root.querySelector<HTMLElement>(".liquid-indicator");
      if (!target || !indicator) return;
      // Both are direct children of the positioned nav. Layout offsets stay
      // stable while a parent dialog/page is scaled, tilted or translated.
      const bounds = { left: target.offsetLeft, top: target.offsetTop, width: target.offsetWidth, height: target.offsetHeight };
      if (!bounds.width || !bounds.height) return;
      const ready = indicator.dataset.ready === "true";
      if (ready && indicator.offsetLeft === bounds.left && indicator.offsetTop === bounds.top && indicator.offsetWidth === bounds.width && indicator.offsetHeight === bounds.height) return;
      const matrix = new DOMMatrixReadOnly(getComputedStyle(indicator).transform);
      const old = { left: indicator.offsetLeft + matrix.m41, top: indicator.offsetTop + matrix.m42, width: indicator.offsetWidth * matrix.m11, height: indicator.offsetHeight * matrix.m22 };
      animation.current?.cancel();
      Object.assign(indicator.style, { left: `${bounds.left}px`, top: `${bounds.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px` });
      indicator.dataset.ready = "true";
      if (ready && indicator.animate && !reduced()) {
        animation.current = indicator.animate([
          { transform: `translate(${old.left - bounds.left}px, ${old.top - bounds.top}px) scale(${old.width / bounds.width}, ${old.height / bounds.height})` },
          { transform: "translate(0, 0) scale(1, 1)" },
        ], { duration: 480, easing: easeDrawer });
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(root);
    window.addEventListener("resize", update);
    return () => { observer.disconnect(); window.removeEventListener("resize", update); };
  }, [ref, selection, selector]);
  useEffect(() => () => animation.current?.cancel(), []);
}

// Retain the last visible content only during exit; reopening cancels that exit.
export function MotionPresence({ open, variant = "modal", onDismiss, children }: {
  open: boolean;
  variant?: "modal" | "popover" | "feedback";
  onDismiss?: () => void;
  children: ReactNode;
}) {
  const [visible, setVisible] = useState(open);
  const [retained, setRetained] = useState(children);
  const root = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const dismiss = useRef(onDismiss);
  useEffect(() => { dismiss.current = onDismiss; }, [onDismiss]);
  const animations = useRef<Animation[]>([]);
  useLayoutEffect(() => {
    if (open) {
      setRetained(children);
      setVisible(true);
    }
  }, [open, children]);
  useLayoutEffect(() => {
    if (!open || !visible || variant !== "modal") return;
    const panel = root.current?.querySelector<HTMLElement>(".modal");
    if (!panel) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const heading = panel.querySelector("h2");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    if (heading) { heading.id ||= `modal-${labelId}`; panel.setAttribute("aria-labelledby", heading.id); }
    const targets = () => [...panel.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')].filter(node => node.getClientRects().length);
    targets()[0]?.focus({ preventScroll: true });
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismiss.current) { event.preventDefault(); dismiss.current(); }
      if (event.key !== "Tab") return;
      const focusable = targets(), first = focusable[0], last = focusable.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keys);
    return () => { document.removeEventListener("keydown", keys); if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); };
  }, [open, visible, variant, labelId]);
  useLayoutEffect(() => {
    const outer = root.current?.firstElementChild as HTMLElement | undefined;
    if (!outer || !visible) return;
    const inner = outer.querySelector<HTMLElement>(".modal, .camera-feedback-glass") || outer;
    const wasRunning = animations.current.some(a => a.playState === "running");
    const outerOpacity = wasRunning ? getComputedStyle(outer).opacity : open ? 0 : 1;
    const innerTransform = wasRunning ? getComputedStyle(inner).transform : open ? "perspective(1100px) translateY(34px) rotateX(9deg) scale(0.92)" : "none";
    animations.current.forEach(a => a.cancel());
    if (!outer.animate) { if (!open) setVisible(false); return; }
    const duration = reduced() ? 90 : open ? variant === "feedback" ? 480 : 560 : 320;
    const opacity = outer.animate([{ opacity: outerOpacity }, { opacity: open ? 1 : 0 }], { duration, easing: easeOut, fill: "both" });
    const transform = reduced() ? null : inner.animate([
      { transform: innerTransform, offset: 0 },
      ...(open ? [{ transform: "perspective(1100px) translateY(-3px) rotateX(0deg) scale(1.018)", offset: 0.72 }] : []),
      { transform: open ? "none" : "perspective(1100px) translateY(24px) rotateX(6deg) scale(0.94)", offset: 1 },
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
