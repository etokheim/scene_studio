import assert from "node:assert/strict";
import test from "node:test";
import { waitForSurfaceAnimation } from "../../custom_components/scene_studio/frontend/editor_shell.js";

globalThis.window = globalThis;

test("surface cleanup waits for its own matching animation", async () => {
  const surface = new EventTarget();
  let completed = false;
  const waiting = waitForSurfaceAnimation(surface, "exit", 30).then(() => { completed = true; });
  const unrelated = new Event("animationend");
  unrelated.animationName = "enter";
  surface.dispatchEvent(unrelated);
  await Promise.resolve();
  assert.equal(completed, false);
  const exit = new Event("animationend");
  exit.animationName = "exit";
  surface.dispatchEvent(exit);
  await waiting;
  assert.equal(completed, true);
});

test("missing or interrupted surfaces eventually complete cleanup", async () => {
  await waitForSurfaceAnimation(null, "exit", 5);
  await waitForSurfaceAnimation(new EventTarget(), "exit", 5);
});

class Region {
  constructor() { this.children = []; this.parentNode = null; this.hidden = false; }
  get firstChild() { return this.children[0] || null; }
  appendChild(node) {
    if (node.parentNode) node.parentNode.children.splice(node.parentNode.children.indexOf(node), 1);
    this.children.push(node); node.parentNode = this;
  }
  replaceChildren(...nodes) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    for (const node of nodes) this.appendChild(node);
  }
}

test("switching visual editors retains region hosts and destination-owned light controls", async () => {
  const { mountEditorRegions } = await import("../../custom_components/scene_studio/frontend/editor_shell.js");
  const shell = { el: new Region(), toolbar: new Region(), preview: new Region(), lights: new Region() };
  const mount = new Region(), toolbar = new Region(), dial = new Region(), wheel = new Region();
  const firstLights = new Region(), nextLights = new Region();
  firstLights.owner = "old"; nextLights.owner = "new";
  mountEditorRegions(shell, { mount, visual: dial, toolbar: [toolbar], lights: firstLights });
  const lightHost = shell.lights;
  mountEditorRegions(shell, { mount, visual: wheel, toolbar: [toolbar], lights: nextLights });
  assert.equal(shell.lights, lightHost);
  assert.equal(shell.lights.firstChild.owner, "new");
  assert.equal(firstLights.parentNode, null);
  assert.equal(shell.toolbar.firstChild, toolbar);
  assert.equal(shell.preview.firstChild, wheel);
  assert.equal(dial.parentNode, null);
  mountEditorRegions(shell, { mount, visual: dial, toolbar: [], lights: null });
  assert.equal(shell.lights.hidden, true);
  assert.equal(shell.lights.firstChild, null);
});
