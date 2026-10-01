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

test("superseded transition tokens cannot clean up the latest preview", async () => {
  const { createTransitionGate, crossfadePreview } = await import("../../custom_components/scene_studio/frontend/editor_shell.js");
  const gate = createTransitionGate();
  const token = gate.next();
  const names = new Set();
  const incoming = new EventTarget();
  incoming.offsetWidth = 100;
  incoming.classList = { add: name => names.add(name), remove: name => names.delete(name) };
  let removed = false;
  const waiting = crossfadePreview({}, { classList: { add() {} }, remove() { removed = true; } }, incoming,
    { current: () => gate.current(token) });
  gate.next();
  const end = new Event("animationend"); end.animationName = "stage-surface-enter-scale";
  incoming.dispatchEvent(end);
  await waiting;
  assert.equal(removed, false);
  assert.equal(gate.current(token), false);
});

test("a light-region exit cannot hide destination controls after rapid navigation", async () => {
  const { createTransitionGate, setLightRegion } = await import("../../custom_components/scene_studio/frontend/editor_shell.js");
  const lights = new EventTarget();
  const region = new Region();
  lights.hidden = false;
  lights.children = region.children;
  lights.replaceChildren = (...nodes) => region.replaceChildren(...nodes);
  lights.getBoundingClientRect = () => ({ height: 200 });
  lights.style = { setProperty() {} };
  lights.classList = { add() {}, remove() {} };
  const shell = { lights, lightGate: createTransitionGate() };
  const exiting = setLightRegion(shell, null);
  const destination = new Region(); destination.owner = "new";
  await setLightRegion(shell, destination, { reducedMotion: true });
  const end = new Event("animationend"); end.animationName = "editor-lights-drop";
  lights.dispatchEvent(end);
  await exiting;
  assert.equal(lights.hidden, false);
  assert.equal(lights.inert, false);
  assert.equal(region.firstChild, destination);
});

test("reduced motion removes the outgoing preview without starting animations", async () => {
  const { crossfadePreview } = await import("../../custom_components/scene_studio/frontend/editor_shell.js");
  let removed = false;
  await crossfadePreview({}, { remove() { removed = true; } }, null, { reducedMotion: true });
  assert.equal(removed, true);
});

test("repeated shell reconciliation does not restart a pending light exit", async () => {
  const { createTransitionGate, mountEditorRegions, setLightRegion } = await import("../../custom_components/scene_studio/frontend/editor_shell.js");
  const names = new Set(), lights = new EventTarget(), oldContent = new Region();
  lights.firstChild = oldContent;
  lights.hidden = false;
  lights.classList = { add: name => names.add(name), remove: (...keys) => keys.forEach(key => names.delete(key)), contains: name => names.has(name) };
  lights.style = { setProperty() {} };
  lights.getBoundingClientRect = () => ({ height: 200 });
  lights.replaceChildren = () => { lights.firstChild = null; };
  const shell = { el: new Region(), toolbar: new Region(), preview: new Region(), lights, lightGate: createTransitionGate() };
  const exit = setLightRegion(shell, null);
  const mount = new Region(), visual = new Region();
  for (let i = 0; i < 3; i++) mountEditorRegions(shell, { mount, visual, toolbar: [], lights: null, animateLights: true });
  assert.equal(shell.lightGate.current(1), true);
  const end = new Event("animationend"); end.animationName = "editor-lights-drop";
  lights.dispatchEvent(end);
  await exit;
  assert.equal(lights.hidden, true);
  assert.equal(lights.firstChild, null);
});

test("preview floors and timeline orientation use editor dimensions", async () => {
  const { editorGeometry } = await import("../../custom_components/scene_studio/frontend/editor_shell.js");
  assert.deepEqual(editorGeometry(1200, 900, 900), { floor: 300, portrait: false, overlap: true });
  assert.deepEqual(editorGeometry(700, 900, 900), { floor: 300, portrait: true, overlap: false });
  assert.equal(editorGeometry(240, 500, 500).floor, 240);
  assert.equal(editorGeometry(500, 240, 240).floor, 240);
});
