import test from "node:test";
import assert from "node:assert/strict";
import { motionMilliseconds } from "../lib/motion-time.mjs";
import { playPageEntrance, playPageExit } from "../lib/page-motion.mjs";

const oldStyle = globalThis.getComputedStyle;
globalThis.getComputedStyle = () => ({ getPropertyValue: () => ".62s" });
test.after(() => { globalThis.getComputedStyle = oldStyle; });

function surface() {
  const attrs = new Set(), calls = [];
  let removed = 0;
  const node = {
    setAttribute: key => attrs.add(key), removeAttribute: key => attrs.delete(key),
    remove: () => { removed++; },
    animate(frames, options) {
      let finish, reject;
      const finished = new Promise((yes, no) => { finish = yes; reject = no; });
      const animation = { finished, cancels: 0, cancel() { this.cancels++; reject(Error("cancel")); } };
      calls.push({ frames, options, animation, finish });
      return animation;
    },
  };
  return { node, attrs, calls, get removed() { return removed; } };
}

test("Motion durations survive CSS minification and malformed values", () => {
  for (const [value, expected] of [[".76s", 760], ["760ms", 760], [" .62s ", 620], ["0.48S", 480], ["480MS", 480]])
    assert.equal(motionMilliseconds(value, 620), expected);
  for (const value of ["", "NaN", "0s", "-1s", "2", "Infinitys"])
    assert.equal(motionMilliseconds(value, 620), 620);
});

test("Page entrance has depth and always restores the live surface", async () => {
  const f = surface(), stop = playPageEntrance(f.node);
  assert.ok(f.attrs.has("data-page-motion"));
  assert.equal(f.calls[0].options.duration, 620);
  assert.ok(f.calls[0].frames[0].filter.includes("blur"));
  f.calls[0].finish();
  await Promise.resolve(); await Promise.resolve();
  stop();
  assert.equal(f.attrs.size, 0);
  assert.equal(f.calls[0].animation.cancels, 1);
});

test("Rapid navigation cancels the entrance and removes outgoing snapshots once", async () => {
  const incoming = surface(), outgoing = surface();
  const stopIn = playPageEntrance(incoming.node), stopOut = playPageExit(outgoing.node);
  stopIn(); stopOut(); stopOut();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(incoming.attrs.size, 0);
  assert.equal(outgoing.removed, 1);
  assert.equal(outgoing.calls[0].animation.cancels, 1);
});

test("Reduced motion is opacity-only and WAAPI failures leave no snapshot", () => {
  const gentle = surface();
  playPageEntrance(gentle.node, 1, true)();
  assert.equal(gentle.calls[0].options.duration, 100);
  assert.deepEqual(Object.keys(gentle.calls[0].frames[0]), ["opacity"]);
  const failed = surface(); failed.node.animate = () => { throw Error("Unsupported"); };
  assert.doesNotThrow(() => playPageEntrance(failed.node)());
  assert.equal(failed.attrs.size, 0);
  assert.doesNotThrow(() => playPageExit(failed.node)());
  assert.equal(failed.removed, 1);
});
