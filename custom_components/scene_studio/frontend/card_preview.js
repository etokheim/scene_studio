/** Effective event references for a whole-day circadian thumbnail. */
export function circadianPreviewTheme(scene, theme) {
  const events = {};
  for (const id of ["dawn", "sunrise", "noon", "sunset", "dusk"]) {
    const source = theme?.events?.[id] || {};
    const assigned = scene.event_palettes?.[id];
    events[id] = assigned?.palette_id
      ? { ...source, color: { variable_ref: assigned.palette_id }, brightness: undefined }
      : { ...source };
  }
  return { ...theme, events };
}
