import assert from "node:assert/strict";
import test from "node:test";
import { captureLightStripLayout, finishLightStripLayout, playLightStripLayout, reconcileStripChildren } from "../../custom_components/scene_studio/frontend/light_tiles.js";

class Node {
  constructor(key) { this.dataset = { stripKey: key }; this.children = []; this.style = {}; this.isConnected = true; this.parentElement = null; this.rect = { left: 0, top: 0, width: 100, height: 100 }; this.moves = 0; }
  get nextSibling() { return this.parentElement?.children[this.parentElement.children.indexOf(this) + 1] || null; }
  getBoundingClientRect() { return this.rect; }
  querySelectorAll() { return this.children; }
  remove() { if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1); this.parentElement = null; }
  insertBefore(node, next) { if (node === next) return; node.remove(); const index = next ? this.children.indexOf(next) : this.children.length; this.children.splice(index, 0, node); node.parentElement = this; this.moves++; }
  appendChild(node) { this.insertBefore(node, null); }
  animate() { const a = new EventTarget(); a.cancel = () => a.dispatchEvent(new Event("cancel")); this.animation = a; return a; }
}
globalThis.window = { matchMedia: () => ({ matches: false }) };

test("unchanged keyed children do not move and changed membership keeps surviving nodes", () => {
  const root = new Node("root"), a = new Node("a"), b = new Node("b"), c = new Node("c");
  reconcileStripChildren(root, [a, b]); root.moves = 0;
  for (let i = 0; i < 30; i++) reconcileStripChildren(root, [a, b]);
  assert.equal(root.moves, 0);
  reconcileStripChildren(root, [a, c, b]);
  assert.deepEqual(root.children, [a, c, b]); assert.equal(root.moves, 1);
});

test("Select all stays first after animation completion and interruption", () => {
  const root = new Node("root"), all = new Node("all"), group = new Node("group");
  root.appendChild(all); root.appendChild(group);
  const before = captureLightStripLayout(root); all.rect = { ...all.rect, left: 50 };
  playLightStripLayout(root, before); all.animation.dispatchEvent(new Event("finish"));
  assert.deepEqual(root.children, [all, group]);
  const again = captureLightStripLayout(root); all.rect = { ...all.rect, left: 100 };
  playLightStripLayout(root, again); finishLightStripLayout(root);
  assert.deepEqual(root.children, [all, group]); assert.equal(all.style.zIndex, "");
  finishLightStripLayout(root); assert.deepEqual(root.children, [all, group]);
});
