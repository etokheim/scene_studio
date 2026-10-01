/** Field-wise editor reconciliation. Arrays and color/membership are atomic. */

const MISSING = Symbol("missing");
const ATOMIC = new Set(["color", "membership", "slots", "labels", "include", "exclude", "brightness_adjustment"]);

function equal(left, right) {
  if (left === right) return true;
  if (left === MISSING || right === MISSING || !left || !right) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) &&
      left.length === right.length && left.every((value, index) => equal(value, right[index]));
  }
  if (typeof left !== "object" || typeof right !== "object") return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length &&
    keys.every((key) => Object.hasOwn(right, key) && equal(left[key], right[key]));
}

const copy = (value) => value === MISSING ? MISSING : structuredClone(value);
const valueAt = (object, key) => Object.hasOwn(object, key) ? object[key] : MISSING;

/** Decide which rail cards need fresh content without rebuilding the rail itself. */
export function railCatalogChanges(before, after) {
  const shape = (catalog) => JSON.stringify({
    floors: catalog.floors || [],
    scenes: (catalog.scenes || []).map(({ id, area, kind }) => [id, area, kind]),
    themes: (catalog.themes || []).map(({ id }) => id),
    variables: (catalog.variables || []).map(({ id, kind }) => [id, kind]),
  });
  const previousScenes = new Map((before.scenes || []).map((item) => [item.id, item]));
  return {
    rebuild: shape(before) !== shape(after),
    sceneIds: new Set((after.scenes || [])
      .filter((item) => JSON.stringify(previousScenes.get(item.id)) !== JSON.stringify(item))
      .map((item) => item.id)),
    sharedChanged: JSON.stringify(before.themes || []) !== JSON.stringify(after.themes || []) ||
      JSON.stringify(before.variables || []) !== JSON.stringify(after.variables || []),
  };
}

export function mergeFields(base, local, saved) {
  const conflicts = [];
  function merge(before, mine, theirs, path) {
    if (equal(mine, before)) return copy(theirs);
    if (equal(theirs, before) || equal(mine, theirs)) return copy(mine);
    if ((before === MISSING || before && typeof before === "object" && !Array.isArray(before)) &&
        mine && theirs && mine !== MISSING && theirs !== MISSING &&
        !Array.isArray(mine) && !Array.isArray(theirs) &&
        typeof mine === "object" && typeof theirs === "object" &&
        !ATOMIC.has(path.at(-1))) {
      before = before === MISSING ? {} : before;
      const result = {};
      for (const key of new Set([...Object.keys(before), ...Object.keys(mine), ...Object.keys(theirs)])) {
        const value = merge(valueAt(before, key), valueAt(mine, key), valueAt(theirs, key), [...path, key]);
        if (value !== MISSING) result[key] = value;
      }
      return result;
    }
    conflicts.push(path.join(".") || "item");
    return copy(mine);
  }
  return { value: merge(base, local, saved, []), conflicts: conflicts.sort() };
}

/** A late save must merge the draft that exists when its response arrives. */
export function reconcileSaveResponse(sent, draft, saved) {
  const result = mergeFields(sent, draft, saved);
  return {
    ...result,
    changedDuringSave: !equal(sent, draft),
  };
}

export function useSavedField(local, saved, field) {
  const path = field.split(".");
  const result = structuredClone(local);
  let source = saved;
  let target = result;
  for (const key of path.slice(0, -1)) {
    source = source?.[key];
    target = target[key] ?? (target[key] = {});
  }
  const key = path.at(-1);
  if (source && Object.hasOwn(source, key)) target[key] = structuredClone(source[key]);
  else delete target[key];
  return result;
}

/** Keep editor objects captured by mounted controls while updating their data. */
export function patchInPlace(target, source) {
  if (Array.isArray(target) && Array.isArray(source)) {
    target.splice(0, target.length, ...structuredClone(source));
    return target;
  }
  if (target && source && typeof target === "object" && typeof source === "object" &&
      !Array.isArray(target) && !Array.isArray(source)) {
    for (const key of Object.keys(target)) {
      if (!Object.hasOwn(source, key)) delete target[key];
    }
    for (const [key, value] of Object.entries(source)) {
      target[key] = patchInPlace(target[key], value);
    }
    return target;
  }
  return structuredClone(source);
}
