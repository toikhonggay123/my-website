import test from "node:test";
import assert from "node:assert/strict";
import { motionMilliseconds } from "../lib/motion-time.mjs";
import { canCapturePage, playPageEntrance, playPageExit } from "../lib/page-motion.mjs";

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
  assert.match(f.calls[0].frames[0].transform, /perspective/);
  const exit = surface(), stopExit = playPageExit(exit.node);
  for (const call of [...f.calls, ...exit.calls]) for (const frame of call.frames)
    assert.ok(Object.keys(frame).every(key => ["opacity", "transform", "offset"].includes(key)));
  stopExit();
  f.calls[0].finish();
  await Promise.resolve(); await Promise.resolve();
  stop();
  assert.equal(f.attrs.size, 0);
  assert.equal(f.calls[0].animation.cancels, 1);
});

test("Snapshot work stops at the node budget without walking a long roster", () => {
  let visits = 0;
  const page = { ownerDocument: { createTreeWalker: () => ({ nextNode: () => { visits++; return { tagName: 'DIV' }; } }) } };
  assert.equal(canCapturePage(page), false);
  assert.equal(visits, 241);
});

test("Small pages can crossfade; camera, canvas and iframe surfaces are never cloned", () => {
  const page = tags => ({ ownerDocument: { createTreeWalker: () => {
    let index = 0;
    return { nextNode: () => index < tags.length ? { tagName: tags[index++] } : null };
  } } });
  assert.equal(canCapturePage(page(Array(240).fill('DIV'))), true);
  for (const media of ['VIDEO', 'CANVAS', 'IFRAME']) assert.equal(canCapturePage(page(['DIV',media])), false);
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
