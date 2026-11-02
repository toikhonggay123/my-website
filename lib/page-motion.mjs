import { motionMilliseconds } from "./motion-time.mjs";

const ease = "cubic-bezier(0.23, 1, 0.32, 1)";

/** Frozen outgoing surface. Inert and short-lived; never retained in storage. */
export function capturePage(surface) {
  if (!surface || !surface.firstElementChild) return null;
  const bounds = surface.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return null;
  const top = Math.max(0, bounds.top);
  const wrapper = document.createElement("div");
  wrapper.className = "motion-snapshot";
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.inert = true;
  Object.assign(wrapper.style, {
    left: `${bounds.left}px`, top: `${top}px`, width: `${bounds.width}px`,
    height: `${Math.max(0, Math.min(bounds.bottom, innerHeight) - top)}px`,
  });
  const copy = surface.cloneNode(true);
  for (const node of [copy, ...copy.querySelectorAll("[id], [name], [autofocus]")]) {
    node.removeAttribute("id"); node.removeAttribute("name"); node.removeAttribute("autofocus");
  }
  copy.style.marginTop = `${bounds.top - top}px`;
  wrapper.appendChild(copy);
  document.body.appendChild(wrapper);
  return wrapper;
}

export function playPageEntrance(surface, direction = 1, gentle = false) {
  if (!surface?.animate) return () => {};
  const duration = gentle ? 100 : motionMilliseconds(getComputedStyle(surface).getPropertyValue("--motion-page"), 620);
  let animation;
  let cleared = false;
  const clear = () => {
    if (cleared) return;
    cleared = true;
    animation?.cancel();
    surface.removeAttribute("data-page-motion");
  };
  try {
    surface.setAttribute("data-page-motion", "enter");
    animation = surface.animate(gentle ? [{ opacity: 0.65 }, { opacity: 1 }] : [
      { opacity: 0.15, filter: "blur(7px)", transform: `perspective(1400px) translateX(${direction * 38}px) translateY(18px) rotateX(5deg) scale(0.96)`, offset: 0 },
      { opacity: 1, filter: "blur(0px)", transform: `perspective(1400px) translateX(${-direction * 2}px) translateY(-2px) rotateX(0deg) scale(1.005)`, offset: 0.78 },
      { opacity: 1, filter: "blur(0px)", transform: "none", offset: 1 },
    ], { duration, easing: ease, fill: "both" });
    void animation.finished.then(clear).catch(clear);
  } catch { clear(); }
  return clear;
}

export function playPageExit(snapshot, direction = 1) {
  if (!snapshot) return () => {};
  let animation;
  let cleared = false;
  const clear = () => {
    if (cleared) return;
    cleared = true;
    animation?.cancel();
    snapshot.remove();
  };
  try {
    animation = snapshot.animate([
      { opacity: 1, filter: "blur(0px)", transform: "perspective(1400px) translateX(0) scale(1)" },
      { opacity: 0, filter: "blur(8px)", transform: `perspective(1400px) translateX(${-direction * 30}px) translateY(-8px) rotateY(${-direction * 4}deg) scale(0.96)` },
    ], { duration: 420, easing: ease, fill: "both" });
    void animation.finished.then(clear).catch(clear);
  } catch { clear(); }
  return clear;
}
