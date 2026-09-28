/** Index morph when the wheel editor stays mounted (simple scene ↔ palette). */

import { captureWheelPinList } from "./color_ui.js";
import { playLightStripLayout } from "./light_tiles.js";

const FLIP_MS = 280;
const FADE_MS = 180;
const EASE = "cubic-bezier(0.2, 0, 0, 1)";

function reduced() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function lightTiles(root) {
  return [...root.querySelectorAll(".simple-light-selector")].filter(
    (el) =>
      !el.classList.contains("select-all-tile") &&
      !el.classList.contains("add-light-tile")
  );
}

function flipFrom(el, prev) {
  if (!prev || prev.width < 1) {
    el.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: FADE_MS,
      easing: "ease-out",
    });
    return;
  }
  const next = el.getBoundingClientRect();
  const dx = prev.left - next.left;
  const dy = prev.top - next.top;
  if (Math.hypot(dx, dy) < 1) {
    return;
  }
  el.animate(
    [
      { transform: `translate(${dx}px, ${dy}px)` },
      { transform: "translate(0px, 0px)" },
    ],
    { duration: FLIP_MS, easing: EASE }
  );
}

function fadeSurplus(parent, clones, rects) {
  if (!parent || !clones?.length) {
    return;
  }
  const host = parent.getBoundingClientRect();
  clones.forEach((node, index) => {
    const prev = rects[index];
    if (!prev) {
      return;
    }
    node.style.position = "absolute";
    node.style.left = `${prev.left - host.left}px`;
    node.style.top = `${prev.top - host.top}px`;
    node.style.width = `${prev.width}px`;
    node.style.margin = "0";
    node.style.pointerEvents = "none";
    node.style.zIndex = "4";
    parent.appendChild(node);
    const anim = node.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: FADE_MS,
      easing: "ease-out",
    });
    anim.onfinish = () => node.remove();
  });
}

function morphIndexed(nextNodes, prevRects, surplusClones, surplusParent) {
  const shared = Math.min(nextNodes.length, prevRects.length);
  for (let i = 0; i < shared; i += 1) {
    flipFrom(nextNodes[i], prevRects[i]);
  }
  for (let i = shared; i < nextNodes.length; i += 1) {
    nextNodes[i].animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: FADE_MS,
      easing: "ease-out",
    });
  }
  if (prevRects.length > nextNodes.length) {
    fadeSurplus(
      surplusParent,
      surplusClones.slice(nextNodes.length),
      prevRects.slice(nextNodes.length)
    );
  }
}

export function snapshotWheelEditor(root) {
  if (!root) {
    return null;
  }
  const tiles = lightTiles(root);
  const groups = new Map();
  for (const el of root.querySelectorAll("[data-strip-key]")) {
    const key = el.dataset.stripKey || "";
    if (key.startsWith("group:")) {
      groups.set(key, el.getBoundingClientRect());
    }
  }
  const modes = [...root.querySelectorAll(".wheel-mode-pill .wheel-wrapper")];
  const presets = [...root.querySelectorAll(".hue-preset")];
  const chips = root.querySelector(".simple-editor > .scene-used");
  return {
    tileRects: tiles.map((el) => el.getBoundingClientRect()),
    tileClones: tiles.map((el) => el.cloneNode(true)),
    tileByKey: new Map(
      tiles.map((el) => [el.dataset.stripKey || "", el.getBoundingClientRect()])
    ),
    groups,
    pins: captureWheelPinList(root),
    modeRects: modes.map((el) => el.getBoundingClientRect()),
    modeClones: modes.map((el) => el.cloneNode(true)),
    presetRects: presets.map((el) => el.getBoundingClientRect()),
    presetClones: presets.map((el) => el.cloneNode(true)),
    chips: chips ? chips.cloneNode(true) : null,
    coverUrl:
      root.querySelector(".scene-cover:not(.is-leaving)")?.style.backgroundImage ||
      "",
  };
}

export function applyWheelMorph(snap, root) {
  const host = root?.host;
  const consumedPins = host?._wheelMorphConsumedPins || null;
  if (host) {
    host._wheelMorphConsumedPins = null;
  }
  if (!snap || !root || reduced()) {
    return;
  }
  const tiles = lightTiles(root);
  const strip = root.querySelector(".light-tiles");
  playLightStripLayout(strip, snap.groups, { matchedOnly: true });
  // Match tiles by light id first. Index order changes between scenes, so a
  // shared tile was flying into a neighbor's slot and then snapping back.
  // Leftover tiles (another area) pair in list order: the first one takes
  // the new title and color; only a true extra fades.
  if (snap.tileByKey) {
    const matchedKeys = new Set();
    const unmatchedNew = [];
    for (const el of tiles) {
      const key = el.dataset.stripKey || "";
      const prev = key ? snap.tileByKey.get(key) : null;
      if (prev && prev.width >= 1) {
        matchedKeys.add(key);
        flipFrom(el, prev);
      } else {
        unmatchedNew.push(el);
      }
    }
    const leftoverOld = [];
    snap.tileClones.forEach((clone, index) => {
      const key = clone.dataset?.stripKey || "";
      if (key && matchedKeys.has(key)) {
        return;
      }
      leftoverOld.push({ clone, rect: snap.tileRects[index] });
    });
    const shared = Math.min(unmatchedNew.length, leftoverOld.length);
    for (let i = 0; i < shared; i += 1) {
      flipFrom(unmatchedNew[i], leftoverOld[i].rect);
    }
    for (let i = shared; i < unmatchedNew.length; i += 1) {
      unmatchedNew[i].animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: FADE_MS,
        easing: "ease-out",
      });
    }
    fadeSurplus(
      strip,
      leftoverOld.slice(shared).map((item) => item.clone),
      leftoverOld.slice(shared).map((item) => item.rect)
    );
  } else {
    morphIndexed(tiles, snap.tileRects, snap.tileClones, strip);
  }
  const svg = root.querySelector(".hue-wheel-svg");
  const nextPinIds = new Set(
    [...root.querySelectorAll(".hue-wheel-svg .gm")]
      .filter((node) => node.style.display !== "none")
      .map((node) => node.dataset.sceneId || "")
  );
  for (const pin of snap.pins) {
    if (!svg || !pin.clone || (pin.id && nextPinIds.has(pin.id))) {
      continue;
    }
    if (consumedPins?.has(pin)) {
      continue;
    }
    pin.clone.style.pointerEvents = "none";
    svg.appendChild(pin.clone);
    const anim = pin.clone.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: FADE_MS,
      easing: "ease-out",
    });
    anim.onfinish = () => pin.clone.remove();
  }
  const modes = [...root.querySelectorAll(".wheel-mode-pill .wheel-wrapper")];
  const modeHost = root.querySelector(".wheel-mode-pill");
  morphIndexed(modes, snap.modeRects, snap.modeClones, modeHost);
  const presets = [...root.querySelectorAll(".hue-preset")];
  const presetHost = root.querySelector(".hue-presets-track");
  morphIndexed(presets, snap.presetRects, snap.presetClones, presetHost);
  const nextChips = root.querySelector(".simple-editor > .scene-used");
  if (snap.chips && nextChips) {
    nextChips.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: FADE_MS,
      easing: "ease-out",
    });
    snap.chips.style.position = "absolute";
    snap.chips.style.inset = "0 auto auto 0";
    snap.chips.style.pointerEvents = "none";
    nextChips.parentElement?.appendChild(snap.chips);
    const anim = snap.chips.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: FADE_MS,
      easing: "ease-out",
    });
    anim.onfinish = () => snap.chips.remove();
  }
}
