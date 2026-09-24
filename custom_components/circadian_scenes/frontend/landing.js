/** Area rail, scene cards, and variable/theme library for the list view. */

import { createSimpleCardMesh } from "./card_mesh.js";
import { swatchRgb, variableSwatchCss } from "./color_ui.js";
import { galleryCoverUrl, galleryPalette } from "./gallery.js";
import { PALETTE_SLOT_COUNT, resolveSlot, variableIsPalette } from "./palette.js";
import { sceneLibraryUses } from "./scene_used.js";

const AREA_RAIL_PX = 340;

export const LANDING_CSS = `
  .workspace {
    display: flex;
    align-items: stretch;
    height: 100%;
    min-height: 0;
    gap: 0;
    overflow: hidden;
    position: relative;
  }
  .scene-cover {
    position: absolute;
    inset: -8%;
    z-index: 0;
    background-size: cover;
    background-position: center;
    pointer-events: none;
    opacity: 0;
    filter: blur(48px);
    transition: opacity 480ms ease;
  }
  .scene-cover.is-shown {
    opacity: 0.2;
  }
  .scene-cover.is-leaving {
    opacity: 0;
  }
  .area-rail {
    width: ${AREA_RAIL_PX}px;
    flex: 0 0 ${AREA_RAIL_PX}px;
    max-width: 100%;
    min-height: 0;
    height: 100%;
    border-right: 1px solid var(--divider-color);
    padding: 0;
    box-sizing: border-box;
    /* Sit above dial horizon/vignette; frost so that wash still reads through. */
    position: relative;
    z-index: 8;
    isolation: isolate;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    overscroll-behavior: contain;
    background: color-mix(
      in srgb,
      var(--primary-background-color) 58%,
      transparent
    );
    backdrop-filter: blur(18px) saturate(1.2);
    -webkit-backdrop-filter: blur(18px) saturate(1.2);
  }
  /* Keep scene-card glow (z-index 0) behind every other rail control. */
  .area-rail .floor-label,
  .area-rail .area-head,
  .area-rail .area-empty,
  .area-rail .var-row,
  .area-rail .theme-row {
    position: relative;
    z-index: 1;
  }
  .area-rail :is(
    .floor-label,
    .area-head,
    .floor-block > .floor-label > :not(.sticky-bg),
    .floor-block .area-head > :not(.sticky-bg),
    .area-empty,
    .var-row,
    .theme-row,
    .library-hint,
    .scene-card
  ) {
    transition: opacity 160ms ease;
  }
  /* Selected scene stays put. The rest of the column fades until the pointer
     is over the column, so the open scene is easy to find. */
  .area-rail-tabs {
    display: flex;
    flex: 0 0 auto;
    --header-height: 56px;
  }
  .area-rail-tabs ha-tab {
    flex: 1 1 50%;
    min-width: 0;
    --mdc-icon-size: 24px;
  }
  .area-rail-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
    padding: 0 0 24px;
  }
  .area-rail-body[data-tab="library"] {
    padding: 4px 8px 24px 12px;
  }
  .area-rail-body[hidden] {
    display: none;
  }
  @media (hover: hover) and (pointer: fine) {
    .area-rail-body:not([hidden]):has(.scene-card.selected) :is(
      .floor-block > .floor-label > :not(.sticky-bg),
      .floor-block .area-head > :not(.sticky-bg),
      .area-empty,
      .var-row,
      .theme-row,
      .library-hint,
      .scene-card:not(.selected)
    ) {
      opacity: 0.38;
    }
    .area-rail:hover .area-rail-body:not([hidden]):has(.scene-card.selected) :is(
      .floor-block > .floor-label > :not(.sticky-bg),
      .floor-block .area-head > :not(.sticky-bg),
      .area-empty,
      .var-row,
      .theme-row,
      .library-hint,
      .scene-card:not(.selected)
    ) {
      opacity: 1;
    }
  }
  .scene-used {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 10px;
    flex: 0 0 auto;
    align-self: flex-start;
    min-width: 0;
    max-width: 100%;
    padding: 0 0 4px;
  }
  /* Own row above the time and play controls. Basis is width here. */
  .sun-toolbar-chrome > .scene-used {
    flex: 1 0 100%;
  }
  /* Corner overlay. A flex basis of 100% in the column editor was the height,
     so the list stretched and pushed the wheel off the stage. */
  .simple-editor > .scene-used {
    position: absolute;
    top: 8px;
    left: 16px;
    z-index: 3;
    width: max-content;
    padding: 0;
    pointer-events: none;
  }
  .simple-editor > .scene-used .scene-used-chip,
  .simple-editor > .scene-used .scene-palette-split {
    pointer-events: auto;
  }
  .scene-palette-split {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
  }
  .scene-palette-edit {
    --mdc-icon-button-size: 28px;
    --mdc-icon-size: 18px;
    color: var(--primary-text-color);
  }
  .scene-used-chip.is-placeholder span {
    color: var(--secondary-text-color);
    font-weight: 400;
  }
  .scene-used-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    padding: 2px 2px;
    border: 0;
    background: transparent;
    color: var(--primary-text-color);
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    max-width: 100%;
  }
  .scene-used-chip span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .scene-used-swatch {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    flex: 0 0 auto;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.28);
  }
  .scene-used-swatch.cover {
    width: 28px;
    height: 18px;
    border-radius: 4px;
    object-fit: cover;
  }
  .stage-col {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    /* Visible so horizon / wheel glow can bleed under the frosted rail.
       In-flow scrolling lives on .stage-scroll (overflow-x clip + y auto). */
    overflow: visible;
  }
  .stage-bg {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    overflow: visible;
  }
  .stage-scroll {
    position: relative;
    z-index: 1;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow-x: clip;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .stage-col .sun-path {
    margin-top: 0;
    flex: 0 0 auto;
    width: 100%;
  }
  .library-col {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    padding: 16px 20px 24px;
  }
  .floor-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--secondary-text-color);
    margin: 16px 4px 8px;
  }
  /* Floor titles collapse their areas. The title sticks for the whole floor;
     each area name sticks just under it until the next area pushes it away. */
  .floor-block > .floor-label {
    position: sticky;
    top: 0;
    z-index: 4;
    display: flex;
    align-items: center;
    gap: 2px;
    width: 100%;
    height: 32px;
    margin: 0;
    padding: 0 8px 0 12px;
    border: 0;
    background: none;
    container-type: scroll-state;
    color: var(--secondary-text-color);
    cursor: pointer;
    text-align: left;
    box-sizing: border-box;
  }
  .floor-block > .floor-label ha-icon {
    --mdc-icon-size: 18px;
    flex: 0 0 auto;
    transition: transform 160ms ease;
  }
  .floor-block > .floor-label[aria-expanded="false"] ha-icon {
    transform: rotate(-90deg);
  }
  .floor-areas[hidden] {
    display: none;
  }
  .area-block { margin-bottom: 18px; }
  .scene-cards {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .area-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 4px 8px;
  }
  /* No extra gap under the floor title. A stuck area still sits flush at top: 32px. */
  .floor-areas {
    padding: 0 8px 0 12px;
  }
  .floor-block .area-head {
    position: sticky;
    top: 32px;
    z-index: 3;
    margin: 0 -8px 0 -12px;
    width: calc(100% + 20px);
    padding: 0 0 0 12px;
    box-sizing: border-box;
    background: none;
    overflow: visible;
    container-type: scroll-state;
  }
  .floor-block .area-head .area-add {
    margin-block: -8px;
  }
  .library-block > .area-head {
    position: sticky;
    top: 0;
    z-index: 3;
    margin: 0 -8px 8px -12px;
    width: calc(100% + 20px);
    padding: 4px 8px 4px 12px;
    box-sizing: border-box;
    background: none;
    container-type: scroll-state;
  }
  .sticky-bg {
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
  }
  /* Floor and area fills fade in only after the title sticks. Leaving is instant. */
  .sticky-bg-floor,
  .sticky-bg-area {
    opacity: 0;
    transition: opacity 0s;
  }
  @container scroll-state(stuck: top) {
    .sticky-bg-floor {
      background: color-mix(in srgb, var(--primary-background-color) 92%, transparent);
      opacity: 1;
      transition: opacity 350ms;
    }
    .sticky-bg-library {
      background: var(--primary-background-color);
    }
    .sticky-bg-area {
      background: linear-gradient(
        to bottom,
        color-mix(in srgb, var(--primary-background-color) 92%, transparent) 50%,
        transparent 100%
      );
      opacity: 1;
      transition: opacity 350ms;
    }
  }
  .area-head h2 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
    flex: 1;
  }
  .area-head .floor-label {
    flex: 1;
    margin: 0;
  }
  .area-head > ha-dropdown {
    flex: 0 0 auto;
  }
  .area-block > ha-dropdown {
    display: block;
  }
  .area-add {
    --mdc-icon-button-size: 32px;
    --mdc-icon-size: 22px;
    color: var(--primary-text-color);
  }
  .area-empty {
    border: 1px dashed var(--divider-color);
    border-radius: 12px;
    padding: 14px 12px;
    color: var(--secondary-text-color);
    font-size: 13px;
    cursor: pointer;
    background: transparent;
    width: 100%;
    text-align: left;
  }
  .area-empty:hover { background: var(--secondary-background-color); }
  .scene-card-slot {
    position: relative;
    /* No isolation/overflow clip: glow may bleed into neighbor slots, but
       stays behind every .scene-card (shared stacking, glow z-index 0). */
    overflow: visible;
    box-sizing: border-box;
  }
  .scene-card-slot .card-glow {
    position: absolute;
    inset: 0;
    z-index: 0;
    width: auto;
    height: auto;
    border-radius: 14px;
    overflow: hidden;
    pointer-events: none;
    filter: blur(16px);
    transform: scale(1.1);
    opacity: 0;
    transition: opacity 0.35s cubic-bezier(0.2, 0, 0, 1);
  }
  .scene-card-slot .card-glow.card-mesh {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: fill;
  }
  .scene-card-slot.glow-on .card-glow {
    opacity: 0.55;
  }
  .scene-card {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 64px;
    margin: 0;
    padding: 10px 4px 10px 12px;
    border: 0;
    border-radius: 14px;
    color: #fff;
    cursor: pointer;
    overflow: hidden;
    width: 100%;
    box-sizing: border-box;
    text-align: left;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08);
  }
  /* ha-dropdown is display:contents — margin-left:auto must live on a real box. */
  .scene-card .card-overflow-slot {
    position: relative;
    z-index: 2;
    margin-left: auto;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    color: #fff;
    --mdc-icon-button-size: 36px;
  }
  .scene-card .card-overflow-slot ha-icon-button {
    color: #fff;
  }
  :host(:not([data-dark-mode])) .scene-card.selected {
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.08),
      0 16px 42px rgba(0, 0, 0, 0.16);
  }
  .scene-card.selected::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 4;
    pointer-events: none;
    border-radius: inherit;
    box-shadow: inset 0 0 0 2px #fff;
  }
  .scene-card .card-bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    border-radius: inherit;
    overflow: hidden;
  }
  /* Same overlap as table light rows: later bands fade in over the previous
     (feather = 1/3 of a full bar). No filter:blur(). */
  .scene-card .card-bg-band {
    position: absolute;
    left: 0;
    right: 0;
    pointer-events: none;
  }
  .scene-card .card-icon {
    position: relative;
    z-index: 1;
    flex: 0 0 auto;
    width: 28px;
    height: 28px;
    --mdc-icon-size: 28px;
    color: #fff;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45));
  }
  .scene-card .card-body {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1 1 auto;
  }
  .scene-card .card-name {
    font-weight: 650;
    font-size: 15px;
    text-shadow: 0 1px 2px rgba(0,0,0,0.45);
  }
  .scene-card .card-sub {
    font-size: 12px;
    opacity: 0.88;
    text-shadow: 0 1px 2px rgba(0,0,0,0.4);
  }
  .library-title {
    font-size: 20px;
    font-weight: 650;
    margin: 0 0 6px;
  }
  .library-hint {
    color: var(--secondary-text-color);
    font-size: 13px;
    margin: 0 0 18px;
    max-width: 42em;
  }
  .var-row, .theme-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin: 0 0 16px;
  }
  .var-dot {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.35);
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  }
  .var-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    background: none;
    border: 0;
    color: inherit;
    cursor: pointer;
    padding: 0;
  }
  .var-chip.selected span,
  .theme-chip.selected span {
    color: var(--primary-text-color);
    font-weight: 600;
  }
  /* Same capsule chrome as .hue-presets; five overlapping slot discs. */
  .palette-swatch {
    box-sizing: border-box;
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    min-height: 48px;
    padding: 8px;
    min-width: 0;
    width: max-content;
    max-width: 100%;
    border-radius: 24px;
    box-shadow: 0px 2px 3px rgba(0, 0, 0, 0.4);
    background: var(--surface-2, var(--secondary-background-color, #242022));
    overflow: hidden;
  }
  .var-chip.selected .palette-swatch,
  .var-chip.selected .palette-cover {
    box-shadow:
      inset 0 0 0 2px var(--primary-color),
      0px 2px 3px rgba(0, 0, 0, 0.4);
  }
  .palette-cover {
    width: 96px;
    height: 60px;
    object-fit: cover;
    border-radius: 12px;
    box-shadow: 0px 2px 3px rgba(0, 0, 0, 0.4);
  }
  .palette-slot {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    flex: 0 0 auto;
    border: 2px solid rgba(255, 255, 255, 0.35);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
    position: relative;
    box-sizing: border-box;
  }
  .palette-slot + .palette-slot {
    margin-left: -12px;
  }
  .theme-dial {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    border: 0;
    cursor: pointer;
    overflow: hidden;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
    background-repeat: no-repeat;
    background-position: center;
    background-size: 118% 118%;
  }
  .theme-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    background: none;
    border: 0;
    color: inherit;
    cursor: pointer;
    padding: 0;
  }
  .theme-chip span { font-size: 12px; color: var(--secondary-text-color); }
  .empty-hero {
    max-width: 36em;
    padding: 24px 8px;
  }
  .empty-hero h1 { font-size: 22px; margin: 0 0 8px; }
  .empty-hero p { color: var(--secondary-text-color); line-height: 1.45; }
  .auto-configure {
    margin-top: 16px;
  }
  @media (max-width: 870px) {
    .workspace { flex-direction: column; }
    .area-rail {
      width: 100%;
      flex: 1 1 42%;
      height: auto;
      border-right: 0;
      border-bottom: 1px solid var(--divider-color);
    }
  }
`;

