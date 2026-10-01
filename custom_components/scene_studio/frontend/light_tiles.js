/** Shared light tiles (huemane-inspired). Used by simple scenes and the circadian dial. */

export const LIGHT_TILES_CSS = `
  .light-tiles-scroller {
    display: flex;
    align-self: stretch;
    flex: 0 0 auto;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    /* Plates slide out of the strip. The padding is cancelled by the negative
       margin so they can overlap the wheel and the hint without pushing them. */
    padding: 64px 0;
    margin-top: -64px;
    margin-bottom: -64px;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-x: contain;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-x;
    position: relative;
    /* Above the hint, which sits later in the column and overlaps this padding. */
    z-index: 1;
  }
  .light-tiles {
    display: flex;
    flex-flow: row nowrap;
    align-items: flex-end;
    gap: 18px;
    width: max-content;
    margin-inline: auto;
    padding: 0 24px;
    flex: 0 0 auto;
    position: relative;
    --light-action-delay: 500ms;
  }
  /* A click that changes the selection skips the hover delay. */
  .light-tiles.actions-now {
    --light-action-delay: 0s;
  }
  /* Group padding insets member tiles. Lift the loose tiles by that same pad. */
  .light-tiles:has(.light-mode-group) > .select-all-tile,
  .light-tiles:has(.light-mode-group) > .add-light-tile {
    margin-bottom: 8px;
  }
  @media (orientation: portrait), (max-width: 700px) {
    .light-tiles {
      margin-inline: 0;
    }
  }
  .light-mode-group {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    gap: 8px;
    flex: 0 0 auto;
    /* Glass stroke on the group, same treatment as the light tiles. No fixed
       height, and no overflow clip — the select-all icon sits inside the label. */
    box-sizing: border-box;
    --group-radius: 24px;
    --group-pad: 8px;
    --group-border: 1px;
    --group-inner-radius: calc(var(--group-radius) - var(--group-border));
    --group-fill: var(--glass-fill, var(--surface-1, var(--gray000, var(--card-background-color))));
    padding: var(--group-pad);
    border-radius: var(--group-radius);
    border: var(--group-border) solid var(--glass-border, transparent);
    background-color: var(--group-fill);
    backdrop-filter: var(--glass-blur, blur(12px) saturate(1.15));
    -webkit-backdrop-filter: var(--glass-blur, blur(12px) saturate(1.15));
    background-image:
      linear-gradient(var(--group-fill), var(--group-fill)),
      var(
        --glass-stroke,
        linear-gradient(
          160deg,
          rgba(255, 255, 255, 0.12),
          rgba(255, 255, 255, 0.04) 45%,
          rgba(255, 255, 255, 0)
        )
      );
    background-origin: border-box;
    background-clip: padding-box, border-box;
    box-shadow: var(--glass-highlight, inset 0 1px 0 rgba(255, 255, 255, 0.08));
    color: var(--on-surface, var(--gray800, var(--primary-text-color)));
  }
  :host(:not([data-dark-mode])) .light-mode-group {
    box-shadow:
      var(--glass-highlight, inset 0 1px 0 rgba(255, 255, 255, 0.08)),
      0 16px 42px rgba(0, 0, 0, 0.12);
  }
  .light-mode-label {
    position: sticky;
    left: 8px;
    z-index: 5;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    align-self: stretch;
    box-sizing: border-box;
    width: 28px;
    min-width: 28px;
    margin: 0;
    padding: 2px 0;
    border: 0;
    background: transparent;
    color: var(--secondary-text-color);
    font: inherit;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
  }
  /* Hidden until the title sticks, so it does not cover the first tile.
     Then it uses the group's fill and stays on the padding edge, inside the
     border. While the title has been stuck for less than the corner radius,
     the ramp's left edge stays on that corner. After that the corner has
     slid away, and the ramp's left edge is square. */
  .light-mode-label::before {
    content: "";
    position: absolute;
    z-index: -1;
    top: calc(var(--group-pad, 8px) * -1);
    bottom: calc(var(--group-pad, 8px) * -1);
    left: calc((var(--group-pad, 8px) + var(--ramp-left, 0px)) * -1);
    right: calc(var(--ramp-extra, 0px) * -1);
    border-top-left-radius: var(--ramp-radius, var(--group-inner-radius, 23px));
    border-bottom-left-radius: var(--ramp-radius, var(--group-inner-radius, 23px));
    background-color: var(--group-fill, var(--card-background-color));
    opacity: 0;
    pointer-events: none;
  }
  .light-mode-label.is-stuck::before {
    opacity: 1;
    /* Solid fill. A masked backdrop-filter paints nothing in Safari. */
    background-color: transparent;
    background-image: linear-gradient(
      to right,
      var(--group-fill, var(--card-background-color)) calc(100% - var(--ramp-extra, 0px)),
      transparent 100%
    );
  }
  /* Larger touch target. The extra area is invisible and does not change layout. */
  .light-mode-label::after {
    content: "";
    position: absolute;
    inset: -18px -16px;
  }
  .light-mode-name {
    writing-mode: vertical-rl;
    text-orientation: mixed;
  }
  .light-mode-label:hover,
  .light-mode-label:focus-visible {
    color: var(--primary-text-color);
  }
  .light-mode-label.plain {
    cursor: default;
    pointer-events: none;
  }
  .light-mode-label.plain .light-mode-select {
    display: none;
  }
  .light-mode-select {
    position: absolute;
    left: 50%;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    writing-mode: horizontal-tb;
    color: inherit;
    transform: translateX(-50%);
  }
  .light-mode-select ha-icon {
    --mdc-icon-size: 18px;
    color: inherit;
    pointer-events: none;
  }
  .light-mode-row {
    display: flex;
    flex-flow: row nowrap;
    align-items: flex-end;
    gap: 10px;
  }
  .simple-light-selector {
    box-sizing: border-box;
    flex: 0 0 auto;
    position: relative;
    overflow: visible;
  }
  .simple-light-frame {
    box-sizing: border-box;
    border: 2px solid transparent;
    padding: 2px;
    border-radius: 28px;
    position: relative;
    z-index: 1;
    transition: transform 0.28s cubic-bezier(0.2, 0, 0, 1);
  }
  /* Shadow and the selection ring paint above the plates, so the buttons
     stay behind the tile. */
  .simple-light-frame::before {
    content: "";
    position: absolute;
    z-index: 2;
    inset: 2px;
    border-radius: 24px;
    pointer-events: none;
    box-shadow: 0px 2px 3px rgba(0, 0, 0, 0.4);
  }
  .simple-light-frame::after {
    content: "";
    position: absolute;
    /* Flush with the tile until the tile is selected, then grow outward.
       Radius tracks the outset so the gap stays even at the corners:
       tile radius 24, padding edge is 2px out, inset -4px is 6px out. */
    inset: 2px;
    z-index: 5;
    border-radius: 24px;
    border: 2px solid transparent;
    pointer-events: none;
    transition:
      inset 280ms cubic-bezier(0.22, 1.2, 0.36, 1),
      border-radius 280ms cubic-bezier(0.22, 1.2, 0.36, 1),
      border-color 200ms ease;
  }
  .simple-light-frame:has(.simple-light-tile.jelly-snap) {
    animation: light-tile-jelly 480ms cubic-bezier(0.22, 1.55, 0.36, 1);
  }
  .simple-light-frame:has(.simple-light-tile:not(.dragging):not(.wheel-adjusting):active:hover) {
    transform: scale(0.95);
  }
  .simple-light-selector.active:not(.select-all-tile) .simple-light-frame::after {
    inset: -4px;
    border-radius: 30px;
    border-color: var(
      --hue-light-on-color,
      var(--hue-light-on-background, #ffda95)
    );
  }
  .simple-light-selector.active:not(.select-all-tile):not(.add-light-tile):not(.removed)
    .simple-light-frame::before {
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.32);
  }
  .simple-light-selector.add-light-tile .simple-light-frame::before {
    box-shadow: none;
  }
  /* Action plates sit behind the tile and share the group fill. They slide
     out on hover, and stay out while the tile is selected (touch has no hover).
     :focus-visible is keyboard focus. A mouse click focuses the tile too, and
     that must not open the plates. */
  .simple-light-selector:not(.select-all-tile):hover,
  .simple-light-selector:not(.select-all-tile).active,
  .simple-light-selector:not(.select-all-tile):focus-visible,
  .simple-light-selector:not(.select-all-tile):has(:focus-visible) {
    z-index: 4;
  }
  .light-tile-actions {
    position: absolute;
    z-index: 0;
    left: 2px;
    right: 2px;
    top: 2px;
    bottom: 2px;
    pointer-events: none;
  }
  /* 36px lip flush with the tile, then the button continues under the tile
     until it meets the buttons on the other side. Icons stay centered in the lip.
     A couple of pixels of the fill tuck under the tile so the edge does not
     leave a gap. */
  .light-tile-actions-top,
  .light-tile-actions-bottom {
    --light-action-lip: 36px;
    --light-action-outset: var(--light-action-lip);
    position: absolute;
    left: 0;
    right: 0;
    display: flex;
    height: calc(var(--light-action-outset) + 50%);
    overflow: hidden;
    pointer-events: none;
    opacity: 1;
    background-color: transparent;
    background-image: linear-gradient(
      var(--glass-fill, var(--surface-1, var(--gray000, var(--card-background-color)))),
      var(--glass-fill, var(--surface-1, var(--gray000, var(--card-background-color))))
    );
    background-repeat: no-repeat;
    background-size: 100% calc(var(--light-action-lip) + 2px);
    transition-property: transform, margin, pointer-events;
    transition-duration: 280ms, 280ms, 0s;
    transition-timing-function: cubic-bezier(0.2, 0, 0, 1), cubic-bezier(0.2, 0, 0, 1), linear;
    /* Reveal and tuck wait. The selection offset (margin) does not. */
    transition-delay: var(--light-action-delay, 500ms), 0s, 0s;
    transition-behavior: allow-discrete;
  }
  /* Flat edge toward the tile. Hidden plates sit inside it; open plates clear it. */
  .light-tile-actions-top {
    top: calc(var(--light-action-outset) * -1);
    border-radius: 18px 18px 0 0;
    background-position: top;
    box-shadow:
      var(--glass-highlight, inset 0 1px 0 rgba(255, 255, 255, 0.08)),
      0 10px 22px rgba(0, 0, 0, 0.28);
    transform: translateY(var(--light-action-outset));
  }
  .light-tile-actions-bottom {
    bottom: calc(var(--light-action-outset) * -1);
    border-radius: 0 0 18px 18px;
    background-position: bottom;
    box-shadow: 0 10px 22px rgba(0, 0, 0, 0.28);
    transform: translateY(calc(var(--light-action-outset) * -1));
  }
  /* A side with no button has no plate. An empty one still paints its fill. */
  .light-tile-actions-top:empty,
  .light-tile-actions-bottom:empty {
    display: none;
  }
  .simple-light-selector:hover .light-tile-actions-top,
  .simple-light-selector:hover .light-tile-actions-bottom,
  .simple-light-selector.active .light-tile-actions-top,
  .simple-light-selector.active .light-tile-actions-bottom {
    transform: translateY(0);
    pointer-events: auto;
  }
  .simple-light-selector:focus-visible .light-tile-actions-top,
  .simple-light-selector:has(:focus-visible) .light-tile-actions-top,
  .simple-light-selector:focus-visible .light-tile-actions-bottom,
  .simple-light-selector:has(:focus-visible) .light-tile-actions-bottom {
    transform: translateY(0);
    pointer-events: auto;
    transition-delay: 0s;
  }
  /* The selection ring sits outside the tile. Margin is not part of the
     reveal delay, so the lips clear the ring as soon as the tile is selected
     or released. */
  .simple-light-selector.active:not(.select-all-tile) .light-tile-actions-top {
    margin-top: -6px;
  }
  .simple-light-selector.active:not(.select-all-tile) .light-tile-actions-bottom {
    margin-bottom: -6px;
  }
  .light-tiles.select-mode .simple-light-selector.active:not(:hover):not(:focus-visible):not(:has(:focus-visible))
    .light-tile-actions-top {
    transform: translateY(var(--light-action-outset));
    pointer-events: none;
  }
  .light-tiles.select-mode .simple-light-selector.active:not(:hover):not(:focus-visible):not(:has(:focus-visible))
    .light-tile-actions-bottom {
    transform: translateY(calc(var(--light-action-outset) * -1));
    pointer-events: none;
  }
  .light-tiles.select-mode .simple-light-selector:hover .light-tile-actions-top,
  .light-tiles.select-mode .simple-light-selector:hover .light-tile-actions-bottom {
    transform: translateY(0);
    pointer-events: auto;
  }
  /* One menu at a time. Leaving a hover waits the same 500ms to tuck, and the
     selected plates wait that long to come back. A click sets --light-action-delay
     to 0s so a new single selection moves immediately. */
  .light-tiles:has(.simple-light-selector:not(.select-all-tile):not(.add-light-tile):not(.removed):hover)
    .simple-light-selector:not(:hover)
    .light-tile-actions-top {
    transform: translateY(var(--light-action-outset));
    pointer-events: none;
  }
  .light-tiles:has(.simple-light-selector:not(.select-all-tile):not(.add-light-tile):not(.removed):hover)
    .simple-light-selector:not(:hover)
    .light-tile-actions-bottom {
    transform: translateY(calc(var(--light-action-outset) * -1));
    pointer-events: none;
  }
  .light-action {
    position: relative;
    flex: 1 1 0;
    min-width: 0;
    height: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--primary-text-color);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      background-color 140ms ease,
      transform 140ms ease;
  }
  .light-action:hover {
    background-color: color-mix(
      in srgb,
      var(--primary-text-color) 14%,
      transparent
    );
  }
  .light-action:active {
    transform: scale(0.94);
    background-color: color-mix(
      in srgb,
      var(--primary-text-color) 22%,
      transparent
    );
  }
  .light-tile-actions-top .light-action {
    align-items: flex-start;
    padding-top: calc((var(--light-action-lip) - 22px) / 2);
    transform-origin: center calc(var(--light-action-lip) / 2);
  }
  .light-tile-actions-bottom .light-action {
    align-items: flex-end;
    padding-bottom: calc((var(--light-action-lip) - 22px) / 2);
    transform-origin: center calc(100% - var(--light-action-lip) / 2);
  }
  .light-tile-actions-top .light-action + .light-action::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    width: 1px;
    height: var(--light-action-lip);
    background: color-mix(in srgb, var(--divider-color, #9e9e9e) 45%, transparent);
    pointer-events: none;
  }
  .light-action ha-icon {
    --mdc-icon-size: 22px;
    width: 22px;
    height: 22px;
    pointer-events: none;
  }
  .light-action.is-off {
    opacity: 0.45;
  }
  /* The frame border stays clear. The offset ring is ::after; coloring both
     draws two selection strokes. */
  .simple-light-selector:hover:not(.select-all-tile):not(.add-light-tile):not(.removed)
    .simple-light-frame,
  .simple-light-selector.active:not(.select-all-tile):not(.add-light-tile):not(.removed)
    .simple-light-frame {
    transform: scale(1.045);
    z-index: 2;
  }
  /* Select mode: same offset ring as the other tiles, in solid primary.
     Listed after .active so the wash color does not replace it. */
  .simple-light-selector.select-all-tile.select-mode .simple-light-frame,
  .simple-light-selector.select-all-tile.select-mode.active .simple-light-frame {
    border: 2px solid var(--primary-color);
  }
  :host(:not([data-dark-mode])) .simple-light-selector.select-all-tile {
    --hue-light-off-background: #f6f4f1 !important;
    --hue-light-off-text-color: rgba(0, 0, 0, 0.72) !important;
  }
  :host(:not([data-dark-mode]))
    .simple-light-selector.select-all-tile:not(.select-mode) {
    --hue-light-on-background: #f6f4f1 !important;
    --hue-light-on-color: #f6f4f1 !important;
    --hue-light-on-text-color: rgba(0, 0, 0, 0.8) !important;
  }
  :host(:not([data-dark-mode]))
    .simple-light-selector.select-all-tile.select-mode {
    --hue-light-on-text-color: rgba(0, 0, 0, 0.8) !important;
    --hue-light-off-text-color: rgba(0, 0, 0, 0.72) !important;
  }
  .simple-light-tile ha-ripple {
    z-index: 6;
    border-radius: inherit;
    pointer-events: none;
    --ha-ripple-color: #fff;
    --ha-ripple-pressed-opacity: 0.2;
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
    z-index: 1;
    z-index: 1;
    /* Huemane light tile: 85×(90+45 switch slot), 5px pad, radius 24. No switch painted. */
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
    box-shadow: var(--glass-highlight, inset 0 1px 0 rgba(255, 255, 255, 0.08));
    /* Opaque surface under the wash, so a plate sliding out is not visible
       through the tile while the unfilled color is translucent. */
    background-color: var(--surface-1, var(--gray000, var(--card-background-color)));
    background-image: linear-gradient(
      color-mix(
        in srgb,
        var(--hue-unfilled-color) var(--hue-unfilled-opacity),
        transparent
      ),
      color-mix(
        in srgb,
        var(--hue-unfilled-color) var(--hue-unfilled-opacity),
        transparent
      )
    );
    color: inherit;
    transition: all 0.3s ease-out 0s, transform 0.15s;
  }
  .simple-light-tile.tap-only {
    cursor: pointer;
  }
  /* Glass stroke on the tile face. The selection ring stays on the outer selector. */
  .simple-light-tile::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 4;
    border-radius: inherit;
    padding: 1px;
    background: var(
      --glass-stroke,
      linear-gradient(
        160deg,
        rgba(255, 255, 255, 0.12),
        rgba(255, 255, 255, 0.04) 45%,
        rgba(255, 255, 255, 0)
      )
    );
    -webkit-mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    mask-composite: exclude;
    pointer-events: none;
  }
  .simple-light-selector.active:not(.select-all-tile):not(.add-light-tile):not(.removed)
    .simple-light-tile:not(.dragging):not(.wheel-adjusting) {
    box-shadow: var(--glass-highlight, inset 0 1px 0 rgba(255, 255, 255, 0.08));
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
  .simple-light-tile.jelly-snap .simple-light-fill,
  .simple-light-tile.jelly-snap .simple-light-labels {
    transition:
      height 520ms cubic-bezier(0.22, 1.85, 0.36, 1),
      clip-path 520ms cubic-bezier(0.22, 1.85, 0.36, 1);
  }
  @keyframes light-tile-jelly {
    0% { transform: scale(1); }
    35% { transform: scale(1.03, 1.08); }
    55% { transform: scale(0.98, 0.94); }
    75% { transform: scale(1.01, 1.03); }
    100% { transform: scale(1); }
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
  .simple-light-tile.dragging .simple-light-fill,
  .simple-light-tile.wheel-adjusting .simple-light-fill,
  .sun-light-clock-legend.bright-scrubbing .simple-light-fill {
    transition: none;
  }
  .simple-light-fill::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: var(--hue-light-ramp, 20px);
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
    padding: 0 2px 6px;
    font-size: 12px;
    line-height: 15px;
    font-weight: 500;
    min-height: 35px;
    text-align: center;
    display: flex;
    flex-flow: column;
    justify-content: flex-end;
  }
  .simple-light-title .simple-light-name {
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
  }
  .simple-light-title .simple-light-bri {
    display: block;
    margin-top: 1px;
    font-size: 10px;
    font-weight: 450;
    line-height: 12px;
    opacity: 0.72;
  }
  .simple-light-hit {
    position: absolute;
    inset: 0;
    z-index: 2;
    cursor: inherit;
  }
  .light-tiles-block {
    width: 100%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    flex: 0 0 auto;
  }
  .light-tiles-hint {
    position: relative;
    z-index: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin: 12px 24px 0;
    padding: 0;
    max-width: 520px;
    align-self: center;
    text-align: center;
    font-size: 12px;
    line-height: 16px;
    color: var(--secondary-text-color);
    pointer-events: none;
  }
  .light-tiles-hint ha-icon {
    --mdc-icon-size: 16px;
    width: 16px;
    height: 16px;
    flex: 0 0 auto;
    color: inherit;
  }
  .simple-light-selector.add-light-tile .simple-light-tile {
    background: color-mix(
      in srgb,
      var(--secondary-background-color, #242022) 70%,
      transparent
    );
    border: 2px dashed
      color-mix(in srgb, var(--primary-text-color) 22%, transparent);
    box-shadow: none;
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
  @media (hover: hover) and (pointer: fine) {
    .simple-light-selector.add-light-tile .simple-light-tile:hover {
      background: color-mix(
        in srgb,
        var(--secondary-background-color, #242022) 92%,
        transparent
      );
      border-color: color-mix(in srgb, var(--primary-text-color) 42%, transparent);
    }
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

/**
 * Scale one light by how the Select all level changed.
 * 100% and 50% at a 75% average become 50% and 25% when that average is halved.
 * A light already at 0% stays there. A light stops at 100% if the scale would pass it.
 * When the starting average is 0, every light takes the new level so the gesture can turn them on.
 */
export function proportionalFillPercent(startPct, startShown, nextShown) {
  const start = Number(startPct);
  const from = Number(startShown);
  const to = Number(nextShown);
  if (!Number.isFinite(start) || !Number.isFinite(from) || !Number.isFinite(to)) {
    throw new Error("proportional fill expects finite percents");
  }
  const target = Math.max(0, Math.min(100, to));
  if (from <= 0) {
    return target;
  }
  return Math.max(0, Math.min(100, (start * target) / from));
}

/** Shared drag delta, clamped. Each light keeps its own starting level. */
export function relativeFillPercent(startPct, deltaPct) {
  const start = Number(startPct);
  const delta = Number(deltaPct);
  if (!Number.isFinite(start) || !Number.isFinite(delta)) {
    throw new Error("relative fill expects finite percents");
  }
  return Math.max(0, Math.min(100, start + delta));
}

/** More than one selected light: the select-all tile clears. Otherwise it selects every member. */
export function selectAllTileAction(selectedCount) {
  return selectedCount > 1 ? "clear" : "all";
}

/**
 * Average brightness for the Select all tile. Pass only dimmable fills;
 * on/off lights are omitted so they cannot pull the number to 0 or 100.
 * Null when there is nothing dimmable to average.
 */
export function selectAllDisplayedFill(fills) {
  const dimmable = [];
  for (const value of fills) {
    if (!Number.isFinite(value)) {
      throw new Error("select-all fill expects finite percents");
    }
    dimmable.push(value);
  }
  if (!dimmable.length) {
    return null;
  }
  return dimmable.reduce((sum, value) => sum + value, 0) / dimmable.length;
}

/** On at or above 50% of the Select all level; off below it. */
export function selectAllOnOffState(shownPct) {
  if (!Number.isFinite(shownPct)) {
    throw new Error("select-all on/off expects a finite percent");
  }
  return shownPct >= 50 ? "on" : "off";
}

/** Second line on a light tile. On/off lights say On or Off; the rest say a percent. */
export function lightTileValueLabel(fillPct, { onOff = false, onText = "On", offText = "Off" } = {}) {
  if (onOff) {
    return Number(fillPct) > 0 ? onText : offText;
  }
  return `${Math.round(Number(fillPct) || 0)}%`;
}

export function paintLightTile(selector, { rgb, fillPct, selected, brightnessLabel }) {
  const channels = rgb || [0, 0, 0];
  const onBg = `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`;
  selector.style.setProperty("--hue-light-on-background", onBg);
  selector.style.setProperty("--hue-light-on-color", onBg);
  selector.style.setProperty("--hue-light-on-text-color", lightTileOnTextCss(channels));
  selector.style.setProperty("--hue-light-off-background", "#242022");
  const tile = selector.querySelector(".simple-light-tile");
  const pct = Number(fillPct) || 0;
  // A new tile's fill defaults to 0%. Setting the real level in the same
  // turn still animates if layout already saw that 0. Freeze the fill and
  // the clipped labels for this first paint. Later updates keep the transition.
  const firstPaint = tile.dataset.fillReady !== "1";
  const frozen = firstPaint
    ? [tile, ...tile.querySelectorAll(".simple-light-fill, .simple-light-labels")]
    : [];
  for (const el of frozen) {
    el.style.transition = "none";
  }
  tile.style.setProperty("--hue-light-fill", `${pct}%`);
  if (firstPaint) {
    tile.dataset.fillReady = "1";
    requestAnimationFrame(() => {
      for (const el of frozen) {
        el.style.transition = "";
      }
    });
  }
  const tileH = tile.clientHeight || 135;
  const rampPx =
    pct <= 0 || pct >= 100 ? 0 : Math.min(20, ((100 - pct) / 100) * tileH);
  tile.style.setProperty("--hue-light-ramp", `${rampPx}px`);
  tile.classList.toggle("is-off", pct <= 0);
  selector.classList.toggle("active", Boolean(selected));
  const label =
    brightnessLabel === undefined ? `${Math.round(pct)}%` : brightnessLabel;
  for (const el of selector.querySelectorAll(".simple-light-bri")) {
    el.textContent = label;
    el.hidden = label === "";
  }
  const power = selector.querySelector(".light-power");
  if (power) {
    const off = pct <= 0;
    power.classList.toggle("is-off", off);
    power.setAttribute("aria-pressed", off ? "false" : "true");
  }
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
  span.className = "simple-light-name";
  span.textContent = name;
  const bri = document.createElement("span");
  bri.className = "simple-light-bri";
  title.append(span, bri);
  tap.append(iconSlot, title);
  labels.appendChild(tap);
  return labels;
}

/**
 * Viewport rects for tiles and group labels, keyed by `data-strip-key`.
 * Call before the strip is rebuilt, then `playLightStripLayout` after.
 */
export function captureLightStripLayout(root) {
  const rects = new Map();
  if (!root?.isConnected) {
    return rects;
  }
  for (const el of root.querySelectorAll("[data-strip-key]")) {
    const key = el.dataset.stripKey;
    if (!key) {
      continue;
    }
    rects.set(key, el.getBoundingClientRect());
  }
  return rects;
}

/** FLIP tiles and group labels into their new strip positions. */
export function playLightStripLayout(root, before, { matchedOnly = false } = {}) {
  if (!root || !before?.size) {
    return;
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  for (const el of root.querySelectorAll("[data-strip-key]")) {
    const key = el.dataset.stripKey;
    const prev = key ? before.get(key) : null;
    if (!prev || prev.width < 1) {
      if (matchedOnly) {
        continue;
      }
      el.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 180,
        easing: "ease-out",
      });
      continue;
    }
    const next = el.getBoundingClientRect();
    const dx = prev.left - next.left;
    const dy = prev.top - next.top;
    if (Math.hypot(dx, dy) < 1) {
      continue;
    }
    // Groups use backdrop-filter, which traps z-index. Lift the moving item
    // onto the strip for the flight so it paints above every group and tile.
    const host = el.parentElement;
    let placeholder = null;
    if (host && host !== root) {
      const rootBox = root.getBoundingClientRect();
      placeholder = document.createElement("div");
      placeholder.setAttribute("aria-hidden", "true");
      placeholder.style.flex = "0 0 auto";
      placeholder.style.width = `${next.width}px`;
      placeholder.style.height = `${next.height}px`;
      placeholder.style.visibility = "hidden";
      host.insertBefore(placeholder, el);
      root.appendChild(el);
      el.style.position = "absolute";
      el.style.left = `${next.left - rootBox.left}px`;
      el.style.top = `${next.top - rootBox.top}px`;
      el.style.width = `${next.width}px`;
      el.style.height = `${next.height}px`;
      el.style.margin = "0";
    }
    el.style.zIndex = "30";
    const anim = el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: "translate(0px, 0px)" },
      ],
      { duration: 280, easing: "cubic-bezier(0.2, 0, 0, 1)" }
    );
    let restored = false;
    const restore = () => {
      if (restored) {
        return;
      }
      restored = true;
      el.style.position = "";
      el.style.left = "";
      el.style.top = "";
      el.style.width = "";
      el.style.height = "";
      el.style.margin = "";
      el.style.zIndex = "";
      if (placeholder?.isConnected) {
        placeholder.replaceWith(el);
      } else if (host?.isConnected && el.parentElement === root) {
        host.appendChild(el);
      }
    };
    anim.addEventListener("finish", restore);
    anim.addEventListener("cancel", restore);
  }
}

export function createLightTile({ entityId, name, makeIcon, tapOnly = false }) {
  const selector = document.createElement("div");
  selector.className = "simple-light-selector";
  selector.dataset.entityId = entityId;
  selector.dataset.stripKey = entityId;
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
  const ripple = document.createElement("ha-ripple");
  tile.append(
    fill,
    makeLabels("layer-off", name, makeIcon),
    makeLabels("layer-on", name, makeIcon),
    hit,
    ripple
  );
  const frame = document.createElement("div");
  frame.className = "simple-light-frame";
  frame.appendChild(tile);
  selector.appendChild(frame);
  return { selector, tile, hit };
}

function actionButton(className, iconName, label, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `light-action ${className}`;
  btn.setAttribute("aria-label", label);
  const icon = document.createElement("ha-icon");
  icon.setAttribute("icon", iconName);
  btn.appendChild(icon);
  const stop = (ev) => {
    ev.stopPropagation();
  };
  btn.addEventListener("pointerdown", stop);
  btn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    ev.preventDefault();
    onClick?.();
  });
  return btn;
}

/**
 * Settings and remove share a plate above the tile. Power is a full-width
 * plate below it. Both stay tucked behind the tile until hover or selection.
 */
export function attachLightActions(
  selector,
  { removeLabel, onRemove, settingsLabel, onSettings, powerLabel, onPower } = {}
) {
  const tray = document.createElement("div");
  tray.className = "light-tile-actions";
  const top = document.createElement("div");
  top.className = "light-tile-actions-top";
  const bottom = document.createElement("div");
  bottom.className = "light-tile-actions-bottom";
  if (onSettings) {
    top.appendChild(
      actionButton("light-settings", "mdi:cog", settingsLabel, onSettings)
    );
  }
  if (onRemove) {
    top.appendChild(
      actionButton("light-remove", "mdi:close", removeLabel, onRemove)
    );
  }
  if (onPower) {
    bottom.appendChild(
      actionButton("light-power", "mdi:power", powerLabel, onPower)
    );
  }
  tray.append(top, bottom);
  const frame = selector.querySelector(".simple-light-frame");
  if (frame) {
    frame.insertBefore(tray, frame.firstChild);
  } else {
    selector.insertBefore(tray, selector.firstChild);
  }
  const powerBtn = bottom.querySelector(".light-power");
  const tile = selector.querySelector(".simple-light-tile");
  if (powerBtn && tile) {
    const off = tile.classList.contains("is-off");
    powerBtn.classList.toggle("is-off", off);
    powerBtn.setAttribute("aria-pressed", off ? "false" : "true");
  }
  return tray;
}

export function createLightModeGroup({
  label,
  selectAllLabel,
  onSelectAll,
  groupKey,
  plain = false,
}) {
  const group = document.createElement("div");
  group.className = "light-mode-group";
  if (groupKey) {
    group.dataset.group = groupKey;
  }
  const button = document.createElement(plain ? "div" : "button");
  if (!plain) {
    button.type = "button";
  }
  button.className = plain ? "light-mode-label plain" : "light-mode-label";
  if (groupKey) {
    button.dataset.stripKey = `group:${groupKey}`;
  }
  button.setAttribute(
    "aria-label",
    plain || !selectAllLabel ? label : `${label}. ${selectAllLabel}`
  );
  const select = document.createElement("span");
  select.className = "light-mode-select";
  const selectIcon = document.createElement("ha-icon");
  selectIcon.setAttribute("icon", "mdi:select-all");
  selectIcon.setAttribute("aria-hidden", "true");
  select.appendChild(selectIcon);
  const name = document.createElement("span");
  name.className = "light-mode-name";
  name.textContent = label;
  button.append(name, select);
  if (!plain) {
    button.addEventListener("click", (ev) => {
      ev.stopPropagation();
      onSelectAll?.(ev);
    });
  }
  const row = document.createElement("div");
  row.className = "light-mode-row";
  group.append(button, row);
  return { group, row };
}

/** How far a sticky group title has been held, and how its ramp meets the group. */
export function groupTitleStickState({
  naturalLeft,
  labelLeft,
  labelRight,
  innerRight,
  innerRadius = 23,
  rampReach = 40,
} = {}) {
  const shift = Math.max(0, labelLeft - naturalLeft);
  const stuck = shift > 0.5;
  const extra = stuck
    ? Math.max(0, Math.min(rampReach, innerRight - labelRight))
    : 0;
  const flat = stuck && shift >= innerRadius;
  return {
    shift: stuck ? shift : 0,
    stuck,
    extra,
    // Stay on the group's corner until that curve has slid past the title.
    rampLeft: stuck && !flat ? shift : 0,
    radius: flat ? 0 : innerRadius,
  };
}

const GROUP_TITLE_RAMP_REACH = 40;

export function bindGroupTitleStick(scroller) {
  if (!scroller) {
    return () => {};
  }
  if (scroller._groupTitleStick) {
    return scroller._groupTitleStick;
  }
  const sync = () => {
    for (const label of scroller.querySelectorAll(".light-mode-label")) {
      const group = label.parentElement;
      if (!group?.classList.contains("light-mode-group")) {
        continue;
      }
      const groupRect = group.getBoundingClientRect();
      const labelRect = label.getBoundingClientRect();
      const style = getComputedStyle(group);
      const pad = parseFloat(style.paddingRight) || 0;
      const border = parseFloat(style.borderRightWidth) || 0;
      const padLeft = parseFloat(style.paddingLeft) || 0;
      const borderLeft = parseFloat(style.borderLeftWidth) || 0;
      const innerRadius = Math.max(
        0,
        (parseFloat(style.borderTopLeftRadius) || 0) - borderLeft
      );
      const state = groupTitleStickState({
        naturalLeft: groupRect.left + borderLeft + padLeft,
        labelLeft: labelRect.left,
        labelRight: labelRect.right,
        innerRight: groupRect.right - border - pad,
        innerRadius,
        rampReach: GROUP_TITLE_RAMP_REACH,
      });
      label.classList.toggle("is-stuck", state.stuck);
      label.style.setProperty("--stuck-shift", `${state.shift}px`);
      label.style.setProperty("--ramp-extra", `${state.extra}px`);
      label.style.setProperty("--ramp-left", `${state.rampLeft}px`);
      label.style.setProperty("--ramp-radius", `${state.radius}px`);
    }
  };
  scroller.addEventListener("scroll", sync, { passive: true });
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(sync);
    observer.observe(scroller);
  }
  scroller._groupTitleStick = sync;
  sync();
  return sync;
}

export function createLightTilesHint(text) {
  const hint = document.createElement("p");
  hint.className = "light-tiles-hint";
  const icon = document.createElement("ha-icon");
  icon.setAttribute("icon", "mdi:information-outline");
  icon.setAttribute("aria-hidden", "true");
  const copy = document.createElement("span");
  copy.textContent = text;
  hint.append(icon, copy);
  return hint;
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
    brightnessLabel: "",
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

/** Per notch; was 8. One-third so the light-tile strip is usable with a mouse wheel. */
export const TILE_BRIGHTNESS_WHEEL_STEP = 8 / 3;

/** On/off tiles resist, then snap once the fill crosses halfway. Matches huemane. */
export const BINARY_DRAG_RESISTANCE = 0.56;

export function binaryDragPreview({ startFill, deltaPct }) {
  const resistant = startFill + deltaPct * BINARY_DRAG_RESISTANCE;
  const preview = Math.max(0, Math.min(100, resistant));
  return {
    preview,
    snapOn: startFill < 50 && resistant >= 50,
    snapOff: startFill > 50 && resistant <= 50,
  };
}

/** Wheel delta in percent. Mouse notch ≈ 3.6; trackpad follows pixels. */
export function wheelDeltaToPercent(ev) {
  if (ev.deltaMode === 1) {
    return (ev.deltaY > 0 ? -1 : 1) * 1.2 * 3;
  }
  if (ev.deltaMode === 2) {
    return (ev.deltaY > 0 ? -1 : 1) * 1.2 * 8;
  }
  return (-ev.deltaY / 13.333) * 1.2;
}

export function binaryWheelPreview({ startFill, stepPct }) {
  const next = Math.max(
    0,
    Math.min(100, startFill + stepPct * BINARY_DRAG_RESISTANCE * 3)
  );
  return {
    preview: next,
    snapOn: startFill < 50 && next >= 50,
    snapOff: startFill > 50 && next <= 50,
  };
}

export function playLightTileJelly(tile) {
  if (!tile) {
    return;
  }
  tile.classList.remove("jelly-snap");
  void tile.offsetWidth;
  tile.classList.add("jelly-snap");
  window.setTimeout(() => tile.classList.remove("jelly-snap"), 520);
}

const COLOR_GROUP_ORDER = ["color", "temp", "white", "brightness", "onoff"];

/**
 * Bucket a stored light draft. A palette reference groups lights that can
 * be drawn on that disk: bulbs that do color and kelvin on any palette,
 * RGB-only bulbs unless the palette mixes kelvin and color, temperature
 * bulbs only when every slot is kelvin. A mixed palette leaves RGB-only
 * bulbs in the color group and temperature bulbs in the temperature group. On/off and brightness bulbs stay in their own groups.
 * When caps are known and the bulb cannot do color or kelvin, a stale
 * color_temp draft still belongs in the brightness group.
 */
export function lightTileColorGroup(draft, caps, paletteIds, tempOnlyPaletteIds, mixedPaletteIds) {
  // Capability wins over a theme color that was copied onto every light.
  if (caps?.onOff || draft?.color_mode === "onoff") {
    return "onoff";
  }
  if (caps?.known && !caps.hasColor && !caps.hasTemp) {
    if (draft?.color_mode === "white") {
      return "white";
    }
    return "brightness";
  }
  const ref = draft?.variable_ref;
  const linked = Boolean(ref && paletteIds?.has?.(ref));
  const canDrawColor = caps?.known
    ? Boolean(caps.hasColor)
    : !["color_temp", "white", "onoff", "brightness"].includes(draft?.color_mode);
  const tempOnlyBulb = caps?.known
    ? Boolean(caps.hasTemp) && !caps.hasColor
    : draft?.color_mode === "color_temp";
  const colorOnlyBulb = caps?.known ? Boolean(caps.hasColor) && !caps.hasTemp : false;
  const mixedBlocked = colorOnlyBulb && mixedPaletteIds?.has?.(ref);
  if (
    linked &&
    ((canDrawColor && !mixedBlocked) || (tempOnlyBulb && tempOnlyPaletteIds?.has?.(ref)))
  ) {
    return `palette:${ref}`;
  }
  if (caps?.known && !caps.hasColor) {
    if (caps.hasTemp) {
      return "temp";
    }
    if (draft?.color_mode === "white") {
      return "white";
    }
    if (caps.onOff || draft?.color_mode === "onoff") {
      return "onoff";
    }
    return "brightness";
  }
  const mode = draft?.color_mode;
  if (mode === "color_temp") {
    return "temp";
  }
  if (mode === "white") {
    return "white";
  }
  if (mode === "onoff") {
    return "onoff";
  }
  if (mode === "brightness") {
    return "brightness";
  }
  if (mode === "hs" || mode === "rgb" || mode === "rgbw" || mode === "rgbww" || mode === "xy") {
    return "color";
  }
  if (draft?.hs_color || draft?.rgb_color || draft?.rgbw_color || draft?.rgbww_color) {
    return "color";
  }
  if (draft?.color_temp_kelvin != null) {
    return "temp";
  }
  return "brightness";
}

export function lightTileGroupOrder(extraKeys = []) {
  const palettes = extraKeys.filter((key) => String(key).startsWith("palette:"));
  return [...palettes, ...COLOR_GROUP_ORDER];
}

const actionRevealTimers = new WeakMap();

/** Skip the hover delay so a new selection shows its actions on this frame. */
export function revealLightActionsNow(root) {
  const tiles = root?.classList?.contains("light-tiles")
    ? root
    : root?.querySelector?.(".light-tiles");
  if (!tiles) {
    return;
  }
  tiles.classList.add("actions-now");
  const pending = actionRevealTimers.get(tiles);
  if (pending) {
    window.clearTimeout(pending);
  }
  actionRevealTimers.set(
    tiles,
    window.setTimeout(() => {
      tiles.classList.remove("actions-now");
      actionRevealTimers.delete(tiles);
    }, 400)
  );
}

/**
 * Plain click replaces the selection. A plain click on the only selected id
 * clears it. Cmd/Ctrl toggles one id. Shift selects the inclusive range from
 * the anchor through the clicked id.
 */
export function tileSelectionAfterClick({
  ids,
  selected,
  anchorId,
  entityId,
  shiftKey,
  toggleKey,
}) {
  const order = ids || [];
  if (
    shiftKey &&
    anchorId &&
    order.includes(anchorId) &&
    order.includes(entityId)
  ) {
    const start = order.indexOf(anchorId);
    const end = order.indexOf(entityId);
    const [from, to] = start < end ? [start, end] : [end, start];
    return { selected: order.slice(from, to + 1), anchorId };
  }
  if (toggleKey) {
    const next = new Set(selected || []);
    if (next.has(entityId)) {
      next.delete(entityId);
    } else {
      next.add(entityId);
    }
    return { selected: order.filter((id) => next.has(id)), anchorId: entityId };
  }
  const current = selected || [];
  if (current.length === 1 && current[0] === entityId) {
    return { selected: [], anchorId: null };
  }
  return { selected: [entityId], anchorId: entityId };
}

/**
 * A plain click selects the group, or drops those ids when they are already
 * all selected. Cmd, Ctrl, and Shift add the group, or drop it in that same case.
 */
export function groupSelectionAfterClick({ ids, selected, toggleKey }) {
  const group = ids || [];
  const current = [...(selected || [])];
  const allIn =
    group.length > 0 && group.every((id) => current.includes(id));
  if (toggleKey) {
    if (allIn) {
      const next = current.filter((id) => !group.includes(id));
      return { selected: next, anchorId: next[0] ?? null };
    }
    const next = [...current];
    for (const id of group) {
      if (!next.includes(id)) {
        next.push(id);
      }
    }
    return { selected: next, anchorId: group[0] ?? null };
  }
  if (allIn) {
    const next = current.filter((id) => !group.includes(id));
    return { selected: next, anchorId: next[0] ?? null };
  }
  return { selected: [...group], anchorId: group[0] ?? null };
}

/** Vertical drag + wheel brightness (0–255). Horizontal pan stays strip scroll. */
export function bindLightTileBrightness(tile, hit, {
  isEditable,
  getBrightness,
  setBrightness,
  onDragEnd,
  isBinary,
  onBlocked,
}) {
  let drag = null;
  let wheelAxis = null;
  let wheelAxisTimer = null;
  let historyPending = false;
  let binaryPreview = null;
  let wheelRevert = null;

  const currentFill = () => ((Number(getBrightness()) || 0) / 255) * 100;

  const paintPreview = (pct) => {
    const clamped = Math.max(0, Math.min(100, pct));
    tile.style.setProperty("--hue-light-fill", `${clamped}%`);
    tile.classList.toggle("is-off", clamped <= 0);
    const label = isBinary?.()
      ? lightTileValueLabel(currentFill(), { onOff: true })
      : lightTileValueLabel(clamped);
    for (const el of tile.querySelectorAll(".simple-light-bri")) {
      el.textContent = label;
    }
  };

  const applyBri = (next) => {
    const value = Math.max(0, Math.min(255, Math.round(Number(next) || 0)));
    setBrightness(value, { history: historyPending });
    historyPending = false;
  };

  const commitBinary = (on) => {
    binaryPreview = null;
    applyBri(on ? 255 : 0);
    playLightTileJelly(tile);
  };

  const endDrag = (ev) => {
    if (!drag || (ev && ev.pointerId !== drag.pointerId)) {
      return;
    }
    document.removeEventListener("pointermove", onDocMove);
    document.removeEventListener("pointerup", endDrag);
    document.removeEventListener("pointercancel", endDrag);
    try {
      tile.releasePointerCapture(drag.pointerId);
    } catch (_err) {
      /* already released */
    }
    if (drag.suppressTap) {
      tile._lightTileSuppressTap = true;
      window.setTimeout(() => {
        tile._lightTileSuppressTap = false;
      }, 0);
    }
    const wasY = drag.axis === "y";
    const revertPreview = wasY && isBinary?.() && binaryPreview != null;
    drag = null;
    if (revertPreview) {
      binaryPreview = null;
      paintPreview(currentFill());
    }
    window.setTimeout(() => tile.classList.remove("dragging"), 250);
    if (wasY) {
      onDragEnd?.();
    }
  };

  const onDocMove = (ev) => {
    if (!drag || ev.pointerId !== drag.pointerId) {
      return;
    }
    const dx = ev.clientX - drag.startX;
    const dy = ev.clientY - drag.startY;
    if (!drag.axis) {
      if (Math.hypot(dx, dy) < 8) {
        return;
      }
      if (Math.abs(dx) > Math.abs(dy)) {
        drag.axis = "x";
        drag.suppressTap = true;
        return;
      }
      drag.axis = "y";
      drag.suppressTap = true;
      if (!isEditable()) { drag.axis = "blocked"; onBlocked?.(); endDrag(ev); return; }
      historyPending = true;
      tile.classList.add("dragging");
      try {
        tile.setPointerCapture(ev.pointerId);
      } catch (_err) {
        /* ignore */
      }
      return;
    }
    if (drag.axis !== "y" || !isEditable()) {
      return;
    }
    ev.preventDefault();
    const rect = tile.getBoundingClientRect();
    if (isBinary?.()) {
      const deltaPct = -((ev.clientY - drag.startY) / Math.max(1, rect.height)) * 100;
      const step = binaryDragPreview({ startFill: drag.startFill, deltaPct });
      if (step.snapOn || step.snapOff) {
        commitBinary(Boolean(step.snapOn));
        drag.startFill = step.snapOn ? 100 : 0;
        drag.startY = ev.clientY;
        paintPreview(drag.startFill);
      } else {
        binaryPreview = step.preview;
        paintPreview(step.preview);
      }
      return;
    }
    const fromBottom = rect.bottom - ev.clientY;
    applyBri(
      (Math.max(0, Math.min(100, (fromBottom / rect.height) * 100)) / 100) * 255
    );
  };

  hit.addEventListener("pointerdown", (ev) => {
    if ((ev.button && ev.button !== 0) || (!isEditable() && !onBlocked)) {
      return;
    }
    historyPending = true;
    binaryPreview = null;
    drag = {
      pointerId: ev.pointerId,
      startX: ev.clientX,
      startY: ev.clientY,
      startFill: isEditable() ? currentFill() : 0,
      axis: null,
      suppressTap: false,
    };
    document.addEventListener("pointermove", onDocMove);
    document.addEventListener("pointerup", endDrag);
    document.addEventListener("pointercancel", endDrag);
  });

  tile.addEventListener(
    "wheel",
    (ev) => {
      const absX = Math.abs(ev.deltaX);
      const absY = Math.abs(ev.deltaY);
      const wantsHorizontal = ev.shiftKey || (absX > 0 && absX >= absY);
      if (wheelAxis === "x" || (wantsHorizontal && wheelAxis !== "y")) {
        wheelAxis = "x";
        window.clearTimeout(wheelAxisTimer);
        wheelAxisTimer = window.setTimeout(() => {
          wheelAxis = null;
        }, 180);
        return;
      }
      if (absY === 0) { return; }
      if (!isEditable()) { onBlocked?.(); return; }
      if (wheelAxis !== "y") {
        historyPending = true;
      }
      wheelAxis = "y";
      window.clearTimeout(wheelAxisTimer);
      wheelAxisTimer = window.setTimeout(() => {
        wheelAxis = null;
        onDragEnd?.();
      }, 180);
      ev.preventDefault();
      tile.classList.add("wheel-adjusting");
      if (isBinary?.()) {
        const start = binaryPreview ?? currentFill();
        const step = binaryWheelPreview({
          startFill: start,
          stepPct: wheelDeltaToPercent(ev),
        });
        if (step.snapOn || step.snapOff) {
          window.clearTimeout(wheelRevert);
          commitBinary(Boolean(step.snapOn));
          paintPreview(step.snapOn ? 100 : 0);
        } else {
          binaryPreview = step.preview;
          paintPreview(step.preview);
          window.clearTimeout(wheelRevert);
          wheelRevert = window.setTimeout(() => {
            wheelRevert = null;
            binaryPreview = null;
            paintPreview(currentFill());
          }, 280);
        }
      } else {
        applyBri(
          (Number(getBrightness()) || 0) -
            Math.sign(ev.deltaY) * TILE_BRIGHTNESS_WHEEL_STEP
        );
      }
      window.setTimeout(() => tile.classList.remove("wheel-adjusting"), 250);
    },
    { passive: false }
  );
}
