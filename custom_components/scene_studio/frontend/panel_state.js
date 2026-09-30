/** Treat an unfetched area catalog differently from a confirmed empty one. */
export function showNoAreasMessage(loaded, floors) {
  return Boolean(loaded && Array.isArray(floors) && floors.length === 0);
}

/** Both Live edit controls default to on when this browser has no preference. */
export function defaultOnPreference(raw) {
  return raw !== "0" && raw !== "false";
}