function rgbCss(rgb) {
  if (!rgb || rgb.length < 3) {
    return "rgb(48,48,48)";
  }
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

/** One horizontal day-ramp per light (dawn→dusk). Stack like table rows:
    later bands overlap the previous and fade in over the top third. */
export function applyRampBackground(el, ramps) {
  el.replaceChildren();
  el.style.backgroundImage = "";
  el.style.backgroundSize = "";
  el.style.backgroundPosition = "";
  el.style.backgroundRepeat = "";
  const bands = (ramps || []).filter((ramp) => (ramp.stops || []).length);
  if (!bands.length) {
    el.style.backgroundImage = "linear-gradient(90deg, #2b2b2b, #1c1c1c)";
    return;
  }
  const n = bands.length;
  const visiblePct = 100 / n;
  // Table: 36px feather on a 108px bar (LIGHT_FEATHER_PX / LIGHT_BAR_HEIGHT).
  const featherFrac = 1 / 3;
  bands.forEach((ramp, index) => {
    const stops = ramp.stops;
    const last = Math.max(stops.length - 1, 1);
    const parts = stops.map(
      (rgb, j) => `${rgbCss(rgb)} ${(j / last) * 100}%`
    );
    const layer = document.createElement("div");
    layer.className = "card-bg-band";
    layer.style.backgroundImage = `linear-gradient(90deg, ${parts.join(", ")})`;
    layer.style.zIndex = String(index);
    if (n === 1) {
      layer.style.inset = "0";
    } else if (index === 0) {
      layer.style.top = "0";
      layer.style.height = `${visiblePct}%`;
    } else {
      layer.style.top = `${(index - 0.5) * visiblePct}%`;
      layer.style.height = `${1.5 * visiblePct}%`;
      const fade = `linear-gradient(to bottom, transparent 0%, #000 ${featherFrac * 100}%, #000 100%)`;
      layer.style.webkitMaskImage = fade;
      layer.style.maskImage = fade;
    }
    el.appendChild(layer);
  });
}

const THEME_CARD_EVENTS = ["dawn", "sunrise", "noon", "sunset", "dusk"];

function themeEventResolved(ev, variables) {
  const ref = ev?.color?.variable_ref;
  const variable = ref
    ? (variables || []).find((item) => item.id === ref)
    : null;
  if (variableIsPalette(variable)) {
    const slot = resolveSlot(variable, 0, variables);
    return {
      color: slot,
      brightness: ev?.brightness ?? slot.brightness ?? 255,
    };
  }
  return {
    color: variable ? variable.color : ev?.color,
    brightness: variable?.brightness ?? ev?.brightness ?? 255,
  };
}

function themeEventSwatchRgb(ev, variables) {
  const { color, brightness } = themeEventResolved(ev, variables);
  if (!color) {
    return [43, 43, 43];
  }
  return swatchRgb(color, brightness);
}

/** Client ramps for a circadian card while a theme draft is being dragged. */
export function previewRampsForTheme(scene, theme, variables, overrides) {
  const ovRoot = overrides || scene.overrides || {};
  return (scene.card?.ramps || []).map((ramp) => {
    const lightOv = ovRoot[ramp.entity_id] || {};
    return {
      entity_id: ramp.entity_id,
      stops: THEME_CARD_EVENTS.map((event) => {
        const ov = lightOv[event];
        if (ov) {
          return swatchRgb(ov, ov.brightness);
        }
        return themeEventSwatchRgb(theme?.events?.[event], variables);
      }),
    };
  });
}

export function themeConic(theme, variables) {
  const events = THEME_CARD_EVENTS;
  const colors = events.map((event) => {
    const { color, brightness } = themeEventResolved(
      theme.events?.[event],
      variables
    );
    if (!color) {
      return "#444";
    }
    return variableSwatchCss({ color, brightness });
  });
  const [dawn, sunrise, noon, sunset, dusk] = colors;
  // from 180deg: midnight at the bottom, noon at the top (same as the dial).
  // Place knots on the clock, not in equal pie slices, so dusk→dawn fills the
  // night arc out to the rim instead of leaving a dawn wedge on midnight.
  return `conic-gradient(from 180deg, ${dusk} 0%, ${dawn} 23%, ${sunrise} 27%, ${noon} 50%, ${sunset} 79%, ${dusk} 87%, ${dusk} 100%)`;
}

function iconButton(iconName, label) {
  const add = document.createElement("ha-icon-button");
  add.className = "area-add";
  add.label = label;
  const icon = document.createElement("ha-icon");
  icon.setAttribute("icon", iconName);
  add.appendChild(icon);
  return add;
}

export function renderLanding(panel, { includeStage = true } = {}) {
  const page = document.createElement("div");
  page.className = "workspace";
  const coverUrl = sceneCoverUrl(panel);
  if (coverUrl) {
    const cover = document.createElement("div");
    cover.className = "scene-cover";
    cover.style.backgroundImage = `url("${coverUrl}")`;
    page.appendChild(cover);
  }

  const rail = document.createElement("div");
  rail.className = "area-rail";
  const tabs = document.createElement("div");
  tabs.className = "area-rail-tabs";
  const tab = panel._railTab === "library" ? "library" : "scenes";
  for (const [id, label, iconName] of [
    ["scenes", panel._t("frontend.library.tab_scenes", "Scenes"), "mdi:palette"],
    ["library", panel._t("frontend.library.tab_library", "Library"), "mdi:bookshelf"],
  ]) {
    const button = document.createElement("ha-tab");
    button.dataset.tab = id;
    button.name = label;
    button.active = id === tab;
    const icon = document.createElement("ha-icon");
    icon.slot = "icon";
    icon.setAttribute("icon", iconName);
    button.appendChild(icon);
    button.addEventListener("click", () => panel._setRailTab(id));
    tabs.appendChild(button);
  }
  const scenesBody = document.createElement("div");
  scenesBody.className = "area-rail-body";
  scenesBody.dataset.tab = "scenes";
  scenesBody.hidden = tab !== "scenes";
  const libraryBody = document.createElement("div");
  libraryBody.className = "area-rail-body";
  libraryBody.dataset.tab = "library";
  libraryBody.hidden = tab !== "library";
  libraryBody.appendChild(renderLibrary(panel, { compact: true }));
  rail.append(tabs, scenesBody, libraryBody);

  const floors = panel._floors || [];
  const items = panel._items || [];
  const byArea = new Map();
  for (const item of items) {
    const key = item.area || "";
    if (!byArea.has(key)) {
      byArea.set(key, []);
    }
    byArea.get(key).push(item);
  }

  if (!floors.length) {
    const empty = document.createElement("p");
    empty.className = "library-hint";
    empty.textContent = panel._t(
      "frontend.empty.no_areas",
      "No Home Assistant areas yet. Add floors and areas in Settings, then come back."
    );
    scenesBody.appendChild(empty);
  }

  for (const floor of floors) {
    scenesBody.appendChild(renderFloorBlock(panel, floor, byArea));
  }

  if (panel._narrow) {
    page.appendChild(rail);
    return page;
  }

  page.appendChild(rail);
  if (includeStage) {
    const { stage, scroll } = makeStageCol();
    if (
      panel._view !== "edit" &&
      panel._view !== "theme" &&
      panel._view !== "variable" &&
      panel._view !== "palette"
    ) {
      if (!items.length) {
        scroll.appendChild(renderEmptyHero(panel));
      } else {
        scroll.appendChild(renderSelectEmpty(panel));
      }
    }
    page.appendChild(stage);
  }
  return page;
}

function makeStageCol() {
  const stage = document.createElement("div");
  stage.className = "stage-col";
  const bg = document.createElement("div");
  bg.className = "stage-bg";
  bg.setAttribute("aria-hidden", "true");
  const scroll = document.createElement("div");
  scroll.className = "stage-scroll";
  stage.append(bg, scroll);
  return { stage, bg, scroll };
}

function stickyBg(kind) {
  const bg = document.createElement("span");
  bg.className = `sticky-bg sticky-bg-${kind}`;
  bg.setAttribute("aria-hidden", "true");
  return bg;
}

function sceneCoverUrl(panel) {
  const builtinFor = (builtin) =>
    builtin && galleryPalette(builtin) ? galleryCoverUrl(builtin) : "";
  if (panel._view === "palette") {
    return builtinFor(panel._variableDraft?.builtin_id);
  }
  if (panel._view !== "edit") {
    return "";
  }
  const paletteId = panel._formData?.palette_id;
  if (!paletteId) {
    return "";
  }
  const variable = (panel._variables || []).find((item) => item.id === paletteId);
  const builtin = variable?.builtin_id;
  if (!builtin || !galleryPalette(builtin)) {
    return "";
  }
  return galleryCoverUrl(builtin);
}

function renderFloorBlock(panel, floor, byArea) {
  const block = document.createElement("div");
  block.className = "floor-block";
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "floor-label";
  const collapsed = panel._collapsedFloors?.has(floor.id);
  toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  const chevron = document.createElement("ha-icon");
  chevron.setAttribute("icon", "mdi:chevron-down");
  const name = document.createElement("span");
  name.textContent =
    floor.name || panel._t("frontend.common.other_areas", "Other areas");
  toggle.append(stickyBg("floor"), chevron, name);
  const areas = document.createElement("div");
  areas.className = "floor-areas";
  areas.hidden = Boolean(collapsed);
  for (const area of floor.areas || []) {
    areas.appendChild(renderAreaBlock(panel, area, byArea.get(area.id) || []));
  }
  toggle.addEventListener("click", () => {
    const set = panel._collapsedFloors || (panel._collapsedFloors = new Set());
    const next = !set.has(floor.id);
    if (next) {
      set.add(floor.id);
    } else {
      set.delete(floor.id);
    }
    toggle.setAttribute("aria-expanded", next ? "false" : "true");
    areas.hidden = next;
  });
  block.append(toggle, areas);
  return block;
}

function renderAreaBlock(panel, area, scenes) {
  const block = document.createElement("div");
  block.className = "area-block";
  const head = document.createElement("div");
  head.className = "area-head";
  const title = document.createElement("h2");
  title.textContent = area.name;
  const add = iconButton(
    "mdi:plus",
    panel._t("frontend.actions.add_scene", "Add scene")
  );
  head.append(
    stickyBg("area"),
    title,
    panel._areaCreateDropdown(add, { areaId: area.id, areaName: area.name })
  );
  block.appendChild(head);
  if (!scenes.length) {
    const empty = document.createElement("button");
    empty.type = "button";
    empty.className = "area-empty";
    empty.textContent = panel._t(
      "frontend.empty.area_no_scenes",
      "No scenes yet — create one for this area"
    );
    block.appendChild(
      panel._areaCreateDropdown(empty, { areaId: area.id, areaName: area.name })
    );
    return block;
  }
  const cards = document.createElement("div");
  cards.className = "scene-cards";
  for (const scene of scenes) {
    cards.appendChild(renderSceneCard(panel, scene));
  }
  block.appendChild(cards);
  return block;
}

function makeSceneCardBg(scene) {
  if (scene.kind === "simple") {
    return createSimpleCardMesh(scene.card?.dots);
  }
  const bg = document.createElement("div");
  bg.className = "card-bg";
  applyRampBackground(bg, scene.card?.ramps);
  return bg;
}

function sceneCardIcon(scene) {
  const icon = scene.icon || scene.form?.icon;
  if (icon) {
    return icon;
  }
  return scene.kind === "simple" ? "mdi:palette" : "mdi:auto-fix";
}

function renderSceneCard(panel, scene) {
  const slot = document.createElement("div");
  slot.className = "scene-card-slot";
  const cardEl = document.createElement("div");
  cardEl.className = "scene-card";
  cardEl.dataset.sceneId = scene.id;
  const selected = panel._view === "edit" && panel._editId === scene.id;
  cardEl.setAttribute("role", "button");
  cardEl.tabIndex = 0;
  cardEl.setAttribute("aria-pressed", selected ? "true" : "false");
  const bg = makeSceneCardBg(scene);
  const body = document.createElement("div");
  body.className = "card-body";
  const name = document.createElement("div");
  name.className = "card-name";
  name.textContent =
    scene.scene_name ||
    scene.name ||
    panel._t("frontend.common.untitled", "Untitled");
  const sub = document.createElement("div");
  sub.className = "card-sub";
  sub.textContent =
    scene.kind === "simple"
      ? panel._t("frontend.kinds.simple", "Scene")
      : panel._t("frontend.kinds.circadian", "Circadian scene");
  body.append(name, sub);
  const icon = document.createElement("ha-icon");
  icon.className = "card-icon";
  icon.setAttribute("icon", sceneCardIcon(scene));
  const overflowSlot = document.createElement("div");
  overflowSlot.className = "card-overflow-slot";
  if (panel._nameIsPlaceholder?.(scene.scene_name)) {
    const rename = iconButton(
      "mdi:pencil",
      panel._t("frontend.common.rename", "Rename")
    );
    rename.classList.add("card-rename");
    rename.addEventListener("click", (ev) => {
      ev.stopPropagation();
      void panel._openListSceneMetaDialog(scene);
    });
    overflowSlot.appendChild(rename);
  }
  const overflow = panel._listSceneOverflowMenu(scene);
  overflow.classList.add("card-overflow");
  overflowSlot.appendChild(overflow);
  cardEl.append(bg, icon, body, overflowSlot);
  const glowArt = makeSceneCardBg(scene);
  glowArt.classList.add("card-glow");
  let glow = glowArt;
  if (glowArt.tagName === "CANVAS") {
    glow = document.createElement("div");
    glow.className = "card-glow";
    glowArt.classList.remove("card-glow");
    glowArt.style.width = "100%";
    glowArt.style.height = "100%";
    glowArt.style.display = "block";
    glowArt.style.objectFit = "fill";
    glow.appendChild(glowArt);
  }
  slot.append(glow, cardEl);
  if (selected) {
    cardEl.classList.add("selected");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => slot.classList.add("glow-on"));
    });
  }
  let leaving = false;
  const activate = () => {
    if (leaving) {
      return;
    }
    if (selected) {
      leaving = true;
      slot.classList.remove("glow-on");
      cardEl.classList.remove("selected");
      panel._go("");
      return;
    }
    panel._go(`edit/${scene.id}`);
  };
  cardEl.addEventListener("click", (ev) => {
    if (ev.target.closest?.("ha-dropdown, ha-icon-button")) {
      return;
    }
    activate();
  });
  cardEl.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" && ev.key !== " ") {
      return;
    }
    if (ev.target.closest?.("ha-dropdown, ha-icon-button")) {
      return;
    }
    ev.preventDefault();
    activate();
  });
  return slot;
}

