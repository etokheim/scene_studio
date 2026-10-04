import assert from "node:assert/strict";
import test from "node:test";
import { beginSvgFrame, setTextIfChanged } from "../../custom_components/scene_studio/frontend/dial_svg_frame.js";
import { dialSkyMethods } from "../../custom_components/scene_studio/frontend/dial_sky.js";

class Element {
  constructor(tag) { this.localName = tag; this.attributes = {}; this.children = []; this.parentNode = null; this.mutations = 0; this.writes = 0; this.ownerDocument = { createElementNS: (_ns, name) => new Element(name) }; }
  get nextSibling() { const siblings = this.parentNode?.children || []; return siblings[siblings.indexOf(this) + 1] || null; }
  get lastChild() { return this.children.at(-1) || null; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  setAttribute(name, value) { this.attributes[name] = String(value); this.writes++; }
  insertBefore(node, before) { node.remove(); const at = before ? this.children.indexOf(before) : this.children.length; assert.ok(at >= 0); this.children.splice(at, 0, node); node.parentNode = this; this.mutations++; return node; }
  appendChild(node) { return this.insertBefore(node, null); }
  remove() { if (this.parentNode) { const parent = this.parentNode; parent.children.splice(parent.children.indexOf(this), 1); parent.mutations++; this.parentNode = null; } }
  querySelector(selector) { return this.children.find(node => `.${node.attributes.class}` === selector) || null; }
}

function paint(parent, values) {
  const frame = beginSvgFrame(parent, parent.querySelector(".sun"));
  for (const [key, x] of values) frame.node(key, "circle", { cx: x, class: "mark" });
  frame.finish();
}

test("unchanged SVG topology retains marks, order and unrelated sun nodes", () => {
  const parent = new Element("svg"), sun = new Element("g");
  sun.setAttribute("class", "sun"); parent.appendChild(sun);
  paint(parent, [["a", 1], ["b", 2]]);
  const nodes = [...parent.children], mutations = parent.mutations;
  const writes = nodes.map(node => node.writes);
  paint(parent, [["a", 1], ["b", 2]]);
  assert.deepEqual(parent.children, nodes);
  assert.equal(parent.mutations, mutations);
  assert.deepEqual(nodes.map(node => node.writes), writes);
  paint(parent, [["b", 3], ["a", 4]]);
  assert.deepEqual(parent.children, [nodes[1], nodes[0], sun]);
  paint(parent, [["b", 5]]);
  assert.deepEqual(parent.children, [nodes[1], sun]);
  assert.equal(nodes[0].parentNode, null);
});

test("frame ownership is independent for outgoing and incoming previews", () => {
  const outgoing = new Element("svg"), incoming = new Element("svg");
  paint(outgoing, [["a", 1]]); paint(incoming, [["a", 2]]);
  assert.notEqual(outgoing.children[0], incoming.children[0]);
  paint(incoming, []);
  assert.equal(outgoing.children.length, 1);
});

test("duplicate keys and changing a retained SVG type are invariant errors", () => {
  const parent = new Element("svg"); const frame = beginSvgFrame(parent);
  frame.node("a", "path", {});
  assert.throws(() => frame.node("a", "path", {}), /Duplicate dial mark/);
  assert.throws(() => beginSvgFrame(parent).node("a", "line", {}), /changed type/);
});

test("repeated event label painting preserves its text node", () => {
  let writes = 0, text = "Dawn";
  const element = { get textContent() { return text; }, set textContent(value) { text = value; writes++; } };
  setTextIfChanged(element, "Dawn");
  assert.equal(writes, 0);
  setTextIfChanged(element, "Sunrise");
  assert.equal(text, "Sunrise"); assert.equal(writes, 1);
});

function painter(events, curve) {
  return { _sunPath: { curve }, _paintSunDayClip() {},
    _clockSunPathRadius: () => 70,
    _clockPolar: (seconds, radius) => ({ x: 100 + radius * Math.cos(seconds / 86400 * Math.PI * 2), y: 100 + radius * Math.sin(seconds / 86400 * Math.PI * 2) }),
    _eventMarkSeconds: event => event.seconds,
    _eventButtonSeconds: event => event.buttonSeconds ?? event.seconds,
    _clockSunXy(seconds) { return this._clockPolar(seconds, 70); }, events };
}
const snapshot = element => element.children.map(node => ({ tag: node.localName, attributes: node.attributes }));

test("retained solar geometry equals a fresh paint through topology and clamp changes", () => {
  const overlay = new Element("svg");
  for (const [events, curve] of [
    [[{ id: "dawn", seconds: 5000 }], [[0, -10], [43200, 20], [86400, -10]]],
    [[{ id: "dawn", seconds: 6000, overridden: true, buttonSeconds: 7000 }, { id: "noon", seconds: 43200 }], [[0, -9], [43200, 18], [86400, -9]]],
    [[{ id: "noon", seconds: 40000 }], [[0, 10], [43200, 20], [86400, 10]]],
  ]) {
    const panel = painter(events, curve);
    dialSkyMethods._paintClockSunPath.call(panel, overlay, events, { includeSun: false });
    const fresh = new Element("svg");
    dialSkyMethods._paintClockSunPath.call(painter(events, curve), fresh, events, { includeSun: false });
    assert.deepEqual(snapshot(overlay), snapshot(fresh));
    const nodes = [...overlay.children], mutations = overlay.mutations;
    dialSkyMethods._paintClockSunPath.call(panel, overlay, events, { includeSun: false });
    assert.deepEqual(overlay.children, nodes);
    assert.equal(overlay.mutations, mutations);
  }
});

test("an empty curve removes obsolete marks without touching other SVG children", () => {
  const overlay = new Element("svg");
  const curve = [[0, -10], [43200, 20], [86400, -10]];
  dialSkyMethods._paintClockSunPath.call(painter([], curve), overlay, [], { includeSun: false });
  assert.ok(overlay.children.length > 0);
  dialSkyMethods._paintClockSunPath.call(painter([], []), overlay, [], { includeSun: false });
  assert.equal(overlay.children.length, 0);
});

test("brightness gradient and override dots retain nodes with identical fresh geometry", async () => {
  const { dialRendererMethods } = await import("../../custom_components/scene_studio/frontend/dial_renderer.js");
  const panel = {
    _clockBrightnessFillEl: new Element("path"), _clockBrightnessArcEl: new Element("path"),
    _clockBrightnessGradEl: new Element("radialGradient"), _clockThemeBrightDotsEl: new Element("g"),
    _clockBrightR0: 25, _clockBrightR1: 40,
    _sunPath: { events: [{ id: "dawn", seconds: 21600 }, { id: "noon", seconds: 43200 }, { id: "dusk", seconds: 79200 }] },
    _eventButtonSeconds: e => e.seconds, _shownEventBrightness: () => 150,
    _themeEventBrightness: () => 100, _dialBrightnessLightId: () => "light.a",
    _clockAngleDeg: seconds => seconds / 86400 * 360,
    _layoutClockThemeBrightDots() { dialRendererMethods._layoutClockThemeBrightDots.call(this); },
    hasAttribute: () => false,
  };
  for (const dark of [false, true]) {
    panel.hasAttribute = () => dark;
    dialRendererMethods._layoutClockBrightnessCurve.call(panel);
    const grad = panel._clockBrightnessGradEl, dots = panel._clockThemeBrightDotsEl;
    const nodes = [grad.children.slice(), dots.children.slice()], mutations = [grad.mutations, dots.mutations];
    dialRendererMethods._layoutClockBrightnessCurve.call(panel);
    assert.deepEqual([grad.children, dots.children], nodes);
    assert.deepEqual([grad.mutations, dots.mutations], mutations);
    const fresh = { ...panel, _clockBrightnessGradEl: new Element("radialGradient"), _clockThemeBrightDotsEl: new Element("g") };
    dialRendererMethods._layoutClockBrightnessCurve.call(fresh);
    assert.deepEqual(snapshot(grad), snapshot(fresh._clockBrightnessGradEl));
    assert.deepEqual(snapshot(dots), snapshot(fresh._clockThemeBrightDotsEl));
  }
  panel._dialBrightnessLightId = () => null;
  panel._layoutClockThemeBrightDots();
  assert.equal(panel._clockThemeBrightDotsEl.children.length, 0);
});
