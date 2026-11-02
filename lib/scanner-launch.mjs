/**
 * A non-blocking visual bridge. It never starts a camera or postpones navigation.
 * @param {HTMLElement} surface
 * @param {{x: number, y: number} | null} origin
 */
export function playScannerLaunch(surface, origin = null) {
  const scene = surface.querySelector(".scan-scene");
  if (!scene?.animate) return () => {};
  const animations = [];
  const oldOrigin = scene.style.transformOrigin;
  const bounds = scene.getBoundingClientRect();
  const styles = getComputedStyle(scene);
  const easeOut = styles.getPropertyValue("--ease-out").trim() || "cubic-bezier(0.23, 1, 0.32, 1)";
  const easeDrawer = styles.getPropertyValue("--ease-drawer").trim() || "cubic-bezier(0.32, 0.72, 0, 1)";
  // Production CSS may normalize 280ms to .28s. WAAPI always expects milliseconds.
  const cssTime = styles.getPropertyValue("--motion-launch").trim().match(/^(\d*\.?\d+)(ms|s)$/);
  const milliseconds = cssTime ? Number(cssTime[1]) * (cssTime[2] === "s" ? 1000 : 1) : NaN;
  const duration = Number.isFinite(milliseconds) && milliseconds > 60 ? milliseconds : 280;
  const clamp = n => Math.max(10, Math.min(90, n));
  scene.style.transformOrigin = origin && bounds.width && bounds.height
    ? `${clamp((origin.x - bounds.left) / bounds.width * 100)}% ${clamp((origin.y - bounds.top) / bounds.height * 100)}%`
    : "50% 20%";
  scene.setAttribute("data-launching", "");
  let cleared = false;
  function clear() {
    if (cleared) return;
    cleared = true;
    animations.forEach(animation => animation.cancel());
    scene.removeAttribute("data-launching");
    scene.style.transformOrigin = oldOrigin;
  }
  function animate(selector, frames, timing = {}) {
    const node = selector ? scene.querySelector(selector) : scene;
    if (!node?.animate) return;
    const animation = node.animate(frames, { duration, easing: easeOut, fill: "both", ...timing });
    // A later tween may throw before Promise.all is attached. Cancellation of
    // already-created tweens must still have a rejection handler.
    void animation.finished.catch(() => {});
    animations.push(animation);
  }
  try {
    animate(null, [
      { opacity: 0.7, transform: "translateY(18px) scale(0.965)" },
      { opacity: 1, transform: "translateY(0) scale(1)" },
    ], { easing: easeDrawer });
    animate(".scanner-launch-fx", [
      { opacity: 0, offset: 0 }, { opacity: 0.85, offset: 0.15 }, { opacity: 0, offset: 1 },
    ]);
    animate(".scanner-launch-sheen", [
      { transform: "translateX(-120%) skewX(-18deg)" },
      { transform: "translateX(420%) skewX(-18deg)" },
    ], { easing: easeDrawer });
    animate(".scan-target-border", [
      { opacity: 0.45, transform: "scale(0.94)", offset: 0 },
      { opacity: 1, transform: "scale(1.018)", offset: 0.7 },
      { opacity: 1, transform: "scale(1)", offset: 1 },
    ], { duration: duration - 30, delay: 30 });
    for (const [selector, delay] of [[".scan-top", 20], [".scan-intro", 40], [".scan-bottom", 60]]) {
      animate(selector, [
        { opacity: 0.6, transform: "translateY(8px)" },
        { opacity: 1, transform: "translateY(0)" },
      ], { duration: duration - delay, delay });
    }
    void Promise.all(animations.map(animation => animation.finished)).then(clear).catch(clear);
  } catch {
    // Missing/limited WAAPI must leave a fully usable scanner, never a launch veil.
    clear();
  }
  return clear;
}
