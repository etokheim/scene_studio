/** Display names for lights and scenes that already sit under an area. */

const GENERIC_LIGHT_NAMES = new Set(["light", "lights"]);

export function isGenericLightName(name) {
  return GENERIC_LIGHT_NAMES.has(String(name || "").trim().toLowerCase());
}

/** Drop a leading area name when a separator follows it. Never return empty. */
export function stripAreaPrefix(name, areaName) {
  const raw = String(name || "").trim();
  const area = String(areaName || "").trim();
  if (!raw || !area || raw.length <= area.length) {
    return raw;
  }
  if (raw.slice(0, area.length).toLowerCase() !== area.toLowerCase()) {
    return raw;
  }
  const boundary = raw.charAt(area.length);
  if (!/[\s\-–—:|/]/.test(boundary)) {
    return raw;
  }
  let rest = raw.slice(area.length).trim();
  rest = rest.replace(/^[-–—:|/]+\s*/, "").trim();
  return rest || raw;
}

/**
 * Prefer a real entity name. "Light" is the HA default when the name lives
 * on the device, so the device name wins in that case.
 */
export function lightDisplayName({
  friendlyName = "",
  deviceName = "",
  entityId = "",
  areaName = "",
} = {}) {
  const friendly = String(friendlyName || "").trim();
  const device = String(deviceName || "").trim();
  let name = friendly;
  if (!name || isGenericLightName(name)) {
    name =
      device ||
      friendly ||
      String(entityId || "")
        .replace(/^light\./, "")
        .replace(/_/g, " ");
  }
  return stripAreaPrefix(name, areaName);
}

/** Normal scenes, then hidden, then disabled. Name order inside each bucket. */
export function sceneListRank(scene) {
  if (scene?.disabled) {
    return 2;
  }
  if (scene?.hidden) {
    return 1;
  }
  return 0;
}

export function compareScenesForList(a, b) {
  const rank = sceneListRank(a) - sceneListRank(b);
  if (rank) {
    return rank;
  }
  return String(a?.scene_name || a?.name || "").localeCompare(
    String(b?.scene_name || b?.name || ""),
    undefined,
    { sensitivity: "base" }
  );
}