function renderEmptyHero(panel) {
  const el = panel._buildEmptyState({
    icon: "mdi:white-balance-sunny",
    title: panel._t(
      "frontend.empty.extrapolation_title",
      "Start lighting with the sun"
    ),
    paragraphs: [
      panel._t(
        "frontend.empty.extrapolation_body",
        "Circadian Scenes blend your room’s lights between solar events — dawn, sunrise, noon, sunset, and dusk — so brightness and color follow the day."
      ),
      panel._t(
        "frontend.empty.auto_configure_body",
        "Auto configure creates a circadian scene for every area that has lights, using the default theme. You can edit variables and themes here anytime — lights update the next time a scene runs."
      ),
    ],
    learnMore: true,
  });
  const btn = document.createElement("ha-button");
  btn.className = "auto-configure";
  btn.textContent = panel._t(
    "frontend.actions.auto_configure",
    "Auto configure"
  );
  btn.addEventListener("click", () => panel._autoConfigure());
  el.appendChild(btn);
  return el;
}

function renderSelectEmpty(panel) {
  return panel._buildEmptyState({
    icon: "mdi:white-balance-sunny",
    title: panel._t(
      "frontend.empty.extrapolation_title",
      "Start lighting with the sun"
    ),
    paragraphs: [
      panel._t(
        "frontend.empty.extrapolation_body",
        "Circadian Scenes blend your room’s lights between solar events — dawn, sunrise, noon, sunset, and dusk — so brightness and color follow the day."
      ),
      panel._t(
        "frontend.empty.select_scene_body",
        "Choose a scene from the list to edit its lights through the day, or add a scene from an area."
      ),
    ],
    learnMore: true,
  });
}

