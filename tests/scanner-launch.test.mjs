import test from "node:test";
import assert from "node:assert/strict";
import { playScannerLaunch } from "../lib/scanner-launch.mjs";

function fixture() {
  const calls = [], attributes = new Set();
  const makeNode = () => ({
    animate(frames, timing) {
      let resolve, reject;
      const finished = new Promise((yes, no) => { resolve = yes; reject = no; });
      const animation = { finished, cancelCount: 0, cancel() { this.cancelCount++; reject(Error("cancelled")); } };
      calls.push({ frames, timing, animation, finish: resolve });
      return animation;
    },
  });
  const scene = {
    ...makeNode(),
    style: { transformOrigin: "25% 25%" },
    getBoundingClientRect: () => ({ left: 200, top: 100, width: 800, height: 700 }),
    setAttribute: name => attributes.add(name),
    removeAttribute: name => attributes.delete(name),
    querySelector: () => makeNode(),
  };
  return { surface: { querySelector: () => scene }, scene, calls, attributes };
}

const oldComputedStyle = globalThis.getComputedStyle;
globalThis.getComputedStyle = () => ({ getPropertyValue: () => "" });
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

test("Missing WAAPI or partial animation failure leaves the scanner usable", () => {
  assert.doesNotThrow(() => playScannerLaunch({ querySelector: () => null })());
  const f = fixture();
  f.scene.animate = () => { throw Error("WAAPI unavailable"); };
  assert.doesNotThrow(() => playScannerLaunch(f.surface)());
  assert.equal(f.attributes.size, 0);
  assert.equal(f.scene.style.transformOrigin, "25% 25%");
});
