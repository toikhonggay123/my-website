// CSS minification can change 760ms into .76s; WAAPI takes milliseconds.
export function motionMilliseconds(value, fallback, minimum = 0) {
  const match = value.trim().match(/^(\d*\.?\d+)(ms|s)$/i);
  const result = match ? Number(match[1]) * (match[2].toLowerCase() === "s" ? 1000 : 1) : NaN;
  return Number.isFinite(result) && result > minimum ? result : fallback;
}