export function createPaletteChip(palette, catalog, { selected = false, onClick } = {}) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "var-chip";
  chip.dataset.itemId = palette?.id || "";
  if (selected) {
    chip.classList.add("selected");
  }
  const cover = galleryPalette(palette?.builtin_id);
  if (cover) {
    chip.classList.add("has-cover");
    const photo = document.createElement("img");
    photo.className = "palette-cover";
    photo.alt = "";
    photo.src = galleryCoverUrl(cover.id);
    const name = document.createElement("span");
    name.textContent = palette.name;
    chip.append(photo, name);
    if (onClick) {
      chip.addEventListener("click", (ev) => {
        ev.preventDefault();
        onClick();
      });
    }
    return chip;
  }
  const swatch = document.createElement("div");
  swatch.className = "palette-swatch";
  for (let i = 0; i < PALETTE_SLOT_COUNT; i += 1) {
    const slot = resolveSlot(palette, i, catalog);
    const disc = document.createElement("span");
    disc.className = "palette-slot";
    disc.style.zIndex = String(i + 1);
    disc.style.background = variableSwatchCss(
      { color: slot, brightness: slot.brightness, kind: "color" },
      catalog
    );
    swatch.appendChild(disc);
  }
  const name = document.createElement("span");
  name.textContent = palette.name;
  chip.append(swatch, name);
  if (onClick) {
    chip.addEventListener("click", (ev) => {
      ev.preventDefault();
      onClick();
    });
  }
  return chip;
}

