/* Retain only this painter's SVG marks. Geometry and paint order stay owned by
 * the dial painter; unrelated defs, handles and sun-fill nodes are untouched. */
const frames = new WeakMap();

export function beginSvgFrame(parent, before = null) {
  let pool = frames.get(parent);
  if (!pool) {
    pool = new Map();
    frames.set(parent, pool);
  }
  const order = [];
  const used = new Set();
  return {
    node(key, tag, attributes) {
      if (used.has(key)) throw new Error(`Duplicate dial mark ${key}`);
      used.add(key);
      let element = pool.get(key);
      if (element && element.localName !== tag) throw new Error(`Dial mark ${key} changed type`);
      if (!element || element.parentNode !== parent) {
        element = parent.ownerDocument.createElementNS("http://www.w3.org/2000/svg", tag);
        pool.set(key, element);
        parent.insertBefore(element, before);
      }
      for (const [name, value] of Object.entries(attributes)) {
        const text = String(value);
        if (element.getAttribute(name) !== text) element.setAttribute(name, text);
      }
      order.push(element);
      return element;
    },
    finish() {
      for (const [key, element] of pool) {
        if (!used.has(key)) {
          element.remove();
          pool.delete(key);
        }
      }
      // New/removed marks may change order. Unchanged frames never move nodes.
      let next = before;
      for (let index = order.length - 1; index >= 0; index--) {
        const element = order[index];
        if (element.nextSibling !== next) parent.insertBefore(element, next);
        next = element;
      }
    },
  };
}

export function setTextIfChanged(element, text) {
  if (element && element.textContent !== text) element.textContent = text;
}
