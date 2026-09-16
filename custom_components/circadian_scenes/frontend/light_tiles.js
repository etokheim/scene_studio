/** Shared Lys light tiles (huemane-inspired). Used by simple scenes and the circadian dial. */

export const LIGHT_TILES_CSS = `
  .light-tiles-scroller {
    display: flex;
    align-self: stretch;
    flex: 0 0 auto;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding: 8px 16px 24px;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-x: contain;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-x;
    position: relative;
  }
  .light-tiles {
    display: flex;
    flex-flow: row nowrap;
    align-items: flex-end;
    gap: 10px;
    width: max-content;
    margin-inline: auto;
    flex: 0 0 auto;
    position: relative;
  }
  .simple-light-selector {
    box-sizing: border-box;
    flex: 0 0 auto;
    border: 2px solid transparent;
    padding: 2px;
    border-radius: 28px;
    position: relative;
  }
  .simple-light-selector.active {
    border-color: var(
      --hue-light-on-color,
      var(--hue-light-on-background, #ffda95)
    );
  }
  .simple-light-tile {
    --hue-unfilled-mix: 50%;
    --hue-unfilled-opacity: 100%;
    --hue-unfilled-color: color-mix(
      in srgb,
      var(--hue-light-on-color, var(--hue-light-on-background, #ffda95))
        var(--hue-unfilled-mix),
      var(--hue-light-off-background, var(--surface-2, #242022))
    );
    --hue-light-off-text-color: var(--hue-light-on-text-color, rgba(0, 0, 0, 0.7));
    box-sizing: content-box;
    position: relative;
    /* Huemane Lys: 85×(90+45 switch slot), 5px pad, radius 24. No switch painted. */
    width: 85px;
    height: 135px;
    padding: 5px;
    border: 0;
    border-radius: 24px;
    overflow: hidden;
    cursor: ns-resize;
    user-select: none;
    -webkit-user-select: none;
    touch-action: pan-x;
    box-shadow: 0px 2px 3px rgba(0, 0, 0, 0.4);
    background: color-mix(
      in srgb,
      var(--hue-unfilled-color) var(--hue-unfilled-opacity),
      transparent
    );
    color: inherit;
    transition: all 0.3s ease-out 0s, transform 0.15s;
  }
  .simple-light-tile.tap-only {
    cursor: pointer;
  }
  .simple-light-tile:not(.dragging):active:hover {
    transform: scale(0.95);
  }
  .simple-light-tile.is-off {
    --hue-unfilled-mix: 0%;
    --hue-unfilled-opacity: 100%;
    background: var(--hue-light-off-background, var(--surface-2, #242022));
    --hue-light-off-text-color: #fff;
  }
  .simple-light-tile.dragging,
  .simple-light-tile.wheel-adjusting {
    --hue-unfilled-mix: 0%;
    --hue-unfilled-opacity: 100%;
    --hue-light-off-text-color: #fff;
    touch-action: none;
    transform: none;
  }
  @media (hover: hover) {
    .simple-light-tile:hover:not(.is-off):not(.dragging):not(.wheel-adjusting) {
      --hue-unfilled-mix: 25%;
      --hue-unfilled-opacity: 85%;
      --hue-light-off-text-color: #fff;
    }
    .simple-light-tile:hover:not(.is-off):not(.dragging):not(.wheel-adjusting)
      .simple-light-fill::after {
      height: 0;
    }
  }
  .simple-light-fill {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: var(--hue-light-fill, 0%);
    background: var(--hue-light-on-background, #ffda95);
    border-radius: 8px 8px 0 0;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
    transition: height 0.3s ease-out;
  }
  .simple-light-fill::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 20px;
    background: color-mix(
      in srgb,
      var(--hue-unfilled-color, var(--hue-light-off-background, #242022))
        var(--hue-unfilled-opacity, 100%),
      transparent
    );
    -webkit-mask-image: linear-gradient(to bottom, #000, transparent);
    mask-image: linear-gradient(to bottom, #000, transparent);
    pointer-events: none;
    transition: height 0.3s ease-out;
  }
  .simple-light-tile.dragging .simple-light-fill::after,
  .simple-light-tile.wheel-adjusting .simple-light-fill::after,
  .simple-light-tile.is-off .simple-light-fill::after {
    height: 0;
    transition: none;
  }
  .simple-light-labels {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    display: flex;
    flex-flow: column;
    transition: clip-path 0.3s ease-out;
  }
  .simple-light-tile.dragging .simple-light-fill,
  .simple-light-tile.dragging .simple-light-labels {
    transition: none;
  }
  .simple-light-tile.wheel-adjusting .simple-light-fill,
  .simple-light-tile.wheel-adjusting .simple-light-labels {
    transition: height 25ms ease-out, clip-path 25ms ease-out;
  }
  .simple-light-labels.layer-off {
    color: var(--hue-light-off-text-color, #fff);
    clip-path: inset(0 0 var(--hue-light-fill, 0%) 0);
  }
  .simple-light-labels.layer-on {
    color: var(--hue-light-on-text-color, rgba(0, 0, 0, 0.7));
    clip-path: inset(calc(100% - var(--hue-light-fill, 0%)) 0 0 0);
  }
  .simple-light-tap {
    display: flex;
    flex-flow: column;
    flex: 1 1 auto;
    height: 100%;
  }
  .simple-light-icon-slot {
    display: flex;
    flex-flow: column;
    flex: 1 1 auto;
    justify-content: center;
    align-items: center;
    text-align: center;
  }
  .simple-light-icon-slot ha-state-icon,
  .simple-light-icon-slot ha-icon {
    color: inherit;
    --icon-primary-color: currentColor;
    --mdc-icon-size: 24px;
    transform: scale(1.40625);
  }
  .simple-light-title {
    color: inherit;
    padding: 0 2px 10px;
    font-size: 12px;
    line-height: 15px;
    font-weight: 500;
    height: 35px;
    text-align: center;
    display: flex;
    flex-flow: column;
    justify-content: center;
  }
  .simple-light-title span {
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .simple-light-hit {
    position: absolute;
    inset: 0;
    z-index: 2;
    cursor: inherit;
  }
  .simple-light-selector.add-light-tile .simple-light-tile {
    background: color-mix(
      in srgb,
      var(--secondary-background-color, #242022) 70%,
      transparent
    );
    box-shadow: inset 0 0 0 2px
      color-mix(in srgb, var(--primary-text-color) 22%, transparent);
    cursor: pointer;
  }
  .simple-light-selector.add-light-tile .simple-light-fill {
    display: none;
  }
  .simple-light-selector.add-light-tile .simple-light-labels.layer-off {
    clip-path: none;
    -webkit-clip-path: none;
  }
  .simple-light-selector.add-light-tile .simple-light-labels.layer-on {
    display: none;
  }
`;