function renderLibrary(panel, { compact } = {}) {
  const wrap = document.createElement("div");
  if (!compact) {
    const title = document.createElement("h1");
    title.className = "library-title";
    title.textContent = panel._t("frontend.library.title", "Variables & themes");
    const hint = document.createElement("p");
    hint.className = "library-hint";
    hint.textContent = panel._t(
      "frontend.library.hint",
      "Changing a variable or theme updates scenes that still use it. Lights change on the next activate or automatic update — not instantly."
    );
    wrap.append(title, hint);
  }

  const colors = (panel._variables || []).filter((item) => !variableIsPalette(item));
  const palettes = (panel._variables || []).filter((item) => variableIsPalette(item));

  const varHead = document.createElement("div");
  varHead.className = "area-head";
  const varLabel = document.createElement("div");
  varLabel.className = "floor-label";
  varLabel.textContent = panel._t("frontend.library.variables", "Variables");
  const addVar = iconButton(
    "mdi:plus",
    panel._t("frontend.library.add_variable", "Add variable")
  );
  addVar.addEventListener("click", (ev) => {
    ev.stopPropagation();
    panel._openCreateVariableDialog();
  });
  varHead.append(stickyBg("library"), varLabel, addVar);

  const varRow = document.createElement("div");
  varRow.className = "var-row";
  for (const variable of colors) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "var-chip";
    chip.dataset.itemId = variable.id;
    if (panel._view === "variable" && panel._variableId === variable.id) {
      chip.classList.add("selected");
    }
    const dot = document.createElement("div");
    dot.className = "var-dot";
    dot.style.background = variableSwatchCss(variable, panel._variables);
    const name = document.createElement("span");
    name.textContent = variable.name;
    chip.append(dot, name);
    chip.addEventListener("click", () => panel._openVariableEditor(variable));
    varRow.appendChild(chip);
  }
  wrap.appendChild(libraryBlock(varHead, varRow));

  const palHead = document.createElement("div");
  palHead.className = "area-head";
  const palLabel = document.createElement("div");
  palLabel.className = "floor-label";
  palLabel.textContent = panel._t("frontend.library.palettes", "Palettes");
  const addPal = iconButton(
    "mdi:plus",
    panel._t("frontend.library.add_palette", "Add palette")
  );
  addPal.addEventListener("click", (ev) => {
    ev.stopPropagation();
    panel._openCreatePaletteDialog();
  });
  palHead.append(stickyBg("library"), palLabel, addPal);

  const palRow = document.createElement("div");
  palRow.className = "var-row";
  for (const palette of palettes) {
    const chip = createPaletteChip(palette, panel._variables, {
      selected: panel._view === "palette" && panel._variableId === palette.id,
      onClick: () => panel._openPaletteEditor(palette),
    });
    palRow.appendChild(chip);
  }
  wrap.appendChild(libraryBlock(palHead, palRow));

  const themeHead = document.createElement("div");
  themeHead.className = "area-head";
  const themeLabel = document.createElement("div");
  themeLabel.className = "floor-label";
  themeLabel.textContent = panel._t("frontend.library.themes", "Circadian themes");
  const addTheme = iconButton(
    "mdi:plus",
    panel._t("frontend.library.add_theme", "Add theme")
  );
  addTheme.addEventListener("click", (ev) => {
    ev.stopPropagation();
    panel._openCreateThemeDialog();
  });
  themeHead.append(stickyBg("library"), themeLabel, addTheme);

  const themeRow = document.createElement("div");
  themeRow.className = "theme-row";
  for (const theme of panel._themes || []) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "theme-chip";
    chip.dataset.itemId = theme.id;
    chip.dataset.themeId = theme.id;
    if (panel._view === "theme" && panel._themeId === theme.id) {
      chip.classList.add("selected");
    }
    const dial = document.createElement("div");
    dial.className = "theme-dial";
    dial.style.background = themeConic(theme, panel._variables || []);
    const name = document.createElement("span");
    name.textContent = theme.name;
    chip.append(dial, name);
    chip.addEventListener("click", () => panel._openThemeEditor(theme));
    themeRow.appendChild(chip);
  }
  wrap.appendChild(libraryBlock(themeHead, themeRow));
  return wrap;
}

