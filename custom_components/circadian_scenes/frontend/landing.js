/** Area rail, scene cards, and variable/theme library for the list view. */

const AREA_RAIL_PX = 340;

export const LANDING_CSS = `
  .workspace {
    display: flex;
    align-items: stretch;
    min-height: 100%;
    gap: 0;
  }
  .area-rail {
    width: ${AREA_RAIL_PX}px;
    flex: 0 0 ${AREA_RAIL_PX}px;
    max-width: 100%;
    border-right: 1px solid var(--divider-color);
    padding: 12px 12px 80px;
    box-sizing: border-box;
  }
  .library-col {
    flex: 1 1 auto;
    min-width: 0;
    padding: 16px 20px 80px;
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
  .area-add {
    --mdc-icon-button-size: 32px;
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
    gap: 12px;
    min-height: 64px;
    margin: 0 0 8px;
    padding: 10px 12px;
    border: 0;
    border-radius: 14px;
    color: #fff;
    cursor: pointer;
    overflow: hidden;
    width: 100%;
    text-align: left;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08);
  }
  .scene-card.selected { box-shadow: inset 0 0 0 2px #fff; }
  .scene-card .card-bg {
    position: absolute;
    inset: 0;
    z-index: 0;
  }
  .scene-card .card-body {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
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
    margin: 0 0 24px;
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
  @media (max-width: 870px) {
    .workspace { flex-direction: column; }
    .area-rail {
      width: 100%;
      flex-basis: auto;
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

function meshBackground(dots) {
  const colors = (dots || []).map((d) => rgbCss(d.rgb));
  if (!colors.length) {
    return "linear-gradient(180deg, #2b2b2b, #1c1c1c)";
  }
  const unique = [];
  for (const c of colors) {
    if (!unique.includes(c)) {
      unique.push(c);
    }
    if (unique.length >= 8) {
      break;
    }
  }
  const blobs = unique.map((c, i) => {
    const x = 18 + ((i * 37) % 70);
    const y = 20 + ((i * 53) % 60);
    return `radial-gradient(circle at ${x}% ${y}%, ${c} 0%, transparent 55%)`;
  });
  return `${blobs.join(", ")}, #1a1a1a`;
}

function rampBackground(ramps) {
  const paths = (ramps || []).slice(0, 6);
  if (!paths.length) {
    return "linear-gradient(90deg, #2b2b2b, #1c1c1c)";
  }
  const layers = paths.map((ramp, i) => {
    const stops = ramp.stops || [];
    const n = Math.max(stops.length - 1, 1);
    const parts = stops.map((rgb, j) => `${rgbCss(rgb)} ${(j / n) * 100}%`);
    const top = (i / Math.max(paths.length, 1)) * 100;
    const bot = ((i + 1) / Math.max(paths.length, 1)) * 100;
    return `linear-gradient(90deg, ${parts.join(", ")}) ${top}% / 100% ${bot - top + 2}% no-repeat`;
  });
  return layers.join(", ");
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

export function renderLanding(panel, { fullLibrary = true } = {}) {
  const page = document.createElement("div");
  page.className = "workspace";

  const rail = document.createElement("div");
  rail.className = "area-rail";

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

  const library = document.createElement("div");
  library.className = "library-col";
  if (fullLibrary) {
    if (!items.length) {
      library.appendChild(renderEmptyHero(panel));
    } else {
      library.appendChild(renderLibrary(panel));
    }
  }

  if (panel._narrow) {
    if (panel._view === "variables") {
      page.appendChild(library);
    } else {
      page.appendChild(rail);
    }
  } else {
    page.appendChild(rail);
    if (fullLibrary) {
      page.appendChild(library);
    }
  }
  return page;
}

function renderAreaBlock(panel, area, scenes) {
  const block = document.createElement("div");
  block.className = "area-block";
  const head = document.createElement("div");
  head.className = "area-head";
  const title = document.createElement("h2");
  title.textContent = area.name;
  const add = document.createElement("ha-icon-button");
  add.className = "area-add";
  add.setAttribute(
    "label",
    panel._t("frontend.actions.add_scene", "Add scene")
  );
  const icon = document.createElement("ha-icon");
  icon.setAttribute("icon", "mdi:plus");
  icon.slot = "icon";
  add.appendChild(icon);
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
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "scene-card";
  if (panel._editId === scene.id) {
    btn.classList.add("selected");
  }
  const bg = document.createElement("div");
  bg.className = "card-bg";
  const card = scene.card || {};
  if (scene.kind === "simple") {
    bg.style.background = meshBackground(card.dots);
  } else {
    bg.style.background = rampBackground(card.ramps);
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
  btn.append(bg, body);
  btn.addEventListener("click", () => panel._go(`edit/${scene.id}`));
  return btn;
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

function renderLibrary(panel) {
  const wrap = document.createElement("div");
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

  const varLabel = document.createElement("div");
  varLabel.className = "floor-label";
  varLabel.textContent = panel._t("frontend.library.variables", "Variables");
  wrap.appendChild(varLabel);
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

  const themeLabel = document.createElement("div");
  themeLabel.className = "floor-label";
  themeLabel.textContent = panel._t("frontend.library.themes", "Circadian themes");
  wrap.appendChild(themeLabel);
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
