/** Library items a scene actually references, in theme / palette / variable order. */

import { variableIsPalette } from "./palette.js";

function collectRefs(node, into) {
  if (!node || typeof node !== "object") {
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      collectRefs(item, into);
    }
    return;
  }
  if (typeof node.variable_ref === "string" && node.variable_ref) {
    into.add(node.variable_ref);
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === "object") {
      collectRefs(value, into);
    }
  }
}

/**
 * @returns {{ kind: "theme"|"palette"|"variable", id: string }[]}
 */
export function sceneLibraryUses({ scene, theme, themes, variables }) {
  const refs = new Set();
  if (scene?.palette_id) {
    refs.add(scene.palette_id);
  }
  for (const entry of Object.values(scene?.event_palettes || {})) {
    if (entry?.palette_id) {
      refs.add(entry.palette_id);
    }
  }
  const basePalettes = new Set(refs);
  collectRefs(scene?.lights, refs);
  collectRefs(scene?.overrides, refs);
  const themeId = scene?.theme_id || (scene?.kind === "simple" ? null : "default");
  const themeRecord =
    theme && (!themeId || theme.id === themeId)
      ? theme
      : (themes || []).find((item) => item.id === themeId);
  if (themeRecord) {
    collectRefs(themeRecord.events, refs);
  }
  const nested = new Set();
  for (const id of refs) {
    const variable = (variables || []).find((item) => item.id === id);
    if (variableIsPalette(variable)) {
      collectRefs(variable.slots, nested);
    }
  }
  for (const id of nested) {
    refs.add(id);
  }
  const used = [];
  if (themeId && (themes || []).some((item) => item.id === themeId)) {
    used.push({ kind: "theme", id: themeId });
  }
  for (const variable of variables || []) {
    if (!refs.has(variable.id)) {
      continue;
    }
    if (variableIsPalette(variable) && !basePalettes.has(variable.id)) {
      continue;
    }
    used.push({
      kind: variableIsPalette(variable) ? "palette" : "variable",
      id: variable.id,
    });
  }
  const rank = { theme: 0, palette: 1, variable: 2 };
  used.sort((a, b) => rank[a.kind] - rank[b.kind]);
  return used;
}

/**
 * Presets a scene uses directly. The base palette of a simple scene is the
 * corner split, not this list. Slot colors inside a scene preset are not
 * counted again. Theme event colors belong to the theme, not the scene.
 *
 * @returns {{ palettes: {kind: "palette", id: string}[], colors: {kind: "variable", id: string}[] }}
 */
export function scenePresetUses({ scene, variables }) {
  const palettes = [];
  const colors = [];
  const seen = new Set();
  const add = (id) => {
    if (!id || seen.has(id)) {
      return;
    }
    const variable = (variables || []).find((item) => item.id === id);
    if (!variable) {
      return;
    }
    seen.add(id);
    if (variableIsPalette(variable)) {
      palettes.push({ kind: "palette", id });
    } else {
      colors.push({ kind: "variable", id });
    }
  };
  if (!scene) {
    return { palettes, colors };
  }
  if (scene.kind === "simple") {
    const base = scene.palette_id || null;
    for (const light of Object.values(scene.lights || {})) {
      const ref = light?.variable_ref;
      if (!ref || ref === base) {
        continue;
      }
      add(ref);
    }
    return { palettes, colors };
  }
  for (const entry of Object.values(scene.event_palettes || {})) {
    if (entry?.palette_id) {
      add(entry.palette_id);
    }
  }
  const walk = (node) => {
    if (!node || typeof node !== "object") {
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item);
      }
      return;
    }
    if (typeof node.variable_ref === "string") {
      add(node.variable_ref);
    }
    for (const value of Object.values(node)) {
      if (value && typeof value === "object") {
        walk(value);
      }
    }
  };
  walk(scene.overrides);
  return { palettes, colors };
}

/** Scenes whose library uses include this theme, palette, or color variable. */
export function scenesUsingLibraryItem({ kind, id, scenes, themes, variables }) {
  if (!id) {
    return [];
  }
  const hits = [];
  for (const scene of scenes || []) {
    const themeId = scene.theme_id || (scene.kind === "simple" ? null : "default");
    const theme = (themes || []).find((item) => item.id === themeId) || null;
    const uses = sceneLibraryUses({ scene, theme, themes, variables });
    if (uses.some((item) => item.kind === kind && item.id === id)) {
      hits.push(scene);
    }
  }
  return hits;
}
