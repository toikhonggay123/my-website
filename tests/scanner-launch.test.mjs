import test from "node:test";
import assert from "node:assert/strict";
import { playScannerLaunch } from "../lib/scanner-launch.mjs";

function fixture(duration = "") {
  const calls = [], attributes = new Set();
  const makeNode = () => ({
    animate(frames, timing) {
      if (!Number.isFinite(timing.duration) || timing.duration < 0) throw RangeError("Invalid animation duration");
      let resolve, reject;
      const finished = new Promise((yes, no) => { resolve = yes; reject = no; });
      const animation = { finished, cancelCount: 0, cancel() { this.cancelCount++; reject(Error("cancelled")); } };
      calls.push({ frames, timing, animation, finish: resolve });
      return animation;
    },
  });
  const scene = {
    ...makeNode(),
    motionDuration: duration,
    style: { transformOrigin: "25% 25%" },
    getBoundingClientRect: () => ({ left: 200, top: 100, width: 800, height: 700 }),
    setAttribute: name => attributes.add(name),
    removeAttribute: name => attributes.delete(name),
    querySelector: () => makeNode(),
  };
  return { surface: { querySelector: () => scene }, scene, calls, attributes };
}

const oldComputedStyle = globalThis.getComputedStyle;
globalThis.getComputedStyle = node => ({ getPropertyValue: property => property === "--motion-launch" ? node.motionDuration : "" });
test.after(() => { globalThis.getComputedStyle = oldComputedStyle; });

test("Scanner launch finishes within 280 ms and only animates transform/opacity", async () => {
  const f = fixture();
  playScannerLaunch(f.surface, { x: 10, y: 20 });
  assert.equal(f.scene.style.transformOrigin, "10% 10%");
  assert.ok(f.attributes.has("data-launching"));
  assert.equal(f.calls.length, 7);
  for (const call of f.calls) {
    assert.ok(call.timing.duration + (call.timing.delay || 0) <= 280);
    for (const frame of call.frames)
      assert.ok(Object.keys(frame).every(key => ["opacity", "transform", "offset"].includes(key)));
    call.finish();
  }
  await Promise.resolve(); await Promise.resolve();
  assert.equal(f.attributes.has("data-launching"), false);
  assert.equal(f.scene.style.transformOrigin, "25% 25%");
  assert.ok(f.calls.every(call => call.animation.cancelCount === 1));
});

test("Leaving during launch clears the veil and cancels every owned animation once", async () => {
  const f = fixture(), stop = playScannerLaunch(f.surface);
  stop(); stop();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(f.attributes.size, 0);
  assert.equal(f.scene.style.transformOrigin, "25% 25%");
  assert.ok(f.calls.every(call => call.animation.cancelCount === 1));
});

test("Missing WAAPI or partial animation failure leaves the scanner usable", async () => {
  assert.doesNotThrow(() => playScannerLaunch({ querySelector: () => null })());
  const f = fixture();
  f.scene.animate = () => { throw Error("WAAPI unavailable"); };
  assert.doesNotThrow(() => playScannerLaunch(f.surface)());
  assert.equal(f.attributes.size, 0);
  assert.equal(f.scene.style.transformOrigin, "25% 25%");
  const partial = fixture(), resolveNode = partial.scene.querySelector;
  partial.scene.querySelector = selector => {
    const node = resolveNode();
    if (selector === ".scan-target-border") node.animate = () => { throw Error("later tween failed"); };
    return node;
  };
  assert.doesNotThrow(() => playScannerLaunch(partial.surface)());
  await Promise.resolve(); await Promise.resolve();
  assert.equal(partial.attributes.size, 0);
  assert.equal(partial.calls.length, 3);
  assert.ok(partial.calls.every(call => call.animation.cancelCount === 1));
});

test("Production CSS seconds and source milliseconds retain all seven launch animations", () => {
  for (const [value, expected] of [[".28s", 280], ["0.280s", 280], ["280ms", 280], [".18s", 180]]) {
    const f = fixture(value), stop = playScannerLaunch(f.surface);
    assert.equal(f.calls.length, 7, `CSS ${value} must not abort launch on a negative stagger duration`);
    assert.ok(f.attributes.has("data-launching"));
    assert.equal(f.calls[0].timing.duration, expected);
    assert.ok(f.calls.every(call => call.timing.duration + (call.timing.delay || 0) === expected));
    stop();
  }
});

test("Invalid or excessively short CSS times use a safe launch duration", () => {
  for (const value of ["", "invalid", "0s", "-1s", "1ms", "Infinityms"]) {
    const f = fixture(value), stop = playScannerLaunch(f.surface);
    assert.equal(f.calls.length, 7, value);
    assert.equal(f.calls[0].timing.duration, 280, value);
    stop();
  }
});
