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

test("light-strip gutters fit desktop footer space and retain the existing mobile gutter", async () => {
  const { fitLightStripGutter } = await import("../../custom_components/scene_studio/frontend/editor_shell.js");
  const values = [];
  const tiles = { getBoundingClientRect: () => ({ bottom: 856 }) };
  const lights = { hidden: false, querySelector: () => tiles, getBoundingClientRect: () => ({ bottom: 900 }), style: { setProperty: (key, value) => values.push([key, value]) } };
  fitLightStripGutter({ lights });
  assert.deepEqual(values.pop(), ["--light-strip-bottom-padding", "44px"]);
  // A wrapped/mobile hint has room for the complete original gutter.
  lights.getBoundingClientRect = () => ({ bottom: 940 });
  fitLightStripGutter({ lights });
  assert.deepEqual(values.pop(), ["--light-strip-bottom-padding", "64px"]);
  // Translating the light region with its tiles does not change the gutter.
  lights.getBoundingClientRect = () => ({ bottom: 936 });
  tiles.getBoundingClientRect = () => ({ bottom: 892 });
  fitLightStripGutter({ lights });
  assert.deepEqual(values.pop(), ["--light-strip-bottom-padding", "44px"]);
});

test("sidebar end room applies only to natural overflow, independent of existing compensation", async () => {
  const { lightStripEndRoom } = await import("../../custom_components/scene_studio/frontend/editor_shell.js");
  const input = { contentWidth: 1200, viewportWidth: 800, overlap: 391, open: true };
  assert.equal(lightStripEndRoom(input), 391);
  assert.equal(lightStripEndRoom({ ...input, contentWidth: 250 }), 0);
  assert.equal(lightStripEndRoom({ ...input, contentWidth: 800 }), 0);
  assert.equal(lightStripEndRoom({ ...input, open: false }), 0);
  assert.equal(lightStripEndRoom({ ...input, overlap: -10 }), 0);
});

test("timeline belongs to the stage, outside the toolbar and light hosts", async () => {
  const { createEditorShell } = await import("../../custom_components/scene_studio/frontend/editor_shell.js");
  globalThis.document = { createElement: () => { const node = new Region(); node.append = (...items) => items.forEach(item => node.appendChild(item)); node.setAttribute = () => {}; return node; } };
  const shell = createEditorShell();
  assert.deepEqual(shell.stage.children, [shell.preview, shell.timeline]);
  assert.deepEqual(shell.el.children, [shell.background, shell.toolbar, shell.stage, shell.lights]);
});

test("scroll compensation never makes a short strip overflow itself", async () => {
  const { fitSidebarLightStrip } = await import("../../custom_components/scene_studio/frontend/editor_shell.js");
  let room = 0, width = 1200, writes = 0;
  globalThis.getComputedStyle = () => ({ transform: "none" });
  globalThis.DOMMatrixReadOnly = class { constructor() { this.m41 = 0; } };
  const tiles = { getBoundingClientRect: () => ({ width: width + room }), style: { getPropertyValue: () => String(room), setProperty: (_key, value) => { room = parseFloat(value); writes++; } } };
  const scroller = { clientWidth: 800, querySelector: () => tiles, getBoundingClientRect: () => ({ left: 0, right: 800, top: 500, bottom: 700 }) };
  const shell = { lights: { querySelector: () => scroller } };
  const sidebar = { getBoundingClientRect: () => ({ left: 425, top: 80, bottom: 780 }) };
  fitSidebarLightStrip(shell, sidebar, true); assert.equal(room, 391);
  for (let i = 0; i < 30; i++) fitSidebarLightStrip(shell, sidebar, true);
  assert.equal(writes, 1);
  width = 250; fitSidebarLightStrip(shell, sidebar, true); assert.equal(room, 0);
  width = 1200; fitSidebarLightStrip(shell, sidebar, true); assert.equal(room, 391);
  fitSidebarLightStrip(shell, sidebar, false); assert.equal(room, 0);
});