function libraryBlock(head, body) {
  const block = document.createElement("div");
  block.className = "library-block";
  block.append(head, body);
  return block;
}

export function renderSceneUsed(panel) {
  if (panel._view !== "edit" || !panel._formData) {
    return null;
  }
  const uses = sceneLibraryUses({
    scene: panel._formData,
    theme: panel._themeDraft,
    themes: panel._themes,
    variables: panel._variables,
  }).filter((item) => item.kind !== "palette");
  const row = document.createElement("div");
  row.className = "scene-used";
  row.appendChild(renderBasePaletteSplit(panel));
  for (const item of uses) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "scene-used-chip";
    const swatch = document.createElement("span");
    swatch.className = "scene-used-swatch";
    const name = document.createElement("span");
    if (item.kind === "theme") {
      const theme = (panel._themes || []).find((entry) => entry.id === item.id);
      name.textContent = theme?.name || item.id;
      swatch.style.background = theme
        ? themeConic(theme, panel._variables || [])
        : "";
      button.addEventListener("click", () => panel._go(`theme/${item.id}`));
    } else {
      const variable = (panel._variables || []).find((entry) => entry.id === item.id);
      name.textContent = variable?.name || item.id;
      swatch.style.background = variableSwatchCss(variable, panel._variables);
      button.addEventListener("click", () => panel._go(`variable/${item.id}`));
    }
    button.append(swatch, name);
    button.setAttribute("aria-label", name.textContent);
    row.appendChild(button);
  }
  return row;
}

