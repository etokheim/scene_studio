/** Treat an unfetched area catalog differently from a confirmed empty one. */
export function showNoAreasMessage(loaded, floors) {
  return Boolean(loaded && Array.isArray(floors) && floors.length === 0);
}

/** Both Live edit controls default to on when this browser has no preference. */
export function defaultOnPreference(raw) {
  return raw !== "0" && raw !== "false";
}

export function mobileSceneOnboarding(narrow, tab, sceneCount) {
  return Boolean(narrow && tab === "scenes" && sceneCount === 0);
}

export function mobileAutoConfigureCard(narrow, tab, sceneCount, listVisible) {
  return mobileSceneOnboarding(narrow, tab, sceneCount) && Boolean(listVisible);
}

export function libraryColorTarget(currentId, clickedId) {
  return currentId === clickedId ? "variables" : `variable/${clickedId}`;
}

/** Zero scene cards cannot tell us whether the area catalog has arrived. */
export function sceneRailCatalogKey(floors, scenes) {
  return JSON.stringify([floors, scenes.map(({ id, area }) => [id, area])]);
}
