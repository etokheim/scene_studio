/** Area rail, scene cards, and variable/theme library for the list view. */

import { createSimpleCardMesh } from "./card_mesh.js";
import { swatchRgb, variableSwatchCss } from "./color_ui.js";
import { galleryCoverUrl, galleryPalette } from "./gallery.js";
import { PALETTE_SLOT_COUNT, resolveSlot, variableIsPalette } from "./palette.js";
import { sceneLibraryUses, scenesUsingLibraryItem } from "./scene_used.js";

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
    /* Opaque app-header surface. The rail below stays frosted; the tab bar
       should read as the same bar as the HA header. */
    background: var(--app-header-background-color, var(--sidebar-background-color));
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
    /* No padding on the scrollport. A padded scrollport makes sticky titles
       lock short of the top, with a gap above them. */
    padding: 0 0 24px;
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
    flex-direction: column;
    flex-wrap: nowrap;
    align-items: flex-start;
    gap: 2px;
    flex: 0 0 auto;
    align-self: flex-start;
    min-width: 0;
    max-width: 100%;
    padding: 0;
  }
  .sun-toolbar-chrome > .library-used-by {
    flex: 1 0 100%;
  }
  /* Overlay under the time row. Out of flow so it does not shrink the dial. */
  .sun-toolbar {
    position: relative;
  }
  .sun-toolbar-chrome > .scene-used {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 4;
    width: max-content;
    max-width: min(240px, 46vw);
    pointer-events: none;
  }
  .sun-toolbar-chrome > .scene-used .scene-used-chip,
  .sun-toolbar-chrome > .scene-used .scene-palette-split {
    pointer-events: auto;
  }
  .library-used-by {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 10px;
    min-width: 0;
    max-width: 100%;
    padding: 4px 0 0;
  }
  .simple-editor > .library-used-by,
  .library-editor > .library-used-by {
    position: relative;
    width: 100%;
    padding: 8px 16px 0;
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
  /* Phone: one horizontal strip above the disk. It stays in the column so the
     disk does not jump, and the color modes take its place once a light is
     selected. Wider screens keep the vertical overlay. */
  :host([narrow]) .simple-editor > .scene-used {
    position: relative;
    top: auto;
    left: auto;
    order: -1;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    align-self: stretch;
    width: 100%;
    max-width: 100%;
    min-height: 48px;
    margin-top: 8px;
    padding: 0 8px;
    box-sizing: border-box;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    z-index: 4;
    pointer-events: auto;
    visibility: visible;
    transition:
      opacity 180ms cubic-bezier(0.2, 0, 0, 1),
      visibility 0s linear 0s;
  }
  :host([narrow]) .simple-editor > .scene-used::-webkit-scrollbar {
    display: none;
  }
  :host([narrow]) .simple-editor > .scene-used .scene-palette-split,
  :host([narrow]) .simple-editor > .scene-used .scene-used-chip {
    flex: 0 0 auto;
    max-width: 220px;
  }
  :host([narrow]) .simple-editor:not(.chrome-aside):has(
      .hue-wheel-mode-cluster.is-shown,
      .hue-presets.is-shown
    )
    > .scene-used {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition:
      opacity 180ms cubic-bezier(0.2, 0, 0, 1),
      visibility 0s linear 180ms;
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
  .scene-used-chip.is-source {
    cursor: default;
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
    position: relative;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    flex: 0 0 auto;
    overflow: hidden;
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
  /* Fill the scrollport so the light tiles sit on the bottom. The column
     grows past the port once the dial hits the same floor as the color wheel. */
  .stage-scroll > .sun-path.dial-view {
    flex: 1 0 auto;
    min-height: 100%;
    display: flex;
    flex-direction: column;
    /* Tile bleed hangs below the column. Clip it so a tall stage does not
       scroll until the face is actually at its floor. */
    overflow: clip;
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
    padding: 0 0 12px 12px;
    box-sizing: border-box;
    background: none;
    overflow: visible;
    container-type: scroll-state;
  }
  .floor-block .area-head .area-add {
    margin-block: -8px;
  }
  .library-block {
    padding: 0 8px 0 12px;
  }
  .library-block > .area-head {
    position: sticky;
    top: 0;
    z-index: 3;
    margin: 0 -8px 0 -12px;
    width: calc(100% + 20px);
    padding: 0 8px 12px 12px;
    box-sizing: border-box;
    background: none;
    overflow: visible;
    container-type: scroll-state;
  }
  .library-block > .area-head .floor-label {
    font-size: 16px;
    font-weight: 600;
    letter-spacing: normal;
    text-transform: none;
    color: var(--primary-text-color);
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
      /* Same surface as the app header and the library/scenes tab bar. */
      background: var(--app-header-background-color, var(--sidebar-background-color));
      opacity: 1;
      transition: opacity 350ms;
    }
    .sticky-bg-area {
      /* 16px past the title. 50% − 8px is still halfway down the title itself. */
      bottom: -16px;
      background: linear-gradient(
        to bottom,
        var(--app-header-background-color, var(--sidebar-background-color)) calc(50% - 8px),
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
    position: relative;
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
  .theme-dial-photo {
    position: absolute;
    inset: 0;
    background-position: center;
    background-size: cover;
    pointer-events: none;
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

/* Same knots as themeConic: midnight at the bottom, noon at the top.
   Each photo owns the arc from its event to the next, wrapping dusk→dawn. */
const THEME_DIAL_STOPS = [
  ["dusk", 0],
  ["dawn", 0.23],
  ["sunrise", 0.27],
  ["noon", 0.5],
  ["sunset", 0.79],
  ["dusk", 0.87],
  ["dusk", 1],
];
const THEME_DIAL_ARCS = [
  { id: "dawn", at: 0.23, next: 0.27 },
  { id: "sunrise", at: 0.27, next: 0.5 },
  { id: "noon", at: 0.5, next: 0.79 },
  { id: "sunset", at: 0.79, next: 0.87 },
  { id: "dusk", at: 0.87, next: 1.23 },
];

function themeEventCoverId(ev, variables) {
  if (ev?.palette && galleryPalette(ev.palette)) {
    return ev.palette;
  }
  const ref = ev?.color?.variable_ref;
  const variable = ref
    ? (variables || []).find((item) => item.id === ref)
    : null;
  if (variableIsPalette(variable) && galleryPalette(variable.builtin_id)) {
    return variable.builtin_id;
  }
  return null;
}

function themeEventResolved(ev, variables) {
  if (ev?.palette && galleryPalette(ev.palette)) {
    const slot = galleryPalette(ev.palette).slots[0];
    return {
      color: slot?.color || slot,
      brightness: ev.brightness ?? slot?.brightness ?? 255,
    };
  }
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
  const colorAt = (event) => {
    const { color, brightness } = themeEventResolved(
      theme?.events?.[event],
      variables
    );
    if (!color) {
      return "#444";
    }
    return variableSwatchCss({ color, brightness });
  };
  // from 180deg: midnight at the bottom, noon at the top (same as the dial).
  // Place knots on the clock, not in equal pie slices, so dusk→dawn fills the
  // night arc out to the rim instead of leaving a dawn wedge on midnight.
  const stops = THEME_DIAL_STOPS.map(
    ([event, at]) => `${colorAt(event)} ${at * 100}%`
  );
  return `conic-gradient(from 180deg, ${stops.join(", ")})`;
}

/** Color conic, plus a palette photo on each event that has a gallery cover. */
export function paintThemeDial(el, theme, variables) {
  if (!el) {
    return;
  }
  el.style.background = themeConic(theme, variables);
  for (const layer of el.querySelectorAll(":scope > .theme-dial-photo")) {
    layer.remove();
  }
  for (const arc of THEME_DIAL_ARCS) {
    const cover = themeEventCoverId(theme?.events?.[arc.id], variables);
    if (!cover) {
      continue;
    }
    const layer = document.createElement("div");
    layer.className = "theme-dial-photo";
    layer.setAttribute("aria-hidden", "true");
    const bri = Number(
      themeEventResolved(theme?.events?.[arc.id], variables).brightness
    );
    const dim = Number.isFinite(bri)
      ? 1 - Math.min(255, Math.max(0, bri)) / 255
      : 0;
    const url = galleryCoverUrl(cover);
    // A black veil on the photo so brightness edits darken the preview.
    // The conic underneath already tracks brightness, but the photo covers it.
    layer.style.backgroundImage =
      dim > 0
        ? `linear-gradient(rgba(0, 0, 0, ${dim}), rgba(0, 0, 0, ${dim})), url("${url}")`
        : `url("${url}")`;
    const start = (180 + arc.at * 360) % 360;
    const span = (arc.next - arc.at) * 360;
    const mask = `conic-gradient(from ${start}deg, #000 0deg, transparent ${span}deg, transparent 360deg)`;
    layer.style.webkitMaskImage = mask;
    layer.style.maskImage = mask;
    el.appendChild(layer);
  }
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

export function sceneCoverUrl(panel) {
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
        "Scene Studio blends your room’s lights between solar events — dawn, sunrise, noon, sunset, and dusk — so brightness and color follow the day."
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
        "Scene Studio blends your room’s lights between solar events — dawn, sunrise, noon, sunset, and dusk — so brightness and color follow the day."
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
  varHead.append(stickyBg("area"), varLabel, addVar);

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
  palHead.append(stickyBg("area"), palLabel, addPal);

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
  themeHead.append(stickyBg("area"), themeLabel, addTheme);

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
    paintThemeDial(dial, theme, panel._variables || []);
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

export const PALETTE_RANDOMIZE_ICON = "mdi:shuffle";

export function renderPaletteUsed(panel) {
  const draft = panel._variableDraft;
  if (panel._view !== "palette" || !draft) {
    return null;
  }
  const row = document.createElement("div");
  row.className = "scene-used";
  const preset = galleryPalette(draft.builtin_id);
  if (preset) {
    const chip = document.createElement("div");
    chip.className = "scene-used-chip is-source";
    appendPaletteFace(chip, { builtin_id: preset.id }, panel._variables);
    const name = document.createElement("span");
    name.textContent = panel._t(preset.nameKey, preset.name);
    chip.appendChild(name);
    chip.setAttribute("aria-label", name.textContent);
    row.appendChild(chip);
  }
  const seen = new Set();
  for (const slot of draft.slots || []) {
    const id = slot?.variable_ref;
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    const variable = (panel._variables || []).find((entry) => entry.id === id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "scene-used-chip";
    const name = document.createElement("span");
    name.textContent = variable?.name || id;
    if (variable && variableIsPalette(variable)) {
      appendPaletteFace(button, variable, panel._variables);
      button.appendChild(name);
      button.addEventListener("click", () => panel._go(`palette/${id}`));
    } else {
      const swatch = document.createElement("span");
      swatch.className = "scene-used-swatch";
      swatch.style.background = variableSwatchCss(variable, panel._variables);
      button.append(swatch, name);
      button.addEventListener("click", () => panel._go(`variable/${id}`));
    }
    button.setAttribute("aria-label", name.textContent);
    row.appendChild(button);
  }
  return row.childElementCount ? row : null;
}

export function renderSceneUsed(panel) {
  if (panel._view !== "edit" || !panel._formData) {
    return null;
  }
  const simple = panel._formData?.kind === "simple";
  const uses = sceneLibraryUses({
    scene: panel._formData,
    theme: panel._themeDraft,
    themes: panel._themes,
    variables: panel._variables,
  }).filter((item) => (simple ? item.kind === "variable" : item.kind !== "theme"));
  const row = document.createElement("div");
  row.className = "scene-used";
  row.appendChild(simple ? renderPaletteSplit(panel) : renderThemeSplit(panel));
  for (const item of uses) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "scene-used-chip";
    const swatch = document.createElement("span");
    swatch.className = "scene-used-swatch";
    const name = document.createElement("span");
    if (item.kind === "palette") {
      const variable = (panel._variables || []).find((entry) => entry.id === item.id);
      name.textContent = variable?.name || item.id;
      appendPaletteFace(button, variable, panel._variables);
      button.appendChild(name);
      button.addEventListener("click", () => panel._go(`palette/${item.id}`));
    } else {
      const variable = (panel._variables || []).find((entry) => entry.id === item.id);
      name.textContent = variable?.name || item.id;
      swatch.style.background = variableSwatchCss(variable, panel._variables);
      button.append(swatch, name);
      button.addEventListener("click", () => panel._go(`variable/${item.id}`));
    }
    button.setAttribute("aria-label", name.textContent);
    row.appendChild(button);
  }
  return row;
}

function renderPaletteSplit(panel) {
  const split = document.createElement("div");
  split.className = "scene-palette-split";
  const paletteId = panel._formData?.palette_id || null;
  const palette = paletteId
    ? (panel._variables || []).find((entry) => entry.id === paletteId)
    : null;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "scene-used-chip";
  const name = document.createElement("span");
  if (!palette) {
    button.classList.add("is-placeholder");
    name.textContent = panel._t("frontend.dialogs.scene_palette_select", "Select a palette");
  } else {
    name.textContent = palette.name || paletteId;
    appendPaletteFace(button, palette, panel._variables);
  }
  button.appendChild(name);
  button.setAttribute("aria-label", name.textContent);
  button.addEventListener("click", () => panel._pickSceneBasePalette?.());
  split.appendChild(button);
  if (palette) {
    const shuffle = document.createElement("ha-icon-button");
    shuffle.className = "scene-palette-edit";
    shuffle.label = panel._t("frontend.dialogs.scene_palette_randomize", "Randomize");
    const shuffleIcon = document.createElement("ha-icon");
    shuffleIcon.setAttribute("icon", PALETTE_RANDOMIZE_ICON);
    shuffle.appendChild(shuffleIcon);
    shuffle.addEventListener("click", (ev) => {
      ev.stopPropagation();
      panel._randomizeScenePalette?.();
    });
    split.appendChild(shuffle);
    const edit = document.createElement("ha-icon-button");
    edit.className = "scene-palette-edit";
    edit.label = panel._t("frontend.dialogs.scene_palette_edit", "Edit palette");
    const icon = document.createElement("ha-icon");
    icon.setAttribute("icon", "mdi:pencil");
    edit.appendChild(icon);
    edit.addEventListener("click", (ev) => {
      ev.stopPropagation();
      panel._go(`palette/${palette.id}`);
    });
    split.appendChild(edit);
  }
  return split;
}

function renderThemeSplit(panel) {
  const split = document.createElement("div");
  split.className = "scene-palette-split";
  const themeId =
    panel._formData?.theme_id ||
    (panel._formData?.kind === "simple" ? null : "default");
  const theme = themeId
    ? (panel._themes || []).find((entry) => entry.id === themeId)
    : null;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "scene-used-chip";
  const name = document.createElement("span");
  if (!theme) {
    button.classList.add("is-placeholder");
    name.textContent = panel._t("frontend.dialogs.scene_theme_select", "Select a theme");
  } else {
    name.textContent = theme.name || themeId;
    const swatch = document.createElement("span");
    swatch.className = "scene-used-swatch";
    paintThemeDial(swatch, theme, panel._variables || []);
    button.appendChild(swatch);
  }
  button.appendChild(name);
  button.setAttribute("aria-label", name.textContent);
  button.addEventListener("click", () => panel._pickSceneTheme?.());
  split.appendChild(button);
  if (theme) {
    const edit = document.createElement("ha-icon-button");
    edit.className = "scene-palette-edit";
    edit.label = panel._t("frontend.dialogs.scene_theme_edit", "Edit theme");
    const icon = document.createElement("ha-icon");
    icon.setAttribute("icon", "mdi:pencil");
    edit.appendChild(icon);
    edit.addEventListener("click", (ev) => {
      ev.stopPropagation();
      panel._go(`theme/${theme.id}`);
    });
    split.appendChild(edit);
  }
  return split;
}

export function renderLibraryUsedBy(panel, { kind, id }) {
  const scenes = scenesUsingLibraryItem({
    kind,
    id,
    scenes: panel._items,
    themes: panel._themes,
    variables: panel._variables,
  });
  if (!scenes.length) {
    return null;
  }
  const row = document.createElement("div");
  row.className = "library-used-by";
  for (const scene of scenes) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "scene-used-chip";
    const name = document.createElement("span");
    name.textContent = scene.scene_name || scene.name || scene.id;
    button.appendChild(name);
    button.addEventListener("click", () => panel._go(`edit/${scene.id}`));
    row.appendChild(button);
  }
  return row;
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