export function lightTileOnTextCss(rgb) {
  const toLin = (channel) => {
    const c = Math.max(0, Math.min(255, Number(channel) || 0)) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luma =
    0.2126 * toLin(rgb[0]) + 0.7152 * toLin(rgb[1]) + 0.0722 * toLin(rgb[2]);
  return luma > 0.45 ? "rgba(0, 0, 0, 0.7)" : "#fff";
}

export function paintLightTile(selector, { rgb, fillPct, selected }) {
  const channels = rgb || [0, 0, 0];
  const onBg = `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`;
  selector.style.setProperty("--hue-light-on-background", onBg);
  selector.style.setProperty("--hue-light-on-color", onBg);
  selector.style.setProperty("--hue-light-on-text-color", lightTileOnTextCss(channels));
  selector.style.setProperty("--hue-light-off-background", "#242022");
  const tile = selector.querySelector(".simple-light-tile");
  const pct = Number(fillPct) || 0;
  tile.style.setProperty("--hue-light-fill", `${pct}%`);
  tile.classList.toggle("is-off", pct <= 0);
  selector.classList.toggle("active", Boolean(selected));
}

function makeLabels(layer, name, makeIcon) {
  const labels = document.createElement("div");
  labels.className = `simple-light-labels ${layer}`;
  const tap = document.createElement("div");
  tap.className = "simple-light-tap";
  const iconSlot = document.createElement("div");
  iconSlot.className = "simple-light-icon-slot";
  iconSlot.appendChild(makeIcon());
  const title = document.createElement("div");
  title.className = "simple-light-title";
  const span = document.createElement("span");
  span.textContent = name;
  title.appendChild(span);
  tap.append(iconSlot, title);
  labels.appendChild(tap);
  return labels;
}

export function createLightTile({ entityId, name, makeIcon, tapOnly = false }) {
  const selector = document.createElement("div");
  selector.className = "simple-light-selector";
  selector.dataset.entityId = entityId;
  const tile = document.createElement("div");
  tile.className = "simple-light-tile";
  if (tapOnly) {
    tile.classList.add("tap-only");
  }
  tile.setAttribute("role", "button");
  tile.tabIndex = 0;
  const fill = document.createElement("div");
  fill.className = "simple-light-fill";
  const hit = document.createElement("div");
  hit.className = "simple-light-hit";
  tile.append(
    fill,
    makeLabels("layer-off", name, makeIcon),
    makeLabels("layer-on", name, makeIcon),
    hit
  );
  selector.appendChild(tile);
  return { selector, tile, hit };
}

export function createAddLightTile({ label, onActivate }) {
  const { selector, tile } = createLightTile({
    entityId: "__add_light__",
    name: label,
    makeIcon: () => {
      const icon = document.createElement("ha-icon");
      icon.setAttribute("icon", "mdi:plus");
      return icon;
    },
    tapOnly: true,
  });
  selector.classList.add("add-light-tile");
  paintLightTile(selector, {
    rgb: [64, 60, 58],
    fillPct: 0,
    selected: false,
  });
  const activate = (ev) => {
    ev.stopPropagation();
    onActivate?.(tile);
  };
  tile.addEventListener("click", activate);
  tile.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" && ev.key !== " ") {
      return;
    }
    ev.preventDefault();
    activate(ev);
  });
  return selector;
}
