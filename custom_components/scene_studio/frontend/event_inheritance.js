/** Per-field circadian inheritance, before capability adaptation. */
import { draftRgb } from "./color_ui.js";
import { assignmentTR, samplePaletteWheel, variableIsPalette } from "./palette.js";

export const EVENT_COLOR_FIELDS = ["color_mode", "color_temp_kelvin", "hs_color", "xy_color", "rgb_color", "rgbw_color", "rgbww_color", "white", "variable_ref", "palette_t", "palette_r", "assignment_seed"];
const colorValue = draft => Object.fromEntries(EVENT_COLOR_FIELDS.filter(key => draft[key] !== undefined).map(key => [key, draft[key]]));

function resolveColor(source, entityId, seed, variables) {
  if (!source.variable_ref) return { ...source };
  const variable = variables.find(item => item.id === source.variable_ref);
  if (!variable) throw new Error(`Missing preset ${source.variable_ref}`);
  if (!variableIsPalette(variable)) return { ...variable.color, ...source, brightness: variable.brightness };
  const point = source.palette_t != null && source.palette_r != null
    ? { t: source.palette_t, r: source.palette_r } : assignmentTR(entityId, seed);
  const sampled = samplePaletteWheel(variable, point.t, point.r, variables, draftRgb);
  return { ...source, assignment_seed: seed, color_mode: "rgb", rgb_color: sampled.rgb, brightness: sampled.brightness };
}

export function resolveEventDraft(scene, theme, eventId, entityId, variables) {
  const event = theme?.events?.[eventId];
  if (!event) throw new Error(`Missing circadian event ${eventId}`);
  const assignment = scene?.event_palettes?.[eventId];
  const source = assignment?.palette_id ? { variable_ref: assignment.palette_id } : event.color || {};
  const inheritedColor = resolveColor(source, entityId, assignment?.assignment_seed ?? event.assignment_seed ?? 0, variables);
  const inherited = { state: "on", ...inheritedColor, brightness: inheritedColor.brightness ?? event.brightness };
  inherited.brightness = adjustedEventBrightness(inherited.brightness, assignment?.brightness_adjustment);
  const override = scene?.overrides?.[entityId]?.[eventId] || {};
  const color = colorValue(override);
  if (Object.keys(color).length) {
    for (const key of EVENT_COLOR_FIELDS) delete inherited[key];
    const resolved = resolveColor(color, entityId, color.assignment_seed ?? event.assignment_seed ?? 0, variables);
    delete resolved.brightness;
    Object.assign(inherited, resolved);
  }
  for (const key of ["brightness", "state", "effect"]) if (Object.hasOwn(override, key)) inherited[key] = override[key];
  return inherited;
}

/** Persist a user's changed fields, leaving unchanged inherited fields linked. */
export function eventOverrideAfterEdit(stored, before, after) {
  const result = structuredClone(stored || {});
  for (const key of ["brightness", "state", "effect"]) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      if (after[key] === undefined) delete result[key];
      else result[key] = structuredClone(after[key]);
    }
  }
  if (JSON.stringify(colorValue(before)) !== JSON.stringify(colorValue(after))) {
    for (const key of EVENT_COLOR_FIELDS) delete result[key];
    Object.assign(result, structuredClone(colorValue(after)));
  }
  return result;
}

/** A capped scale also preserves saturation across successive gestures. */
export function adjustedEventBrightness(brightness, adjustment) {
  if (!adjustment) return brightness;
  if (adjustment.level != null) return Math.round(adjustment.level);
  return Math.round(Math.min(adjustment.ceiling, brightness * adjustment.scale));
}

export function eventBrightnessAdjustment(previous, from, to) {
  if (![from, to].every(Number.isFinite) || from < 0 || to < 0 || to > 255) throw new Error("Invalid event brightness gesture");
  if (from === 0 || previous?.level != null) return { level: to };
  const ratio = to / from;
  const scale = (previous?.scale ?? 1) * ratio;
  if (!Number.isFinite(scale)) throw new Error("Event brightness scale overflow");
  return { scale, ceiling: Math.min(255, (previous?.ceiling ?? 255) * ratio) };
}
