/** Area rail, scene cards, and variable/theme library for the list view. */

import { createSimpleCardMesh } from "./card_mesh.js";

const AREA_RAIL_PX = 340;

export const LANDING_CSS = `
  .workspace {
    display: flex;
    align-items: stretch;
    height: 100%;
    min-height: 0;
    gap: 0;
    overflow: hidden;
  }
  .area-rail {
    width: ${AREA_RAIL_PX}px;
    flex: 0 0 ${AREA_RAIL_PX}px;
    max-width: 100%;
    min-height: 0;
    height: 100%;
    border-right: 1px solid var(--divider-color);
    padding: 12px 8px 24px 12px;
    box-sizing: border-box;
    /* Sit above dial horizon/vignette; frost so that wash still reads through. */
    position: relative;
    z-index: 8;
    isolation: isolate;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
    background: color-mix(
      in srgb,
      var(--primary-background-color) 58%,
      transparent
    );
    backdrop-filter: blur(18px) saturate(1.2);
    -webkit-backdrop-filter: blur(18px) saturate(1.2);
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
    flex: 1 1 auto;
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
  .area-block { margin-bottom: 18px; }
  .area-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 4px 8px;
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
  .scene-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 64px;
    margin: 0 0 8px;
    padding: 10px 4px 10px 12px;
    border: 0;
    border-radius: 14px;
    color: #fff;
    cursor: pointer;
    overflow: visible;
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
    color: #fff;
    --mdc-icon-button-size: 36px;
  }
  .scene-card .card-overflow-slot ha-icon-button {
    color: #fff;
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
  .var-chip span { font-size: 12px; color: var(--secondary-text-color); }
  .theme-dial {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.2);
    cursor: pointer;
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
  .empty-select {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 52vh;
    padding: 32px 16px;
    text-align: center;
  }
  .empty-select-rings {
    width: 220px;
    height: 220px;
    border-radius: 50%;
    margin: 0 auto 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background:
      radial-gradient(circle, var(--card-background-color, #2b2b2b) 0 38%, transparent 39%),
      radial-gradient(circle, transparent 0 54%, rgba(255,255,255,0.14) 55% 56%, transparent 57%),
      radial-gradient(circle, transparent 0 72%, rgba(255,255,255,0.12) 73% 74%, transparent 75%),
      radial-gradient(circle, transparent 0 90%, rgba(255,255,255,0.1) 91% 92%, transparent 93%);
  }
  .empty-select-rings span {
    max-width: 7.5em;
    font-size: 14px;
    line-height: 1.35;
    color: var(--primary-text-color);
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

/** One horizontal day-ramp per light (dawn→dusk), stacked as equal bands. */
function applyRampBackground(el, ramps) {
  const bands = (ramps || []).filter((ramp) => (ramp.stops || []).length);
  if (!bands.length) {
    el.style.backgroundImage = "linear-gradient(90deg, #2b2b2b, #1c1c1c)";
    el.style.backgroundSize = "100% 100%";
    el.style.backgroundPosition = "0 0";
    el.style.backgroundRepeat = "no-repeat";
    return;
  }
  const n = bands.length;
  const images = [];
  const sizes = [];
  const positions = [];
  bands.forEach((ramp, index) => {
    const stops = ramp.stops;
    const last = Math.max(stops.length - 1, 1);
    const parts = stops.map(
      (rgb, j) => `${rgbCss(rgb)} ${(j / last) * 100}%`
    );
    images.push(`linear-gradient(90deg, ${parts.join(", ")})`);
    sizes.push(`100% ${100 / n}%`);
    positions.push(`0 ${(index * 100) / n}%`);
  });
  el.style.backgroundImage = images.join(", ");
  el.style.backgroundSize = sizes.join(", ");
  el.style.backgroundPosition = positions.join(", ");
  el.style.backgroundRepeat = "no-repeat";
}

function themeConic(theme, variables) {
  const events = ["dawn", "sunrise", "noon", "sunset", "dusk"];
  const colors = events.map((event) => {
    const ev = theme.events?.[event];
    const ref = ev?.color?.variable_ref;
    const color = ref
      ? variables.find((v) => v.id === ref)?.color
      : ev?.color;
    if (!color) {
      return "#444";
    }
    if (color.color_temp_kelvin) {
      const k = color.color_temp_kelvin;
      const t = Math.max(0, Math.min(1, (k - 2000) / 4000));
      const r = Math.round(255);
      const g = Math.round(140 + t * 80);
      const b = Math.round(80 + t * 140);
      return `rgb(${r},${g},${b})`;
    }
    if (color.hs_color) {
      return `hsl(${color.hs_color[0]}, ${color.hs_color[1]}%, 55%)`;
    }
    if (color.rgb_color) {
      return rgbCss(color.rgb_color);
    }
    return "#555";
  });
  const slice = 100 / colors.length;
  const stops = colors
    .map((c, i) => `${c} ${i * slice}% ${(i + 1) * slice}%`)
    .join(", ");
  return `conic-gradient(${stops})`;
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

  const rail = document.createElement("div");
  rail.className = "area-rail";
  rail.appendChild(renderLibrary(panel, { compact: true }));

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
    rail.appendChild(empty);
  }

  for (const floor of floors) {
    const label = document.createElement("div");
    label.className = "floor-label";
    label.textContent =
      floor.name ||
      panel._t("frontend.common.other_areas", "Other areas");
    rail.appendChild(label);
    for (const area of floor.areas || []) {
      rail.appendChild(renderAreaBlock(panel, area, byArea.get(area.id) || []));
    }
  }

  if (panel._narrow) {
    if (panel._view === "variables") {
      const library = document.createElement("div");
      library.className = "library-col";
      library.appendChild(renderLibrary(panel, { compact: false }));
      page.appendChild(library);
      return page;
    }
    page.appendChild(rail);
    return page;
  }

  page.appendChild(rail);
  if (includeStage) {
    const { stage, scroll } = makeStageCol();
    if (panel._view !== "edit" && panel._view !== "theme") {
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
  add.addEventListener("click", (ev) => {
    ev.stopPropagation();
    panel._openCreateDialog({ areaId: area.id, areaName: area.name });
  });
  head.append(title, add);
  block.appendChild(head);
  if (!scenes.length) {
    const empty = document.createElement("button");
    empty.type = "button";
    empty.className = "area-empty";
    empty.textContent = panel._t(
      "frontend.empty.area_no_scenes",
      "No scenes yet — create one for this area"
    );
    empty.addEventListener("click", () => {
      panel._openCreateDialog({ areaId: area.id, areaName: area.name });
    });
    block.appendChild(empty);
    return block;
  }
  for (const scene of scenes) {
    block.appendChild(renderSceneCard(panel, scene));
  }
  return block;
}

function renderSceneCard(panel, scene) {
  const cardEl = document.createElement("div");
  cardEl.className = "scene-card";
  const selected = panel._view === "edit" && panel._editId === scene.id;
  if (selected) {
    cardEl.classList.add("selected");
  }
  cardEl.setAttribute("role", "button");
  cardEl.tabIndex = 0;
  cardEl.setAttribute("aria-pressed", selected ? "true" : "false");
  const card = scene.card || {};
  let bg;
  if (scene.kind === "simple") {
    bg = createSimpleCardMesh(card.dots);
  } else {
    bg = document.createElement("div");
    bg.className = "card-bg";
    applyRampBackground(bg, card.ramps);
  }
  const body = document.createElement("div");
  body.className = "card-body";
  const name = document.createElement("div");
  name.className = "card-name";
  name.textContent = scene.scene_name || scene.name || "Scene";
  const sub = document.createElement("div");
  sub.className = "card-sub";
  sub.textContent =
    scene.kind === "simple"
      ? panel._t("frontend.kinds.simple", "Simple scene")
      : panel._t("frontend.kinds.circadian", "Circadian scene");
  body.append(name, sub);
  const overflowSlot = document.createElement("div");
  overflowSlot.className = "card-overflow-slot";
  const overflow = panel._listSceneOverflowMenu(scene);
  overflow.classList.add("card-overflow");
  overflowSlot.appendChild(overflow);
  cardEl.append(bg, body, overflowSlot);
  const activate = () => {
    if (selected) {
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
  return cardEl;
}

function renderEmptyHero(panel) {
  const el = document.createElement("div");
  el.className = "empty-hero";
  const h = document.createElement("h1");
  h.textContent = panel._t(
    "frontend.empty.extrapolation_title",
    "Start lighting with the sun"
  );
  const p = document.createElement("p");
  p.textContent = panel._t(
    "frontend.empty.auto_configure_body",
    "Auto configure creates a circadian scene for every area that has lights, using the default theme. You can edit variables and themes here anytime — lights update the next time a scene runs."
  );
  const btn = document.createElement("ha-button");
  btn.className = "auto-configure";
  btn.textContent = panel._t(
    "frontend.actions.auto_configure",
    "Auto configure"
  );
  btn.addEventListener("click", () => panel._autoConfigure());
  el.append(h, p, btn);
  return el;
}

function renderSelectEmpty(panel) {
  const el = document.createElement("div");
  el.className = "empty-select";
  const rings = document.createElement("div");
  rings.className = "empty-select-rings";
  const label = document.createElement("span");
  label.textContent = panel._t(
    "frontend.empty.select_scene",
    "Select a scene to get started"
  );
  rings.appendChild(label);
  el.appendChild(rings);
  return el;
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
  varHead.append(varLabel, addVar);
  wrap.appendChild(varHead);

  const varRow = document.createElement("div");
  varRow.className = "var-row";
  for (const variable of panel._variables || []) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "var-chip";
    const dot = document.createElement("div");
    dot.className = "var-dot";
    const color = variable.color || {};
    if (color.color_temp_kelvin) {
      const t = Math.max(0, Math.min(1, (color.color_temp_kelvin - 2000) / 4000));
      dot.style.background = `rgb(255, ${Math.round(150 + t * 70)}, ${Math.round(90 + t * 130)})`;
    } else if (color.hs_color) {
      dot.style.background = `hsl(${color.hs_color[0]}, ${color.hs_color[1]}%, 55%)`;
    } else if (color.rgb_color) {
      dot.style.background = rgbCss(color.rgb_color);
    }
    const name = document.createElement("span");
    name.textContent = variable.name;
    chip.append(dot, name);
    chip.addEventListener("click", () => panel._openVariableEditor(variable));
    varRow.appendChild(chip);
  }
  wrap.appendChild(varRow);

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
  themeHead.append(themeLabel, addTheme);
  wrap.appendChild(themeHead);

  const themeRow = document.createElement("div");
  themeRow.className = "theme-row";
  for (const theme of panel._themes || []) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "theme-chip";
    const dial = document.createElement("div");
    dial.className = "theme-dial";
    dial.style.background = themeConic(theme, panel._variables || []);
    const name = document.createElement("span");
    name.textContent = theme.name;
    chip.append(dial, name);
    chip.addEventListener("click", () => panel._openThemeEditor(theme));
    themeRow.appendChild(chip);
  }
  wrap.appendChild(themeRow);
  return wrap;
}