function renderBasePaletteSplit(panel) {
  const split = document.createElement("div");
  split.className = "scene-palette-split";
  const base = panel._sceneBasePalette?.() || null;
  const paletteId = base?.palette_id || null;
  const variable = paletteId
    ? (panel._variables || []).find((entry) => entry.id === paletteId)
    : null;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "scene-used-chip";
  const name = document.createElement("span");
  if (!variable) {
    button.classList.add("is-placeholder");
    name.textContent = panel._t(
      "frontend.dialogs.scene_palette_select",
      "Select a palette"
    );
  } else {
    name.textContent = variable.name || paletteId;
    appendPaletteFace(button, variable, panel._variables);
  }
  button.appendChild(name);
  button.setAttribute("aria-label", name.textContent);
  button.addEventListener("click", () => panel._pickSceneBasePalette?.());
  split.appendChild(button);
  if (paletteId) {
    const edit = document.createElement("ha-icon-button");
    edit.className = "scene-palette-edit";
    edit.label = panel._t("frontend.dialogs.scene_palette_edit", "Edit palette");
    const icon = document.createElement("ha-icon");
    icon.setAttribute("icon", "mdi:pencil");
    edit.appendChild(icon);
    edit.addEventListener("click", (ev) => {
      ev.stopPropagation();
      panel._go(`palette/${paletteId}`);
    });
    split.appendChild(edit);
  }
  return split;
}

function appendPaletteFace(button, variable, catalog) {
  const cover = galleryPalette(variable?.builtin_id);
  if (cover) {
    const photo = document.createElement("img");
    photo.className = "scene-used-swatch cover";
    photo.alt = "";
    photo.src = galleryCoverUrl(cover.id);
    button.appendChild(photo);
    return;
  }
  const swatch = document.createElement("span");
  swatch.className = "scene-used-swatch";
  if (variableIsPalette(variable)) {
    const slot = variable?.slots?.[0] || {};
    swatch.style.background = variableSwatchCss(
      { ...(slot.color || {}), brightness: slot.brightness },
      catalog
    );
  } else {
    swatch.style.background = variableSwatchCss(variable, catalog);
  }
  button.appendChild(swatch);
}
