/* Shadow styles in their original order; keep component styles last. */
import { EVENT_EDITOR_CSS } from "./event_editor.js";
import {
  EDITOR_CONTAINER_CSS,
  EDITOR_SHELL_MOTION_CSS,
  EDITOR_LIBRARY_PREVIEW_CSS,
  EDITOR_SHELL_CSS,
  EDITOR_SHELL_LAYOUT_CSS,
} from "./editor_shell.js";
import { LANDING_CSS } from "./landing.js";
import { SIMPLE_EDITOR_CSS } from "./simple_editor.js";
import {
  CLOCK_VIEW,
  CLOCK_RINGS_OUTER,
  CLOCK_CHROME_PX,
  CLOCK_SCRUB_RAIL_PX,
  CLOCK_SCRUB_RAIL_PAD_PX,
  WHEEL_FACE_MIN_PX,
  DIAL_FACE_MIN_PX,
  WHEEL_FACE_MAX_PX,
  CLOCK_RINGS_INSET_PCT,
  CLOCK_NIGHT_OUTER_LIGHT,
  CLOCK_NIGHT_DEEP_LIGHT,
  CLOCK_NIGHT_OUTER_DARK,
  CLOCK_NIGHT_DEEP_DARK,
  CLOCK_SUN_SIZE_PCT,
  CLOCK_TICK_OUTER,
  SIDEBAR_ANIMATION_MS,
  SIDEBAR_SWAP_MS,
  CLOCK_FEATHER_PCT,
} from "./panel_constants.js";

export const PANEL_STYLES = `
        :host {
          display: block;
          position: relative;
          width: 100%;
          /* 100vh fills when ha-panel-custom reports 0 height; max-height
             caps to the panel outlet when that height is definite — otherwise
             host > parent and HA’s shell scrolls beside ha-top-app-bar. */
          height: 100vh;
          max-height: 100%;
          overflow: hidden;
          --scene-safe-bottom: max(
            var(--safe-area-inset-bottom, 0px),
            env(safe-area-inset-bottom, 0px)
          );
          background: var(--primary-background-color);
          color: var(--primary-text-color);
          --scene-sidebar-gutter: 0px;
          --selected-ring-color: rgb(255 255 255 / 75%);
          /* Night wedges: warm gray in light; near-black in dark. */
          --clock-night-outer: ${CLOCK_NIGHT_OUTER_LIGHT};
          --clock-night-deep: ${CLOCK_NIGHT_DEEP_LIGHT};
        }
        :host([data-dark-mode]) {
          --clock-night-outer: ${CLOCK_NIGHT_OUTER_DARK};
          --clock-night-deep: ${CLOCK_NIGHT_DEEP_DARK};
        }
        /* Dial L/T/R surface vignette — fixed to the panel host (full width /
           height), not .sun-path. Tying it to --scene-sidebar-gutter made the
           gradient box resize with the drawer and artifact mid-transition. */
        :host([data-dial-view])::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 2;
          pointer-events: none;
          background:
            linear-gradient(
              to right,
              color-mix(in srgb, var(--primary-background-color) 50%, transparent) 0%,
              color-mix(in srgb, var(--primary-background-color) 28%, transparent) 72px,
              color-mix(in srgb, var(--primary-background-color) 10%, transparent) 160px,
              transparent 260px
            ),
            linear-gradient(
              to left,
              color-mix(in srgb, var(--primary-background-color) 50%, transparent) 0%,
              color-mix(in srgb, var(--primary-background-color) 28%, transparent) 72px,
              color-mix(in srgb, var(--primary-background-color) 10%, transparent) 160px,
              transparent 260px
            ),
            linear-gradient(
              to bottom,
              color-mix(in srgb, var(--primary-background-color) 50%, transparent) 0%,
              color-mix(in srgb, var(--primary-background-color) 28%, transparent) 100px,
              color-mix(in srgb, var(--primary-background-color) 10%, transparent) 220px,
              transparent 360px
            );
        }
        /* ha-panel-custom often computes to 0 height, so 100% on the app bar
           collapses. Fill the viewport, then stretch the bar to this host. */
        ha-top-app-bar-fixed {
          height: 100% !important;
        }
        .sun-path {
          /* No HA card chrome — clock/plots sit on the panel surface. */
          background: transparent;
          border: none;
          border-radius: 0;
          margin-top: 0;
          overflow: visible;
          position: relative;
        }
        .sun-path[hidden] {
          display: none;
        }
        .sun-path-stage {
          display: block;
        }
        /* Landscape clock: timeline in the right column; matching empty left
           column keeps the dial optically centered in the full stage while
           the rail still reduces the width available for the dial. */
        .sun-path-stage.landscape-clock-scrub {
          --scrub-rail-width: ${CLOCK_SCRUB_RAIL_PX}px;
          display: grid;
          grid-template-columns:
            var(--scrub-rail-width)
            minmax(0, 1fr)
            var(--scrub-rail-width);
          align-items: start;
          width: 100%;
          box-sizing: border-box;
          /* Right pad so the timeline is not flush to the panel edge; the
             matching left column still optically centers the dial. */
          padding-right: ${CLOCK_SCRUB_RAIL_PAD_PX}px;
          overflow: visible;
        }
        .sun-path-stage.landscape-clock-scrub.scrub-collapsed {
          --scrub-rail-width: 0px;
          padding-right: 0;
        }
        .sun-path-stage.landscape-clock-scrub .sun-path-body {
          grid-column: 2;
          width: 100%;
          min-width: 0;
          height: 100%;
          align-self: stretch;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .sun-year-scrub-rail {
          display: none;
          grid-column: 3;
          position: relative;
          width: 100%;
          min-width: 0;
          /* Visible so date chips can grow left into the dial column. */
          overflow: visible;
          opacity: 1;
          box-sizing: border-box;
          z-index: 3;
          flex-direction: column;
          align-items: stretch;
          gap: 6px;
          transition: opacity ${SIDEBAR_ANIMATION_MS}ms cubic-bezier(0.2, 0, 0, 1);
        }
        .sun-path-stage.landscape-clock-scrub .sun-year-scrub-rail {
          display: flex;
          /* Match portrait toolbar top inset under the app bar. */
          padding-top: 12px;
        }
        .sun-path-stage.landscape-clock-scrub.scrub-collapsed .sun-year-scrub-rail {
          opacity: 0;
          pointer-events: none;
        }
        .sun-scrub-block {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 4px;
          width: 100%;
        }
        .sun-year-scrub-rail .sun-scrub-block {
          flex: 1 1 auto;
          min-height: 0;
          height: 100%;
        }
        .sun-date-tools {
          display: flex;
          /* Table: date first (row-reverse of chips→date DOM). */
          flex-direction: row-reverse;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          justify-content: flex-end;
        }
        /* Dial portrait: chips left of day/month.
           Above horizon bleed (sky/glow can extend past the face). */
        .sun-path.dial-view .sun-date-tools {
          position: relative;
          z-index: 3;
          flex-direction: row;
          flex-wrap: wrap;
          align-items: center;
          justify-content: flex-start;
          gap: 8px;
        }
        .sun-year-scrub-rail .sun-date-tools {
          /* Chips above date; pack to the rail’s right edge. */
          flex-direction: column;
          align-items: stretch;
          width: 100%;
          max-width: 100%;
          overflow: visible;
          gap: 4px;
          box-sizing: border-box;
          padding-inline-end: 2px;
        }
        .sun-chip-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }
        .sun-year-scrub-rail .sun-chip-row {
          /* width:100% + flex-end: right edge stays in the rail; overflow grows
             left into the dial. (max-content + margin-left:auto left-aligns when
             chips are wider than the 88px rail and spills off-screen.) */
          flex-direction: row;
          flex-wrap: nowrap;
          justify-content: flex-end;
          align-items: center;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          gap: 4px;
          overflow: visible;
        }
        .sun-year-scrub-rail .sun-chip {
          flex: 0 0 auto;
          white-space: nowrap;
        }
        .sun-scrub-date {
          position: relative;
          appearance: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          margin: 0;
          padding: 2px 4px;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: var(--primary-text-color);
          font: inherit;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.2;
          white-space: nowrap;
          cursor: pointer;
        }
        .sun-year-scrub-rail .sun-scrub-date {
          align-self: stretch;
          justify-content: flex-end;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          font-size: 26px;
          line-height: 1.15;
          padding: 2px 0;
        }
        .sun-scrub-date:hover {
          background: color-mix(
            in srgb,
            var(--primary-color) 12%,
            transparent
          );
        }
        .sun-scrub-date:focus-visible {
          outline: 2px solid var(--primary-color);
          outline-offset: 2px;
        }
        .sun-scrub-date-reset {
          --mdc-icon-size: 18px;
          color: var(--primary-text-color);
        }
        .sun-scrub-date-reset[hidden] {
          display: none;
        }
        /* Right-aligned date: icon sits in front of the text. */
        .sun-year-scrub-rail .sun-scrub-date-reset {
          order: -1;
          --mdc-icon-size: 22px;
        }
        /* Visually hidden but mounted — opened via ha-date-input._openDialog.
           Keep it laid out (not display:none) so the selector finishes upgrading.
           clip-path + contain so the upgraded control cannot widen scrollWidth. */
        .sun-date-picker-host {
          position: absolute;
          width: 1px;
          height: 1px;
          margin: 0;
          padding: 0;
          overflow: hidden;
          clip-path: inset(50%);
          contain: strict;
          opacity: 0;
          pointer-events: none;
        }
        .sun-toolbar {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 4px;
          padding: 12px 16px 0;
          position: relative;
          z-index: 3;
        }
        /* Portrait dial: toolbar is in-flow so the year scrub pushes the dial
           down (ticks stay clear). Horizon glow still bleeds behind it
           (_layoutClockHorizonBack covers the host). Flush left so Now/Sun°
           meet the page edge like chips (no shared 16px inset). */
        .sun-path.dial-view .sun-toolbar {
          position: relative;
          z-index: 6;
          box-sizing: border-box;
          pointer-events: none;
          background: transparent;
          padding: 8px 12px 0 16px;
        }
        /* Desktop landscape: the chip/play row overlays the dial so the face
           can grow into that band. The year rail stays in the grid. */
        .sun-path.dial-view:has(.sun-path-stage.landscape-clock-scrub) > .sun-toolbar {
          position: absolute;
          top: 0;
          left: 0;
          /* Stop the chip row on the dial column so it does not cover the date. */
          right: calc(${CLOCK_SCRUB_RAIL_PX}px + ${CLOCK_SCRUB_RAIL_PAD_PX}px);
        }
        .sun-path.dial-view:has(.sun-path-stage.scrub-collapsed) > .sun-toolbar {
          right: 0;
        }
        .sun-path.dial-view:has(.sun-path-stage.landscape-clock-scrub) .sun-light-clock {
          justify-content: flex-start;
          /* The date row is absolute, so this pad keeps the face below it.
             8px toolbar padding + 32px chip row. */
          padding-top: 40px;
        }
        .sun-path.dial-view:has(.sun-path-stage.landscape-clock-scrub) .sun-light-clock-legend {
          margin-top: auto;
        }
        .sun-path.dial-view .sun-toolbar > * {
          pointer-events: auto;
        }
        /* Time/sun + date chips share one full-width wrapping row. */
        .sun-toolbar-chrome {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: flex-start;
          gap: 8px 12px;
          width: 100%;
          box-sizing: border-box;
        }
        /* Time sits in the chrome row (not an overlay readout). */
        .sun-path.dial-view .sun-toolbar-chrome .sun-hover-readout {
          position: static;
          top: auto;
          left: auto;
          z-index: auto;
          display: flex;
          flex-wrap: nowrap;
          align-items: center;
          gap: 8px 16px;
          flex: 0 1 auto;
          max-width: none;
          min-width: 0;
          /* Match chip / reset row height so time+deg stay put when reset appears. */
          min-height: 32px;
          margin: 0;
          padding: 0;
          pointer-events: none;
          color: var(--primary-text-color);
          font-weight: 500;
        }
        .sun-path.dial-view .sun-toolbar-chrome .sun-hover-time {
          font-weight: 600;
          color: var(--primary-text-color);
        }
        .sun-path.dial-view .sun-toolbar-chrome .sun-hover-reset-slot {
          flex: 0 0 32px;
          width: 32px;
          height: 32px;
          display: inline-grid;
          place-items: center;
          pointer-events: none;
        }
        .sun-path.dial-view .sun-toolbar-chrome .sun-hover-reset {
          pointer-events: auto;
        }
        .sun-toolbar-chrome .sun-chip-row {
          flex: 0 1 auto;
          margin-left: auto;
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .sun-toolbar-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }
        .sun-year-scrub {
          position: relative;
          width: 100%;
          margin: 4px 0 8px;
          touch-action: none;
          user-select: none;
          outline: none;
          cursor: pointer;
        }
        /* Keyboard only — pointerdown must not paint a focus ring (do not
           call .focus() from the scrub pointer handler). */
        .sun-year-scrub:focus {
          outline: none;
          box-shadow: none;
        }
        .sun-year-scrub:focus-visible {
          box-shadow: 0 0 0 2px var(--primary-color);
          border-radius: 8px;
        }
        .sun-year-months {
          position: relative;
          height: 16px;
          margin-bottom: 2px;
        }
        .sun-year-months span {
          position: absolute;
          top: 0;
          font-size: 11px;
          line-height: 16px;
          color: var(--secondary-text-color);
          pointer-events: none;
          white-space: nowrap;
        }
        .sun-year-track {
          position: relative;
          height: 20px;
        }
        .sun-year-bar,
        .sun-year-fill {
          position: absolute;
          left: 0;
          top: 8px;
          height: 4px;
          border-radius: 2px;
        }
        .sun-year-bar {
          right: 0;
          background: var(--divider-color);
        }
        .sun-year-fill {
          background: var(--primary-color);
          opacity: 0.35;
        }
        .sun-year-today {
          position: absolute;
          top: 4px;
          width: 2px;
          height: 12px;
          margin-left: -1px;
          background: var(--secondary-text-color);
          pointer-events: none;
        }
        .sun-year-today[hidden] {
          display: none;
        }
        .sun-year-thumb {
          position: absolute;
          top: 4px;
          width: 16px;
          height: 16px;
          margin-left: -8px;
          border-radius: 50%;
          background: var(--primary-color);
          box-shadow: 0 0 0 2px var(--card-background-color);
          pointer-events: none;
        }
        /* Portrait / table: horizontal under the date row (default above).
           Landscape + clock: vertical rail to the right of the face. */
        .sun-year-scrub.vertical {
          display: flex;
          flex-direction: row;
          align-items: stretch;
          flex: 1 1 auto;
          width: 100%;
          min-height: 0;
          height: auto;
          margin: 0;
          padding: 2px 0;
          box-sizing: border-box;
        }
        .sun-year-scrub.vertical .sun-year-months {
          flex: 1 1 auto;
          width: auto;
          height: auto;
          margin: 0 2px 0 0;
          align-self: stretch;
        }
        .sun-year-scrub.vertical .sun-year-months span {
          left: auto;
          right: 0;
          top: 0;
          font-size: 10px;
          line-height: 1.1;
          text-align: right;
        }
        .sun-year-scrub.vertical .sun-year-track {
          flex: 0 0 20px;
          width: 20px;
          height: auto;
          align-self: stretch;
        }
        .sun-year-scrub.vertical .sun-year-bar {
          left: 8px;
          right: auto;
          top: 0;
          bottom: 0;
          width: 4px;
          height: auto;
        }
        .sun-year-scrub.vertical .sun-year-fill {
          left: 8px;
          right: auto;
          top: 0;
          width: 4px;
          height: 0;
        }
        .sun-year-scrub.vertical .sun-year-thumb {
          left: 2px;
          top: 0;
          margin-left: 0;
          margin-top: -8px;
        }
        .sun-year-scrub.vertical .sun-year-today {
          left: 4px;
          top: 0;
          width: 12px;
          height: 2px;
          margin-left: 0;
        }
        .sun-chip {
          background: transparent;
          color: var(--primary-color);
          border: 1px solid var(--divider-color);
          border-radius: 16px;
          padding: 4px 10px;
          font: inherit;
          font-size: 13px;
          cursor: pointer;
        }
        .sun-chip[selected] {
          background: var(--primary-color);
          color: var(--text-primary-color, #fff);
          border-color: var(--primary-color);
        }
        .sun-location-btn {
          color: var(--secondary-text-color);
        }
        .sun-location-btn[hidden] {
          display: none;
        }
        .sun-path.dial-view {
          --dial-timeline-h: 0px;
          /* The desktop face rule adds 24px. This stays 0 so a phone dial,
             which is not in .stage-col, stays flush under the app bar. */
          margin-top: 0;
          display: flex;
          flex-direction: column;
          /* Do not clip X here — mobile face uses width 100%+48px / −24px
             margin so ticks bleed past the column; page/dial-wide clips
             horizon bleed instead (overflow-x:hidden+visible Y → auto). */
          overflow: visible;
          /* Fallback until _syncStageFaceMax measures: fill below the header,
             keep event-label pad + gap, leave room for the light-tile strip. */
          --dial-face-max: calc(
            100vh - var(--header-height, 64px) - 40px - 16px - 180px
          );
        }
        .sun-path.dial-view .sun-toolbar {
          flex: 0 0 auto;
        }
        .sun-path.dial-view .sun-path-stage {
          flex: 1 1 auto;
          min-width: 0;
          width: 100%;
          min-height: min-content;
        }
        .sun-path.dial-view .sun-path-stage:not(.landscape-clock-scrub) {
          display: flex;
          flex-direction: column;
        }
        .sun-path.dial-view .sun-path-body {
          flex: 1 1 auto;
          min-height: min-content;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .sun-light-clock {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
          width: 100%;
          /* No horizontal padding — use the full stage column for the dial.
             Extra top pad leaves room for event labels above the face. */
          padding: 40px 0 16px;
          box-sizing: border-box;
          overflow: visible;
        }
        .sun-path.dial-view .sun-light-clock {
          position: relative;
          /* Face size comes from --dial-face-max. The floor matches the color
             wheel; below it the scrollport grows and the tiles move down.
             min-height includes the 40px label pad and the 16px under the
             face, so the square itself can stay at that floor. */
          flex: 1 1 auto;
          min-height: calc(${DIAL_FACE_MIN_PX}px + 40px + 16px);
          min-width: 0;
          width: 100%;
          gap: 16px;
          padding-bottom: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          container-type: size;
        }
        .sun-path.dial-view .sun-light-clock-legend {
          position: relative;
          /* Above dial labels (z-index 10) that overflow the face onto the tiles.
             The stage grows above this strip, so the tiles sit on the bottom
             until the dial floor makes the column scroll. */
          z-index: 12;
          width: 100%;
          max-width: none;
          align-self: stretch;
          padding-inline: 0;
          box-sizing: border-box;
          flex: 0 0 auto;
          pointer-events: auto;
        }
        /* Same column width as the dial light list (under the face). */
        .sun-light-clock-empty-hint {
          margin: 0;
          padding: 0 12px;
          max-width: min(100%, 86vh, var(--dial-face-max, 86vh));
          text-align: center;
          color: var(--secondary-text-color);
          font-size: 14px;
          line-height: 1.4;
          position: relative;
          z-index: 5;
        }
        .sun-light-clock-face {
          position: relative;
          width: min(100cqi, 100cqb, var(--dial-face-max, 86vh));
          max-width: min(100%, var(--dial-face-max, 86vh));
          aspect-ratio: 1;
          flex: 0 0 auto;
          /* A finger on the dial scrubs bands. The page must not scroll too. */
          touch-action: none;
          cursor: default;
          /* Visible so horizon glow/rays can bleed past the face. */
          overflow: visible;
          transform-origin: center center;
          --clock-chrome: ${CLOCK_CHROME_PX}px;
        }
        /* Mobile: drop hour numbers; grow the face past the column (clipped
           later — see overflow-x under .page.dial-wide) so ticks can bleed. */
        @media (max-width: 870px) {
          .sun-light-clock-face {
            width: min(
              calc(100% + 48px),
              96vh,
              var(--dial-face-max, 96vh)
            );
            max-width: min(96vh, var(--dial-face-max, 96vh));
            margin-inline: -24px;
          }
        }
        /* Sunrise/sunset shadow + glow sit behind the planet (back-most).
           Sized in JS to cover the full panel (under the sidebar).
           Isolate so screen-blend horizon wash does not composite over the
           light-band bloom that stacks above this layer. translate3d keeps
           scrub-driven background updates on their own compositor layer. */
        .clock-horizon-back {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate3d(-50%, -50%, 0);
          pointer-events: none;
          z-index: 0;
          overflow: visible;
          isolation: isolate;
          backface-visibility: hidden;
        }
        .stage-bg .clock-horizon-back {
          z-index: 0;
        }
        /* Light-band bloom between horizon wash and planet (same chrome inset
           as the core so clones stay aligned with the rings). Promoted so sun
           scrub does not re-rasterize the static bloom clones. */
        .sun-light-clock-glow-layer {
          position: absolute;
          inset: var(--clock-chrome);
          border-radius: 50%;
          pointer-events: none;
          z-index: 1;
          overflow: visible;
          transform: translateZ(0);
          backface-visibility: hidden;
        }
        /* Planet / path live in the inset core; event chips stay on the face
           so their px size does not shrink with the dial. */
        .sun-light-clock-core {
          position: absolute;
          inset: var(--clock-chrome);
          border-radius: 50%;
          pointer-events: none;
          z-index: 2;
          transform: translateZ(0);
          backface-visibility: hidden;
        }
        .sun-light-clock-core .sun-light-clock-rings {
          pointer-events: auto;
        }
        /* Enter and exit both scale up (0.92→1 in, 1→1.08 out). Overlay
           crossfade lives on .stage-motion-layer so views overlap. */
        .sun-light-clock-face.clock-face-enter {
          animation:
            stage-surface-fade-in 280ms cubic-bezier(0.2, 0, 0, 1) both,
            stage-surface-enter-scale 400ms cubic-bezier(0.2, 0, 0, 1) both;
        }
        .sun-light-clock-face.clock-face-enter .sun-light-clock-overlay {
          transform-origin: center center;
          animation: clock-overlay-spin 400ms cubic-bezier(0.2, 0, 0, 1) both;
        }
        /* Cancel overlay spin on the sun fill/glow so it stays locked to the
           HTML outline (both follow the JS enter arc only). */
        .sun-light-clock-face.clock-face-enter .clock-sun-day-group {
          transform-box: view-box;
          transform-origin: center;
          animation: clock-sun-counter-spin 400ms cubic-bezier(0.2, 0, 0, 1) both;
        }
        /* Buttons live on the face (outside the SVG overlay). Spin this layer
           around the dial center so they orbit with the path, not in place.
           Anchors counter-rotate so the icon + label stay screen-level. */
        .sun-light-clock-face.clock-face-enter .clock-event-layer {
          transform-origin: center center;
          animation: clock-overlay-spin 400ms cubic-bezier(0.2, 0, 0, 1) both;
        }
        .sun-light-clock-face.clock-face-enter .clock-event-anchor {
          animation: clock-event-counter-spin 400ms cubic-bezier(0.2, 0, 0, 1) both;
        }
        @keyframes stage-surface-fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes stage-surface-fade-out {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }
        @keyframes stage-surface-enter-scale {
          from {
            transform: scale(0.92);
          }
          to {
            transform: scale(1);
          }
        }
        @keyframes stage-surface-exit-scale {
          from {
            transform: scale(1);
          }
          to {
            transform: scale(1.08);
          }
        }
        @keyframes clock-overlay-spin {
          from {
            transform: translateZ(0) rotate(-8deg);
          }
          to {
            transform: translateZ(0) rotate(0deg);
          }
        }
        @keyframes clock-sun-counter-spin {
          from {
            transform: rotate(8deg);
          }
          to {
            transform: rotate(0deg);
          }
        }
        @keyframes clock-event-counter-spin {
          from {
            transform: translate(-50%, -50%) rotate(8deg);
          }
          to {
            transform: translate(-50%, -50%) rotate(0deg);
          }
        }
        .simple-editor-host.simple-editor-enter,
        .library-editor.simple-editor-enter,
        .empty-state.stage-surface-enter {
          transform-origin: center center;
          animation:
            stage-surface-fade-in 280ms cubic-bezier(0.2, 0, 0, 1) both,
            stage-surface-enter-scale 400ms cubic-bezier(0.2, 0, 0, 1) both;
        }
        .stage-motion-layer {
          position: absolute;
          inset: 0;
          z-index: 6;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          overflow: hidden;
          pointer-events: none;
          transform-origin: center center;
        }
        .stage-motion-layer.stage-motion-exit-active {
          animation:
            stage-surface-fade-out 280ms cubic-bezier(0.2, 0, 0, 1) both,
            stage-surface-exit-scale 400ms cubic-bezier(0.2, 0, 0, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .sun-light-clock-face.clock-face-enter,
          .simple-editor-host.simple-editor-enter,
          .library-editor.simple-editor-enter,
          .empty-state.stage-surface-enter,
          .stage-motion-layer.stage-motion-exit-active {
            animation-duration: 1ms !important;
          }
        }
        /* Registered via CSS.registerProperty (document), not @property here —
           shadow-root @property does not enable transitions. */
        /* Soft bloom from simple dial clones (same ring colors as the planet).
           Each scale is its own blurred stage (lg then md) above the horizon. */
        .sun-light-clock-glow {
          position: absolute;
          inset: ${CLOCK_RINGS_INSET_PCT}%;
          border-radius: 50%;
          pointer-events: none;
          transform-origin: center center;
          filter: blur(28px);
          /* Was 0.63; 50% less transparent → opacity 0.815 */
          opacity: 0.815;
          overflow: visible;
          /* Match soft-mode bleed so the bloom still overlaps between bands. */
          --clock-feather: ${CLOCK_FEATHER_PCT}%;
          --ring-soft-expand: ${(CLOCK_FEATHER_PCT * 1.35).toFixed(2)}%;
          backface-visibility: hidden;
        }
        /* Light theme: half the bloom so rings do not wash the pale sky. */
        :host(:not([data-dark-mode])) .sun-light-clock-glow {
          opacity: 0.4075;
        }
        .sun-light-clock-glow.glow-lg {
          transform: translateZ(0) scale(2.76);
          /* Outermost bloom: half of the shared glow opacity. */
          opacity: 0.4075;
        }
        :host(:not([data-dark-mode])) .sun-light-clock-glow.glow-lg {
          opacity: 0.20375;
        }
        .sun-light-clock-glow.glow-md {
          transform: translateZ(0) scale(1.38);
        }
        .sun-light-clock-glow .clock-ring {
          --ring-expand: var(--ring-soft-expand);
          --ring-rim-w: 0px;
          transition: none;
          filter: none;
          opacity: 1;
          transform: none;
        }
        .sun-light-clock-glow .clock-ring::after {
          content: none;
          display: none;
        }
        /* Sunrise/sunset wash — not clipped to the planet rim. Paints a
           multi-stop spectrum that ends at the surface color (normal blend). */
        .clock-horizon-glow {
          position: absolute;
          inset: 0;
          pointer-events: none;
          mix-blend-mode: normal;
          transform: translateZ(0);
          backface-visibility: hidden;
        }
        .clock-horizon-sky {
          position: absolute;
          inset: 0;
          overflow: visible;
          pointer-events: none;
        }
        .sun-light-clock-rings {
          position: absolute;
          inset: ${CLOCK_RINGS_INSET_PCT}%;
          border-radius: 50%;
          /* Above the hour handle so the planet occludes it; path/sun stay higher. */
          z-index: 7;
          overflow: visible;
          --clock-feather: ${CLOCK_FEATHER_PCT}%;
          /* Soft mode: expand bands into neighbors so opaque cores overlap —
             feather alone only overlaps fades and the surface disc shows through. */
          --ring-soft-expand: ${(CLOCK_FEATHER_PCT * 1.35).toFixed(2)}%;
          /* Sharp ↔ soft snaps instantly — animating feather/expand reads as a
             size/ramp morph on every hover. */
          cursor: pointer;
          /* Finger scrub over bands must not scroll the page. */
          touch-action: none;
          /* Filled circular planet: box-shadow matches the old drop-shadow look
             without filter-rasterizing masked conics every frame. */
          box-shadow: 0 0 32px rgba(0, 0, 0, 0.4);
          transform: translateZ(0);
          backface-visibility: hidden;
        }
        /* Surface disc under the bands so 50% rings mix with the panel color,
           not the horizon/bloom graphics behind the planet. */
        .sun-light-clock-rings::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: var(--primary-background-color);
          z-index: 0;
          pointer-events: none;
        }
        /* Soft → sharp: no feather / soft-expand so bands sit edge-to-edge.
           Include :has(.hovered) so touch scrub (no :hover) matches mouse. */
        .sun-light-clock-rings:hover,
        .sun-light-clock-rings:has(.clock-ring.selected),
        .sun-light-clock-rings:has(.clock-ring.hovered) {
          --clock-feather: 0%;
          --ring-soft-expand: 0%;
        }
        .clock-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          /* Masked rings still fill the square for hit-testing; open via
             radial pick on the host instead of per-ring clicks. */
          pointer-events: none;
          z-index: 1;
          --ring-expand: var(--ring-soft-expand);
          --ring-rim-w: 0px;
          transform-origin: center center;
          /* Opacity/filter only — expand/rim-w follow sharp/soft with no tween. */
          transition:
            opacity 180ms cubic-bezier(0.2, 0, 0, 1),
            filter 180ms cubic-bezier(0.2, 0, 0, 1);
        }
        /* Fill lives on a child so the ring mask does not clip ::after borders. */
        .clock-ring-fill {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          pointer-events: none;
        }
        /* Inner + outer rim strokes just inside the band edges (not straddling
           100%, which clipped the outer half of the outermost ring). Width is
           a fixed length so it stays 1px across dial sizes. */
        .clock-ring::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 50%;
          pointer-events: none;
          /* Hover rim: was 0.1; 40% more transparent → 0.06 */
          background: rgba(255, 255, 255, 0.06);
          opacity: 0;
          transition: opacity 180ms cubic-bezier(0.2, 0, 0, 1);
          -webkit-mask-image: radial-gradient(
            farthest-side,
            transparent calc(var(--ring-inner) - var(--ring-expand)),
            #000 calc(var(--ring-inner) - var(--ring-expand)),
            #000
              calc(
                var(--ring-inner) - var(--ring-expand) + var(--ring-rim-w)
              ),
            transparent
              calc(
                var(--ring-inner) - var(--ring-expand) + var(--ring-rim-w)
              ),
            transparent
              calc(
                var(--ring-outer) + var(--ring-expand) - var(--ring-rim-w)
              ),
            #000
              calc(
                var(--ring-outer) + var(--ring-expand) - var(--ring-rim-w)
              ),
            #000 calc(var(--ring-outer) + var(--ring-expand)),
            transparent calc(var(--ring-outer) + var(--ring-expand))
          );
          mask-image: radial-gradient(
            farthest-side,
            transparent calc(var(--ring-inner) - var(--ring-expand)),
            #000 calc(var(--ring-inner) - var(--ring-expand)),
            #000
              calc(
                var(--ring-inner) - var(--ring-expand) + var(--ring-rim-w)
              ),
            transparent
              calc(
                var(--ring-inner) - var(--ring-expand) + var(--ring-rim-w)
              ),
            transparent
              calc(
                var(--ring-outer) + var(--ring-expand) - var(--ring-rim-w)
              ),
            #000
              calc(
                var(--ring-outer) + var(--ring-expand) - var(--ring-rim-w)
              ),
            #000 calc(var(--ring-outer) + var(--ring-expand)),
            transparent calc(var(--ring-outer) + var(--ring-expand))
          );
        }
        /* Dim only siblings — :is/:has dimming outranked .hovered/.selected
           opacity:1 when applied to every .clock-ring. */
        .sun-light-clock-rings:is(
            :hover,
            :has(.clock-ring.selected),
            :has(.clock-ring.hovered)
          )
          .clock-ring:not(.hovered):not(.selected) {
          opacity: 0.5;
        }
        /* Hover/selected: stronger black shadow (2× blur), soft white rim.
           Keep rules separate — comma-grouped selectors failed to apply
           registered --ring-* props in the past. */
        .clock-ring.hovered {
          --ring-expand: 0%;
          --ring-rim-w: 1px;
          opacity: 1;
          filter:
            drop-shadow(0 4px 28px rgba(0, 0, 0, 0.75))
            drop-shadow(0 0 12px rgba(0, 0, 0, 0.45));
          z-index: 5;
        }
        .clock-ring.hovered::after {
          opacity: 1;
        }
        .clock-ring.selected {
          --ring-expand: 0%;
          --ring-rim-w: 1px;
          opacity: 1;
          filter:
            drop-shadow(0 4px 28px rgba(0, 0, 0, 0.75))
            drop-shadow(0 0 12px rgba(0, 0, 0, 0.45));
          z-index: 6;
        }
        .clock-ring.selected::after {
          opacity: 1;
        }
        /* Only one band highlighted: while hovering another ring, the
           selected ring yields (still .selected for sidebar sync). */
        .sun-light-clock-rings:has(.clock-ring.hovered)
          .clock-ring.selected:not(.hovered) {
          --ring-expand: 0%;
          --ring-rim-w: 0px;
          opacity: 0.5;
          filter: none;
          z-index: 1;
        }
        .sun-light-clock-rings:has(.clock-ring.hovered)
          .clock-ring.selected:not(.hovered)::after {
          opacity: 0;
        }
        .clock-ring.selected.hovered {
          z-index: 7;
        }
        /* Friendly name flush above the outer light-ring edge (rings are inset
           inside the core; do not anchor to --clock-chrome / face chrome). */
        .clock-ring-hover-name {
          position: absolute;
          left: 50%;
          top: ${CLOCK_RINGS_INSET_PCT}%;
          transform: translate(-50%, -100%);
          z-index: 10;
          pointer-events: none;
          max-width: min(80%, 14rem);
          padding: 6px 12px;
          border-radius: 999px;
          background: color-mix(
            in srgb,
            var(--card-background-color) 88%,
            transparent
          );
          color: var(--primary-text-color);
          box-shadow:
            0 0 0 1px color-mix(in srgb, var(--divider-color) 70%, transparent),
            0 4px 14px rgba(0, 0, 0, 0.28);
          font-size: 14px;
          font-weight: 600;
          line-height: 1.2;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .clock-ring-hover-name[hidden] {
          display: none;
        }
        .clock-ring-hover-caps {
          margin-left: 0.35em;
          color: var(--secondary-text-color);
          font-size: 0.82em;
          font-weight: 400;
        }
        .sun-light-clock-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: visible;
          z-index: 4;
          /* Own layer so sun/path moves do not dirty the static bloom/rings. */
          transform: translateZ(0);
          backface-visibility: hidden;
        }
        .sun-light-clock-handle-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: visible;
          z-index: 6;
          transform: translateZ(0);
          backface-visibility: hidden;
        }
        .clock-horizon-sky .clock-sky-day {
          /* Fill set in JS from skyLook (Apple-like day sky blue). */
          fill: transparent;
        }
        .clock-horizon-sky .clock-sky-night {
          /* Sunset→sunrise shadow (outer night). Half prior mix so day/night
             fill stays readable; day/night *glow* is the conic opacity, not this. */
          fill: color-mix(in srgb, var(--clock-night-outer) 36%, transparent);
        }
        .clock-horizon-sky .clock-sky-deep {
          /* Dusk→dawn wrap (deeper band). */
          fill: color-mix(in srgb, var(--clock-night-deep) 39%, transparent);
        }
        .sun-light-clock-overlay .clock-sun-day {
          fill: none;
          stroke: #000;
          stroke-width: 1px;
          vector-effect: non-scaling-stroke;
          stroke-linejoin: round;
          stroke-linecap: round;
          opacity: 0.9;
        }
        .sun-light-clock-overlay .clock-sun-path-night {
          fill: none;
          stroke: #000;
          stroke-width: 1px;
          vector-effect: non-scaling-stroke;
          stroke-dasharray: 5 4;
          stroke-linejoin: round;
          stroke-linecap: round;
          opacity: 0.5;
        }
        .sun-light-clock-overlay .clock-event-dot {
          fill: #000;
          stroke: none;
        }
        /* Match night sun-path dash + opacity. */
        .sun-light-clock-overlay .clock-event-ray,
        .sun-light-clock-overlay .clock-event-clamp-link {
          fill: none;
          stroke: #000;
          stroke-width: 1px;
          vector-effect: non-scaling-stroke;
          stroke-dasharray: 5 4;
          stroke-linejoin: round;
          stroke-linecap: round;
          opacity: 0.5;
        }
        :host([data-dark-mode]) .sun-light-clock-overlay .clock-sun-day {
          stroke: #e8eef8;
        }
        :host([data-dark-mode]) .sun-light-clock-overlay .clock-sun-path-night,
        :host([data-dark-mode]) .sun-light-clock-overlay .clock-event-ray,
        :host([data-dark-mode]) .sun-light-clock-overlay .clock-event-clamp-link {
          stroke: #d8e0ff;
        }
        :host([data-dark-mode]) .sun-light-clock-overlay .clock-event-dot {
          fill: var(--primary-text-color);
        }
        .sun-light-clock-overlay .clock-handle,
        .sun-light-clock-handle-overlay .clock-handle {
          stroke: var(--primary-text-color);
          stroke-width: 1.5px;
          vector-effect: non-scaling-stroke;
          stroke-linecap: round;
          opacity: 0.85;
        }
        .sun-light-clock-overlay .clock-override-arc {
          fill: none;
          stroke: #fff;
          stroke-width: 1px;
          vector-effect: non-scaling-stroke;
          stroke-linecap: round;
          opacity: 0.88;
        }
        .sun-light-clock-overlay .clock-override-glow {
          pointer-events: none;
        }
        .clock-brightness-overlay {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 0;
          overflow: visible;
        }
        .clock-brightness-overlay .clock-brightness-arc {
          fill: none;
          stroke: #fff;
          stroke-width: 1px;
          vector-effect: non-scaling-stroke;
          stroke-linecap: round;
          stroke-linejoin: round;
          /* Hint, not a second rim — quieter than time-override chrome. */
          opacity: 0.32;
        }
        :host(:not([data-dark-mode])) .clock-brightness-overlay .clock-brightness-arc {
          stroke: rgb(0 0 0 / 22%);
          opacity: 1;
        }
        .clock-brightness-overlay .clock-theme-bright-dot {
          fill: var(--card-background-color);
          stroke: var(--primary-text-color);
          stroke-width: 0.45;
          pointer-events: none;
        }
        .clock-brightness-overlay .clock-brightness-fill {
          pointer-events: none;
        }
        .clock-handle-hit {
          position: absolute;
          left: 50%;
          bottom: 50%;
          width: 22px;
          /* Tip only (planet rim → tick tips). A full center→rim spoke sat
             above the light rings and ate dial clicks along the sun angle. */
          height: ${((CLOCK_TICK_OUTER - CLOCK_RINGS_OUTER) / CLOCK_VIEW) * 100}%;
          margin-bottom: ${(CLOCK_RINGS_OUTER / CLOCK_VIEW) * 100}%;
          transform-origin: center bottom;
          transform: translateX(-50%) rotate(var(--handle-deg, 0deg));
          /* Below .sun-light-clock-rings (7) so the planet keeps ring picks. */
          z-index: 6;
          cursor: grab;
          pointer-events: auto;
          touch-action: none;
        }
        .clock-handle-hit:active,
        .clock-sun-hit:active {
          cursor: grabbing;
        }
        /* Visual sun under the handle; hit on top. SVG white fill + glow are
           day-wedge clipped (outline-only below the horizon). */
        .clock-sun {
          position: absolute;
          width: ${CLOCK_SUN_SIZE_PCT}%;
          height: ${CLOCK_SUN_SIZE_PCT}%;
          transform: translate(-50%, -50%) scale(var(--sun-scale, 1));
          pointer-events: none;
          z-index: 5;
          --sun-scale: 1;
        }
        .clock-sun > span {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }
        .clock-sun-shadow {
          /* Shadow is SVG behind the fill so it never covers the white disc. */
          display: none;
        }
        .clock-sun-ring {
          inset: 0;
          border: 1.5px solid #fff;
          background: transparent;
          box-sizing: border-box;
          z-index: 2;
        }
        .sun-light-clock-overlay .clock-sun-fill {
          fill: #fff;
          pointer-events: none;
        }
        .sun-light-clock-overlay .clock-sun-glow-disc {
          pointer-events: none;
          /* Softness is in the SVG radial gradient — CSS filter:blur on a
             cx/cy-moved circle trails under Chromium while scrubbing. */
        }
        .sun-light-clock-overlay .clock-sun-shadow-disc {
          pointer-events: none;
        }
        .clock-sun-hit {
          position: absolute;
          width: ${CLOCK_SUN_SIZE_PCT}%;
          height: ${CLOCK_SUN_SIZE_PCT}%;
          transform: translate(-50%, -50%) scale(var(--sun-scale, 1));
          border-radius: 50%;
          pointer-events: auto;
          cursor: grab;
          touch-action: none;
          /* Below rings so an oversized night sun does not steal planet clicks. */
          z-index: 6;
        }
        /* Hourly ticks on the face; 00/06/12/18 are numerals, not ticks.
           Text-colored (not white) so light-mode sky wash stays readable;
           surface halo replaces the old black shadow. */
        .clock-face-ticks {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: visible;
          z-index: 5;
          filter:
            drop-shadow(
              0 0 8px
                color-mix(in srgb, var(--primary-background-color) 25%, transparent)
            )
            drop-shadow(
              0 1px 6px
                color-mix(in srgb, var(--primary-background-color) 25%, transparent)
            );
        }
        .clock-face-ticks .clock-tick {
          stroke: color-mix(in srgb, var(--primary-text-color) 28%, transparent);
          stroke-width: 2px;
          vector-effect: non-scaling-stroke;
          stroke-linecap: round;
        }
        /* Cardinal hour numerals sit on the old 6h tick tips (serif, not HA UI). */
        .clock-hour-label {
          position: absolute;
          transform: translate(-50%, -50%);
          font-family: "Iowan Old Style", "Palatino Linotype", Palatino,
            "Times New Roman", Times, serif;
          font-size: var(--clock-hour-size, 32px);
          font-weight: 400;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.02em;
          line-height: 1;
          color: color-mix(in srgb, var(--primary-text-color) 52%, transparent);
          pointer-events: none;
          z-index: 7;
          text-shadow:
            0 0 8px
              color-mix(in srgb, var(--primary-background-color) 25%, transparent),
            0 1px 6px
              color-mix(in srgb, var(--primary-background-color) 25%, transparent);
        }
        .clock-event-layer {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 6;
        }
        .clock-event-anchor {
          position: absolute;
          width: 32px;
          height: 32px;
          transform: translate(-50%, -50%);
          z-index: 6;
          pointer-events: none;
        }
        .clock-event-meta {
          position: absolute;
          left: 50%;
          bottom: calc(100% + 4px);
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;
          max-width: min(7.5rem, calc(var(--clock-chrome) * 2 - 8px));
          padding: 0 2px;
          text-align: center;
          pointer-events: none;
          white-space: nowrap;
          /* Surface halo — half strength so labels stay readable without a glow blob. */
          text-shadow:
            0 0 4px
              color-mix(in srgb, var(--primary-background-color) 50%, transparent),
            0 1px 2px
              color-mix(in srgb, var(--primary-background-color) 50%, transparent);
        }
        /* Collision placement: below the button (see _layoutClockEventMetas). */
        .clock-event-meta.below {
          bottom: auto;
          top: calc(100% + 4px);
        }
        .clock-event-meta .clock-event-heading {
          font-size: 10px;
          font-weight: 600;
          line-height: 1.15;
          color: var(--primary-text-color);
        }
        .clock-event-meta .clock-event-bright {
          font-size: 9px;
          font-variant-numeric: tabular-nums;
          line-height: 1.15;
          color: color-mix(in srgb, var(--primary-text-color) 70%, transparent);
        }
        .clock-event {
          position: absolute;
          inset: 0;
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          border: 1px solid var(--divider-color);
          background: var(--card-background-color);
          color: var(--primary-text-color);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
          pointer-events: auto;
          cursor: pointer;
          padding: 0;
          font: inherit;
          transform-origin: center center;
          /* Radial brightness drag is along the spoke; do not let the face
             pan-y steal the gesture. */
          touch-action: none;
          transition:
            transform 160ms cubic-bezier(0.2, 0, 0, 1),
            box-shadow 160ms cubic-bezier(0.2, 0, 0, 1),
            border-color 160ms cubic-bezier(0.2, 0, 0, 1),
            background 160ms cubic-bezier(0.2, 0, 0, 1);
        }
        .clock-event.bright-dragging {
          cursor: grabbing;
          transition: none;
        }
        .clock-event:hover,
        .clock-event:focus-visible,
        .clock-event:active,
        .clock-event.selected {
          transform: scale(1.12);
          z-index: 1;
        }
        .clock-event:focus-visible {
          outline: 2px solid var(--primary-color);
          outline-offset: 2px;
        }
        .clock-event:hover:not(.selected):not(.missing),
        .clock-event:focus-visible:not(.selected):not(.missing) {
          border-color: var(--primary-color);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.22);
        }
        .clock-event ha-icon {
          --mdc-icon-size: 18px;
        }
        /* True-solar stand-in when earliest-dusk moves the active button. */
        .clock-event-anchor.ghost {
          width: 22px;
          height: 22px;
          z-index: 5;
        }
        .clock-event.ghost {
          width: 22px;
          height: 22px;
          opacity: 0.48;
          cursor: default;
          pointer-events: none;
          box-shadow: none;
          border-style: dashed;
          background: color-mix(
            in srgb,
            var(--card-background-color) 70%,
            transparent
          );
          transform: none;
        }
        .clock-event.ghost:hover,
        .clock-event.ghost:focus-visible,
        .clock-event.ghost:active,
        .clock-event.ghost.selected {
          transform: none;
        }
        .clock-event.ghost ha-icon {
          --mdc-icon-size: 13px;
        }
        /* Missing native assignment used to warn here; v4 has no per-event scene pick. */
        .clock-event.missing {
          color: var(--warning-color, var(--error-color));
          border: 2px solid var(--warning-color, var(--error-color));
          background: color-mix(
            in srgb,
            var(--warning-color, var(--primary-color)) 18%,
            var(--card-background-color)
          );
          box-shadow:
            0 0 0 3px
              color-mix(
                in srgb,
                var(--warning-color, var(--primary-color)) 28%,
                transparent
              ),
            0 2px 8px rgba(0, 0, 0, 0.22);
        }
        .clock-event.selected {
          border-color: var(--primary-color);
          box-shadow: 0 0 0 2px var(--primary-color);
        }
        .clock-event.missing.selected {
          border-color: var(--primary-color);
          box-shadow:
            0 0 0 2px var(--primary-color),
            0 0 0 5px
              color-mix(
                in srgb,
                var(--warning-color, var(--primary-color)) 28%,
                transparent
              ),
            0 2px 8px rgba(0, 0, 0, 0.22);
        }
        .sun-light-clock-legend {
          width: 100%;
          max-width: none;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 8px;
          position: relative;
          z-index: 12;
          pointer-events: auto;
        }
        .sun-light-clock-legend:not(.event-bright-edit)
          .simple-light-tile:not(.tap-only) {
          cursor: pointer;
        }
        .sun-light-clock-legend .light-tiles-scroller {
          padding-left: 0;
          padding-right: 0;
        }
        .sun-light-clock-legend .light-tiles-hint {
          margin-top: 4px;
        }
        .sun-light-clock-legend .light-list-add {
          width: min(100%, 500px);
          margin-inline: auto;
        }
        .simple-light-selector.suggested {
          opacity: 0.92;
        }
        .simple-light-selector.removed {
          opacity: 0.68;
        }
        .simple-light-selector.unavailable {
          opacity: 0.55;
        }
        .simple-light-selector.unavailable:not(.caps-known) {
          filter: grayscale(1);
          pointer-events: none;
        }
        .sun-location-override {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          padding: 10px 12px;
          border-radius: var(--ha-border-radius-lg, 12px);
          border: 1px solid var(--warning-color, var(--primary-color));
          background: color-mix(
            in srgb,
            var(--warning-color, var(--primary-color)) 18%,
            var(--card-background-color)
          );
        }
        .sun-location-override[hidden] {
          display: none;
        }
        .sun-location-override ha-icon {
          --mdc-icon-size: 22px;
          color: var(--warning-color, var(--primary-color));
          flex-shrink: 0;
        }
        .sun-location-copy {
          flex: 1 1 auto;
          min-width: 0;
        }
        .sun-location-copy .title {
          font-size: 13px;
          font-weight: 600;
        }
        .sun-location-copy .coords {
          font-size: 12px;
          font-variant-numeric: tabular-nums;
          color: var(--secondary-text-color);
        }
        .location-dialog {
          --mdc-dialog-min-width: min(560px, 95vw);
        }
        .location-dialog ha-selector {
          display: block;
          margin-top: 8px;
        }
        .location-dialog p {
          margin: 0 0 8px;
          color: var(--secondary-text-color);
          font-size: 14px;
        }
        .location-search {
          display: flex;
          gap: 8px;
          align-items: flex-end;
          margin: 8px 0;
        }
        .location-search ha-textfield,
        .location-search ha-selector,
        .location-search input {
          flex: 1;
          min-width: 0;
        }
        .location-search-results {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin: 0 0 8px;
        }
        .location-search-results button {
          margin: 0;
          padding: 8px 12px;
          border: 1px solid var(--divider-color);
          border-radius: var(--ha-border-radius-lg, 12px);
          background: var(--secondary-background-color, var(--card-background-color));
          color: inherit;
          font: inherit;
          font-size: 13px;
          text-align: start;
          cursor: pointer;
        }
        .location-search-results button:hover {
          border-color: var(--primary-color);
        }
        .location-dialog .error {
          margin: 0 0 8px;
        }
        .sun-fallback-note {
          margin: 8px 16px 0;
          font-size: 13px;
          color: var(--secondary-text-color);
        }
        .light-scene-list {
          display: flex;
          flex-wrap: nowrap;
          gap: 6px;
          margin: 0 -24px 12px;
          padding: 0 24px 4px;
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: thin;
          scroll-snap-type: x proximity;
        }
        .light-scene-list .sun-event {
          flex: 0 0 auto;
          min-width: 5.5rem;
          max-width: 9rem;
          padding: 6px 10px;
          gap: 1px;
          scroll-snap-align: start;
        }
        .light-scene-list .sun-event ha-icon {
          --mdc-icon-size: 16px;
        }
        .light-scene-list .sun-event .name {
          font-size: 11px;
          white-space: normal;
        }
        .light-scene-list .sun-event .time {
          font-size: 10px;
          white-space: normal;
        }
        .light-scene-list .sun-event[aria-current="true"] {
          border-color: var(--primary-color);
          background: color-mix(
            in srgb,
            var(--primary-color) 14%,
            var(--card-background-color)
          );
        }
        .sidebar-note {
          margin: 0 0 8px;
          font-size: 13px;
          line-height: 1.4;
          color: var(--secondary-text-color);
        }
        .theme-event-restore {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0 0 12px;
          padding: 8px 10px;
          border: 0;
          border-radius: 8px;
          background: color-mix(
            in srgb,
            var(--primary-color) 14%,
            var(--card-background-color)
          );
          color: var(--primary-text-color);
          font: inherit;
          font-size: 13px;
          cursor: pointer;
        }
        .theme-event-restore[hidden] {
          display: none;
        }
        .theme-event-restore ha-icon {
          --mdc-icon-size: 18px;
          color: var(--primary-color);
        }
        .scene-theme-choice {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          margin: 0;
          padding: 6px;
          border: 0;
          border-radius: 12px;
          background: none;
          color: inherit;
          font: inherit;
          text-align: left;
          cursor: pointer;
        }
        .scene-theme-choice .theme-dial {
          width: 48px;
          height: 48px;
          flex: 0 0 auto;
          pointer-events: none;
        }
        .scene-theme-choice.selected .theme-dial {
          outline: 3px solid var(--primary-color);
          outline-offset: 3px;
        }
        .scene-gallery-card.scene-theme-card .theme-dial {
          position: absolute;
          inset: 0;
          width: auto;
          height: auto;
          border-radius: inherit;
          box-shadow: none;
          pointer-events: none;
        }
        .theme-edit-banner {
          color: var(--primary-text-color);
          background: color-mix(
            in srgb,
            var(--primary-color) 14%,
            var(--card-background-color)
          );
          border-radius: 8px;
          padding: 10px 12px;
          margin: 0 0 16px;
        }
        .scene-sidebar-footer .sidebar-note {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin: 0;
        }
        .scene-sidebar-footer .sidebar-note ha-icon {
          --mdc-icon-size: 18px;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .scene-sidebar-actions {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 12px;
        }
        .hue-wheel-stage {
          position: relative;
          margin: 8px -8px 0;
          padding: 8px 8px 8px;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 16px;
          --wheel-peek: 10%;
          --wheel-mixed-inner: 81%;
          --wheel-mixed-gap: 0%;
        }
        .hue-wheel-face {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 16px;
          width: 100%;
          min-width: 0;
          min-height: 0;
          flex: 1 1 auto;
        }
        .hue-wheel-canvas {
          position: relative;
          width: 100%;
          max-width: 320px;
          margin: 0 auto;
          aspect-ratio: 1;
          overflow: visible;
          user-select: none;
          -webkit-user-select: none;
          touch-action: none;
        }
        .wheel-mode-pill {
          box-sizing: border-box;
          display: flex;
          height: 48px;
          padding: 8px;
          gap: 8px;
          border-radius: 24px;
          box-shadow: 0px 2px 3px rgba(0, 0, 0, 0.4);
          background: var(--surface-2, var(--secondary-background-color, #242022));
          pointer-events: auto;
        }
        .wheel-mode-pill[hidden] {
          display: none !important;
        }
        .wheel-mode-pill .wheel-wrapper {
          box-sizing: border-box;
          width: 32px;
          height: 32px;
          margin: 0;
          padding: 2px;
          border-radius: 16px;
          border: 2px solid transparent;
          background: transparent;
          cursor: pointer;
          appearance: none;
          -webkit-appearance: none;
        }
        .wheel-mode-pill .wheel-wrapper:hover,
        .wheel-mode-pill .wheel-wrapper:active {
          background-color: var(--surface-2, var(--secondary-background-color, #242022));
        }
        .wheel-mode-pill .wheel-wrapper.active {
          border-color: #fff;
        }
        .wheel-mode-pill .wheel-wrapper.palette-add {
          border-color: transparent;
          color: var(--primary-text-color);
          -webkit-text-fill-color: var(--primary-text-color);
        }
        .wheel-mode-pill .wheel-wrapper.palette-add .wheel {
          box-sizing: border-box;
          display: grid;
          place-items: center;
          box-shadow: none;
          background: transparent;
          border: 2px dashed
            color-mix(in srgb, var(--primary-text-color) 55%, transparent);
          color: var(--primary-text-color);
        }
        .wheel-mode-pill .wheel-wrapper.palette-add ha-icon {
          --mdc-icon-size: 14px;
          width: 14px;
          height: 14px;
          color: var(--primary-text-color);
          -webkit-text-fill-color: var(--primary-text-color);
        }
        .wheel-mode-pill .wheel-wrapper.palette-active,
        :host(:not([data-dark-mode])) .wheel-mode-pill .wheel-wrapper.palette-active {
          width: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0;
          border-color: transparent;
          background: color-mix(in srgb, var(--primary-text-color) 12%, transparent);
        }
        .wheel-mode-pill .wheel-wrapper.palette-active .wheel,
        :host(:not([data-dark-mode])) .wheel-mode-pill .wheel-wrapper.palette-active .wheel {
          position: relative;
          /* Same drop shadow as the other mode swatches. The selection ring is
             the shared ::after, not a second stroke on the disc. */
          box-shadow:
            0 1px 3px rgba(0, 0, 0, 0.4),
            inset 0 0 0 0.5px rgba(255, 255, 255, 0.15);
        }
        .wheel-mode-pill .wheel-wrapper.palette-active .wheel::after,
        :host(:not([data-dark-mode])) .wheel-mode-pill .wheel-wrapper.palette-active .wheel::after {
          content: "";
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 2px solid #fff;
          opacity: 0.75;
          pointer-events: none;
        }
        :host(:not([data-dark-mode])) .wheel-mode-pill .wheel-wrapper.palette-active .wheel::after {
          border-color: var(--primary-color);
        }
        .wheel-palette-edit {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 24px;
          color: var(--primary-text-color);
        }
        .wheel-palette-edit ha-icon {
          --mdc-icon-size: 16px;
          width: 16px;
          height: 16px;
        }
        .wheel-mode-pill .wheel-wrapper[aria-disabled="true"] {
          cursor: default;
        }
        .wheel-mode-pill .wheel-wrapper.mode-unsupported .wheel {
          filter: grayscale(1);
        }
        .wheel-mode-pill .wheel-wrapper.mode-unsupported .wheel-mode-name {
          text-decoration: line-through;
        }
        .wheel-mode-pill .wheel {
          display: block;
          width: 24px;
          height: 24px;
          border-radius: 12px;
          background-size: cover;
          background-position: center;
          flex: 0 0 auto;
          box-shadow:
            0 1px 3px rgba(0, 0, 0, 0.4),
            inset 0 0 0 0.5px rgba(255, 255, 255, 0.15);
        }
        :host(:not([data-dark-mode])) .wheel-mode-pill .wheel-wrapper.active {
          border-color: var(--primary-color);
        }
        .wheel-mode-name {
          display: none;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 13px;
          line-height: 1.2;
          color: var(--primary-text-color);
        }
        .hue-wheel-mode-cluster {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
          flex: 0 0 auto;
        }
        .wheel-palette-randomize {
          flex: 0 0 auto;
          margin: 0;
          padding: 6px 10px;
          border: 0;
          border-radius: 16px;
          box-shadow: 0px 2px 3px rgba(0, 0, 0, 0.4);
          background: var(--surface-2, var(--secondary-background-color, #242022));
          color: var(--primary-text-color);
          font: inherit;
          font-size: 0.8rem;
          cursor: pointer;
        }
        .wheel-palette-randomize[hidden] {
          display: none !important;
        }
        .library-editor {
          box-sizing: border-box;
          width: 100%;
          max-width: none;
          min-width: 0;
          min-height: 0;
          flex: 1 1 auto;
          margin: 0 auto;
          padding: 16px 8px 48px;
        }
        .library-name-field {
          display: block;
          margin: 8px 8px 16px;
          max-width: 650px;
        }
        .palette-slots {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin: 12px 0;
        }
        .palette-slot-row {
          display: grid;
          grid-template-columns: 36px 44px minmax(0, 1fr) 72px;
          gap: 8px;
          align-items: center;
        }
        .palette-slot-swatch {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.2);
        }
        .palette-slot-row input[type="color"] {
          width: 44px;
          height: 32px;
          padding: 0;
          border: 0;
          background: transparent;
        }
        .hue-wheel-glow,
        .hue-wheel-layer {
          display: block;
          width: 100%;
          height: 100%;
          border-radius: 50%;
        }
        .hue-wheel-glow {
          position: absolute;
          left: 0;
          top: 0;
          pointer-events: none;
          z-index: 0;
          transform: scale(1.1);
          transform-origin: center center;
          filter: blur(54px) saturate(1.45);
          opacity: 0.55;
        }
        :host(:not([data-dark-mode])) .hue-wheel-glow {
          opacity: 0.22;
        }
        .hue-wheel-disk {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1;
        }
        @property --disk-hole {
          syntax: "<percentage>";
          inherits: false;
          initial-value: 0%;
        }
        .hue-wheel-layer {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          transform-origin: center center;
          --disk-hole: 0%;
          /* Hole and scale share the pin's 480ms curve so a pin stays on its disk. */
          -webkit-mask-image: radial-gradient(
            farthest-side,
            transparent var(--disk-hole),
            #000 var(--disk-hole)
          );
          mask-image: radial-gradient(
            farthest-side,
            transparent var(--disk-hole),
            #000 var(--disk-hole)
          );
          transition:
            transform 480ms cubic-bezier(0.22, 1.15, 0.36, 1),
            --disk-hole 480ms cubic-bezier(0.22, 1.15, 0.36, 1);
        }
        .hue-wheel-disk.is-mid {
          z-index: 2;
        }
        .hue-wheel-disk.is-front {
          z-index: 3;
        }
        .hue-wheel-disk.is-back,
        .hue-wheel-disk.is-mid,
        .hue-wheel-disk.is-front {
          /* Shadow on the wrapper. A filter on the clipped canvas is masked
             away, so the overlap has no edge. */
          filter:
            drop-shadow(0 18px 28px rgba(0, 0, 0, 0.55))
            drop-shadow(0 6px 10px rgba(0, 0, 0, 0.4));
        }
        .hue-wheel-disk.is-back {
          z-index: 1;
        }
        :host(:not([data-dark-mode])) .hue-wheel-disk.is-back,
        :host(:not([data-dark-mode])) .hue-wheel-disk.is-mid,
        :host(:not([data-dark-mode])) .hue-wheel-disk.is-front {
          filter: drop-shadow(0 14px 28px rgba(0, 0, 0, 0.22));
        }
        .hue-wheel-disk.is-drag-unavailable {
          opacity: 0.18;
        }
        .hue-wheel-svg {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          overflow: visible;
          z-index: 4;
          color: white;
        }
        .hue-wheel-paths {
          pointer-events: none;
        }
        .hue-wheel-svg .hue-path-under {
          fill: none;
          stroke: rgba(0, 0, 0, 0.65);
          stroke-width: 6;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .hue-wheel-svg .hue-path-mid {
          fill: none;
          stroke: rgba(255, 255, 255, 0.92);
          stroke-width: 4;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .hue-wheel-svg .hue-path-seg {
          fill: none;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .hue-wheel-svg .gm {
          cursor: pointer;
          transition: color 360ms ease;
        }
        .hue-wheel-svg .gm.expanded,
        .hue-wheel-svg .gm.drop-target {
          /* Above every resting dot. SVG paint order still follows the tree,
             so sync() also moves these groups to the end. */
          z-index: 2;
        }
        .hue-wheel-svg.pin-drag .gm {
          transition: none;
        }
        .hue-wheel-svg .pin-body {
          transform-box: fill-box;
          transform-origin: 50% 100%;
          transform: rotate(180deg);
          scale: 0.2;
          opacity: 0;
          /* Collapse fades late so the shrink is the expand played backwards. */
          transition:
            scale 520ms cubic-bezier(0.34, 1.56, 0.64, 1),
            opacity 280ms ease 240ms;
        }
        .hue-wheel-svg .gm.expanded .pin-body,
        .hue-wheel-svg .gm.drop-target .pin-body {
          scale: 1;
          opacity: 1;
          transition:
            scale 520ms cubic-bezier(0.34, 1.56, 0.64, 1),
            opacity 280ms ease;
        }
        .hue-wheel-svg .gm.drag .pin-body {
          scale: 1.16;
          opacity: 1;
        }
        .hue-wheel-svg .pin-dot {
          opacity: 1;
          transition: opacity 280ms ease 240ms;
        }
        .hue-wheel-svg .gm.expanded .pin-dot,
        .hue-wheel-svg .gm.drop-target .pin-dot {
          opacity: 0;
          transition: opacity 280ms ease;
        }
        .hue-wheel-svg .pin-dot-outline {
          fill: #fff;
          filter: url(#se-dot-shadow);
        }
        .hue-wheel-svg .pin-dot-fill {
          fill: currentColor;
        }
        .hue-wheel-svg .group-count,
        .hue-wheel-svg .dot-icon {
          display: none;
        }
        .hue-wheel-svg .dot-icon-host {
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }
        .hue-wheel-svg .dot-icon-host ha-icon {
          --mdc-icon-size: 16px;
          width: 16px;
          height: 16px;
          color: inherit;
          --icon-primary-color: currentColor;
        }
        .hue-wheel-svg .group-ring {
          fill: color-mix(
            in srgb,
            var(--card-background-color, #1c1c1c) 48%,
            transparent
          );
          stroke: rgba(255, 255, 255, 0.92);
          stroke-width: 3;
          pointer-events: none;
        }
        .hue-wheel-layer {
          transition:
            transform 480ms cubic-bezier(0.22, 1.15, 0.36, 1),
            --disk-hole 480ms cubic-bezier(0.22, 1.15, 0.36, 1),
            opacity 280ms ease;
        }
        .hue-wheel-canvas.group-open .hue-wheel-layer {
          opacity: 0.38;
        }
        .hue-wheel-svg .pin-hit {
          pointer-events: all;
        }
        .hue-wheel-svg .marker-outline {
          fill: none;
          stroke: #fff;
          stroke-width: 2px;
          vector-effect: non-scaling-stroke;
          filter: url(#se-dot-shadow);
        }
        .hue-wheel-svg .marker {
          fill: currentColor;
        }
        .hue-wheel-svg .icon.text {
          font-size: 20px;
          font-weight: bold;
          paint-order: stroke fill;
        }
        .hue-wheel-svg .icon-fo {
          pointer-events: none;
          overflow: visible;
        }
        .hue-wheel-svg .pin-icon-host {
          box-sizing: border-box;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }
        .hue-wheel-svg .pin-icon-host ha-icon,
        .hue-wheel-svg .pin-icon-host ha-state-icon {
          display: flex;
          width: 32px;
          height: 32px;
          --mdc-icon-size: 32px;
          color: inherit;
          --icon-primary-color: currentColor;
        }
        .hue-wheel-svg .gm.expanded .marker,
        .hue-wheel-svg .gm.drop-target .marker {
          filter: url(#se-active-shadow);
        }
        .hue-wheel-svg .marker-outline {
          opacity: 1;
          transition: opacity 280ms ease 240ms;
        }
        .hue-wheel-svg .gm.expanded .marker-outline,
        .hue-wheel-svg .gm.drop-target .marker-outline {
          opacity: 0;
          transition: opacity 280ms ease;
        }
        .hue-wheel-svg .pin-glyph {
          opacity: 1;
          transition: opacity 280ms ease;
        }
        .hue-wheel-svg .gm:not(.expanded):not(.drop-target) .pin-glyph {
          opacity: 0;
          transition: opacity 280ms ease 240ms;
        }
        @media (prefers-reduced-motion: reduce) {
          .hue-wheel-svg .gm,
          .hue-wheel-svg .pin-body {
            transition: none;
          }
        }
        .hue-wheel-chrome {
          position: relative;
          display: flex;
          flex-wrap: nowrap;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          pointer-events: none;
          z-index: 3;
        }
        .hue-wheel-chrome > * {
          pointer-events: auto;
        }
        .hue-wheel-float-readout {
          position: absolute;
          z-index: 4;
          transform: translate(-50%, calc(-100% - 6px));
          padding: 4px 8px;
          border-radius: 8px;
          background: color-mix(
            in srgb,
            var(--card-background-color, #1c1c1c) 92%,
            transparent
          );
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
          font-size: 0.75rem;
          font-variant-numeric: tabular-nums;
          line-height: 1.2;
          color: var(--primary-text-color);
          white-space: nowrap;
          pointer-events: none;
        }
        .hue-wheel-float-readout[hidden] {
          display: none !important;
        }
        .hue-palette-colors,
        .hue-palette-colors[hidden] {
          display: none !important;
        }
        .hue-presets[hidden],
        .hue-wheel-mode-cluster[hidden],
        .hue-wheel-chrome[hidden] {
          display: none !important;
        }
        .hue-wheel-mode-cluster,
        .hue-presets {
          transition:
            opacity 180ms cubic-bezier(0.2, 0, 0, 1),
            transform 180ms cubic-bezier(0.2, 0, 0, 1);
        }
        .simple-editor:not(.chrome-aside) .hue-wheel-mode-cluster:not(.is-shown) {
          opacity: 0;
          transform: translateX(-24px);
          pointer-events: none;
        }
        .simple-editor:not(.chrome-aside) .hue-presets:not(.is-shown) {
          opacity: 0;
          transform: translateX(24px);
          pointer-events: none;
        }
        .hue-presets {
          box-sizing: border-box;
          display: flex;
          flex-wrap: nowrap;
          align-items: center;
          min-height: 48px;
          padding: 8px;
          gap: 8px;
          min-width: 0;
          width: max-content;
          max-width: 100%;
          border-radius: 24px;
          box-shadow: 0px 2px 3px rgba(0, 0, 0, 0.4);
          background: var(--surface-2, var(--secondary-background-color, #242022));
          position: relative;
          flex: 0 1 auto;
          justify-content: flex-end;
          overflow: hidden;
          padding: 10px 6px;
        }
        .hue-preset-edit {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-left: 4px;
          color: inherit;
          cursor: pointer;
        }
        .hue-preset-edit ha-icon {
          --mdc-icon-size: 16px;
        }
        .hue-presets-track {
          display: flex;
          flex-wrap: nowrap;
          align-items: center;
          gap: 8px;
          min-width: 0;
          width: max-content;
          max-width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
        }
        .hue-presets::after {
          content: "";
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          width: 32px;
          pointer-events: none;
          opacity: 0;
          border-radius: 0 20px 20px 0;
          background: linear-gradient(
            to right,
            transparent,
            var(--secondary-background-color, #242022)
          );
          box-shadow: inset -10px 0 12px -8px rgba(0, 0, 0, 0.45);
          transition: opacity 160ms cubic-bezier(0.2, 0, 0, 1);
        }
        .hue-presets.can-scroll-end::after {
          opacity: 1;
        }
        .hue-preset {
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          margin: 0;
          padding: 2px;
          border-radius: 50%;
          border: 2px solid transparent;
          background: transparent;
          cursor: pointer;
          appearance: none;
          -webkit-appearance: none;
        }
        .hue-preset-swatch {
          position: relative;
          display: block;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          flex: 0 0 auto;
          box-shadow:
            0 1px 3px rgba(0, 0, 0, 0.4),
            inset 0 0 0 0.5px rgba(255, 255, 255, 0.15);
        }
        .hue-preset-name {
          display: none;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 13px;
          line-height: 1.2;
          color: var(--primary-text-color);
          text-align: start;
        }
        .hue-preset:hover {
          border-color: rgba(255, 255, 255, 0.45);
        }
        .hue-preset.active {
          border-color: #fff;
        }
        :host(:not([data-dark-mode])) .hue-preset.active {
          border-color: var(--primary-color);
        }
        .hue-preset {
          background-clip: content-box;
          background-origin: content-box;
        }
        .hue-preset.add {
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border-color: transparent;
          opacity: 0.8;
        }
        .hue-preset.add:hover {
          opacity: 1;
        }
        .hue-preset-add-face {
          box-sizing: border-box;
          display: grid;
          place-items: center;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px dashed
            color-mix(in srgb, var(--primary-text-color) 55%, transparent);
          flex: 0 0 auto;
        }
        .hue-preset.add,
        .hue-preset.add ha-icon {
          color: var(--primary-text-color);
          -webkit-text-fill-color: var(--primary-text-color);
        }
        .hue-preset.add ha-icon {
          --mdc-icon-size: 14px;
          width: 14px;
          height: 14px;
          transform: translateY(-2px);
        }
        .light-brightness-graph {
          position: relative;
          width: 100%;
          margin: 0 0 12px;
          user-select: none;
          /* Title/subtitle may start a page scroll; the plot locks pan. */
          touch-action: pan-y;
        }
        .light-brightness-graph-heading {
          display: flex;
          flex-direction: column;
          gap: 1px;
          margin: 0 0 6px;
        }
        .light-brightness-graph-title {
          font-size: 14px;
          font-weight: 500;
          line-height: 1.25;
          color: var(--primary-text-color);
        }
        .light-brightness-graph-sub {
          font-size: 12px;
          line-height: 1.25;
          color: var(--secondary-text-color);
        }
        .light-onoff-graph {
          margin: 12px 0;
        }
        .light-onoff-events {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 4px 1px;
        }
        .light-onoff-event {
          display: flex;
          flex: 1 0 64px;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 10px 6px;
          border: 1px solid var(--divider-color);
          border-radius: 12px;
          background: var(--card-background-color);
          color: var(--secondary-text-color);
          font: inherit;
          cursor: pointer;
        }
        .light-onoff-event.is-on {
          border-color: var(--primary-color);
          background: color-mix(in srgb, var(--primary-color) 12%, var(--card-background-color));
          color: var(--primary-text-color);
        }
        .light-onoff-event.is-active {
          box-shadow: 0 0 0 1px var(--primary-color);
        }
        .light-onoff-event:disabled {
          opacity: 0.45;
          cursor: default;
        }
        .light-onoff-event-name {
          font-size: 11px;
        }
        .light-onoff-event-state {
          font-size: 13px;
          font-weight: 600;
        }
        .light-brightness-graph-plot {
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
        }
        .light-brightness-graph svg {
          display: block;
          width: 100%;
          height: 120px;
          overflow: visible;
          touch-action: none;
        }
        .light-brightness-graph .bg-frame {
          fill: color-mix(
            in srgb,
            var(--secondary-text-color) 10%,
            var(--card-background-color)
          );
          stroke: var(--divider-color);
          stroke-width: 1;
        }
        .light-brightness-graph .fill-area {
          stroke: none;
        }
        .light-brightness-graph .curve {
          fill: none;
          stroke: var(--primary-text-color);
          stroke-width: 1.5;
          stroke-linejoin: round;
          stroke-linecap: round;
          opacity: 0.55;
        }
        .light-brightness-graph .handle {
          cursor: ns-resize;
        }
        .light-brightness-graph .handle.add {
          cursor: pointer;
        }
        .light-brightness-graph .handle-hit {
          fill: transparent;
          stroke: none;
        }
        .light-brightness-graph .handle-dot {
          fill: var(--card-background-color);
          stroke: var(--primary-text-color);
          stroke-width: 2;
        }
        .light-brightness-graph .handle.active .handle-dot {
          stroke: var(--primary-color);
          stroke-width: 2.5;
        }
        .light-brightness-graph .handle.add .handle-dot {
          stroke: var(--primary-color);
          stroke-dasharray: 3 2;
        }
        .light-brightness-graph .theme-curve-halo {
          stroke: var(--card-background-color);
          stroke-width: 5;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .light-brightness-graph .theme-curve {
          stroke: var(--primary-text-color);
          stroke-width: 1.6;
          stroke-dasharray: 5 3.5;
          stroke-linecap: round;
          stroke-linejoin: round;
          opacity: 0.92;
        }
        .light-brightness-graph .theme-dot {
          fill: var(--card-background-color);
          stroke: var(--primary-text-color);
          stroke-width: 1.6;
          pointer-events: none;
        }
        .light-overrides {
          margin-top: 14px;
        }
        .light-overrides-title {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--secondary-text-color);
          margin-bottom: 6px;
        }
        .light-override-row {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
          width: 100%;
          padding: 8px 0;
          border: 0;
          border-bottom: 1px solid var(--divider-color);
          background: none;
          color: inherit;
          font: inherit;
          text-align: left;
          cursor: pointer;
        }
        .light-override-row:last-child {
          border-bottom: 0;
        }
        .light-override-name {
          font-weight: 500;
        }
        .light-override-meta {
          font-size: 0.75rem;
          color: var(--secondary-text-color);
        }
        .light-brightness-graph .handle-fill {
          stroke: none;
        }
        .light-brightness-graph .handle-label {
          fill: var(--secondary-text-color);
          font-size: 10px;
          text-anchor: middle;
          pointer-events: none;
        }
        .light-dialog ha-selector,
        .light-dialog ha-switch,
        .event-dialog ha-selector,
        .event-dialog ha-switch,
        .scene-sidebar-body ha-selector,
        .scene-sidebar-body ha-switch {
          display: block;
          margin-top: 16px;
        }
        .scene-sidebar.desktop {
          --scene-sidebar-surface: color-mix(
            in srgb,
            var(--primary-background-color) 58%,
            transparent
          );
          --ha-card-border-radius: var(
            --ha-dialog-border-radius,
            var(--ha-border-radius-2xl, 28px)
          );
          position: absolute;
          z-index: 16;
          top: calc(var(--header-height, 64px) + 16px);
          right: calc(16px + var(--safe-area-inset-right, 0px));
          width: var(--scene-sidebar-width, 375px);
          height: calc(
            100% - var(--header-height, 64px) - 32px -
              var(--safe-area-inset-bottom, 0px)
          );
          outline: none;
          pointer-events: none;
          transform: translateX(100%);
          opacity: 0;
          transition:
            transform ${SIDEBAR_ANIMATION_MS}ms cubic-bezier(0.2, 0, 0, 1),
            opacity ${SIDEBAR_ANIMATION_MS}ms cubic-bezier(0.2, 0, 0, 1);
        }
        .scene-sidebar.desktop.open {
          pointer-events: auto;
          transform: translateX(0);
          opacity: 1;
        }
        @media (prefers-reduced-motion: reduce) {
          .scene-sidebar.desktop {
            transition-duration: 1ms;
          }
          .page-shell,
          .fab {
            transition-duration: 1ms;
          }
          .sun-light-clock-rings,
          .scene-sidebar-body,
          .scene-sidebar-footer,
          .hue-presets::after,
          .hue-wheel-mode-cluster,
          .hue-presets,
          .hue-wheel-chrome {
            transition-duration: 1ms;
          }
        }
        .scene-sidebar-body,
        .scene-sidebar-footer {
          transition: opacity ${SIDEBAR_SWAP_MS}ms cubic-bezier(0.2, 0, 0, 1);
        }
        .scene-sidebar-body.sidebar-pane-leave,
        .scene-sidebar-footer.sidebar-pane-leave,
        .scene-sidebar-body.sidebar-pane-enter,
        .scene-sidebar-footer.sidebar-pane-enter {
          opacity: 0;
        }
        .scene-sidebar.mobile {
          --ha-bottom-sheet-surface-background: var(--card-background-color);
          --ha-card-border-radius: var(
            --ha-dialog-border-radius,
            var(--ha-border-radius-2xl, 28px)
          );
        }
        .scene-sidebar-card {
          height: 100%;
          width: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-color: var(--primary-color);
          border-width: 2px;
          --ha-card-border-width: 2px;
          --ha-card-border-color: var(--primary-color);
        }
        .scene-sidebar.desktop .scene-sidebar-card {
          --ha-card-background: var(--scene-sidebar-surface);
          --ha-dialog-surface-background: transparent;
          background: var(--scene-sidebar-surface);
          backdrop-filter: blur(18px) saturate(1.2);
          -webkit-backdrop-filter: blur(18px) saturate(1.2);
        }
        .scene-sidebar.desktop
          .scene-sidebar-footer:has(.sidebar-actions-bar) {
          background: transparent;
        }
        .scene-sidebar-card ha-dialog-header {
          border-radius: var(--ha-card-border-radius);
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
        }
        .scene-sidebar-body {
          flex: 1 1 auto;
          min-height: 0;
          overflow: auto;
          padding: 0 24px 16px;
        }
        .scene-sidebar-footer {
          display: flex;
          justify-content: flex-start;
          align-items: center;
          gap: 12px;
          padding: 12px 16px 16px;
          flex-shrink: 0;
        }
        .scene-sidebar .dusk-minimum-row {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 4px;
          margin-top: 16px;
          box-sizing: border-box;
        }
        .scene-sidebar .dusk-minimum-row ha-selector {
          width: 100%;
        }
        /* ha-selector's own top margin is the field label's slot. The title
           already sits above this row, so the flex gap is the only space. */
        .solar-limit-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .solar-limit-title .name { flex: 1; min-width: 0; }
        .solar-limit-title ha-switch { flex: 0 0 auto; }
        .dusk-minimum-row ha-selector {
          margin-top: 0;
        }
        .scene-sidebar-footer:has(.sidebar-actions-bar) {
          flex-direction: column;
          justify-content: flex-start;
          align-items: stretch;
          gap: 0;
          padding: 0;
          border-top: 1px solid var(--divider-color);
          background: var(--card-background-color);
        }
        /* Beat ha-bottom-sheet ::slotted(footer) { justify-content: flex-end }. */
        .scene-sidebar.mobile .scene-sidebar-footer:has(.sidebar-actions-bar) {
          justify-content: flex-start;
          align-items: stretch;
          padding: 0;
        }
        /* Undo/redo first, then live preview + activate — left-aligned. */
        .sidebar-actions-bar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: flex-start;
          gap: 4px 8px;
          padding: 8px 12px calc(12px + var(--safe-area-inset-bottom, 0px));
          background: var(--card-background-color);
        }
        .sidebar-actions-bar .live-edit-toggle {
          margin-inline-start: 4px;
        }
        .sidebar-actions-bar .activate-scene-btn {
          margin-inline-end: 4px;
        }
        .sidebar-remove-light {
          margin-top: 20px;
          padding-top: 12px;
          border-top: 1px solid var(--divider-color);
        }
        .sidebar-remove-light .remove-light-from-scene-btn {
          --ha-button-width: 100%;
        }
        .light-effect-row {
          display: flex;
          justify-content: center;
          margin: 16px 0 4px;
        }
        .light-effect-row ha-control-select-menu,
        .light-effect-row ha-more-info-control-select-container {
          min-width: 160px;
          max-width: 220px;
          width: 100%;
        }
        .light-list-add {
          display: flex;
          justify-content: center;
          padding: 12px 8px 4px;
        }
        /* Shrink-wrap to the add button — a fixed picker width left-aligns
           the slotted ha-button inside ha-generic-picker’s full-width container. */
        .light-list-add ha-entity-picker {
          width: fit-content;
          max-width: 100%;
        }
        .light-add-picker-host {
          position: absolute;
          left: 50%;
          bottom: 8px;
          width: min(280px, calc(100% - 16px));
          transform: translateX(-50%);
          /* Keep the field out of layout chrome; popover still anchors here. */
          opacity: 0;
          pointer-events: none;
          z-index: 5;
        }
        .light-add-picker-host.is-menu {
          opacity: 1;
          pointer-events: auto;
          z-index: 30;
          display: flex;
          flex-direction: column;
          gap: 6px;
          box-sizing: border-box;
          padding: 8px;
          max-height: min(360px, 50vh);
          background: var(--card-background-color);
          color: var(--primary-text-color);
          border-radius: 12px;
          box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0, 0, 0, 0.35));
        }
        .light-add-menu-search {
          box-sizing: border-box;
          width: 100%;
          margin: 0;
          padding: 8px 10px;
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          background: var(--secondary-background-color);
          color: var(--primary-text-color);
          font: inherit;
        }
        .light-add-menu-list {
          overflow: auto;
          min-height: 0;
        }
        .light-add-menu-area {
          padding: 8px 8px 2px;
          color: var(--secondary-text-color);
          font-size: 12px;
          font-weight: 600;
        }
        .light-add-menu-item {
          display: block;
          width: 100%;
          margin: 0;
          padding: 8px;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: var(--primary-text-color);
          font: inherit;
          text-align: left;
          cursor: pointer;
        }
        .light-add-menu-item:hover,
        .light-add-menu-item:focus-visible {
          background: var(--secondary-background-color);
        }
        .settings-reset {
          margin-top: 24px;
        }
        .light-list-add ha-button {
          --mdc-typography-button-text-transform: none;
        }
        .live-edit-toggle {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          padding: 0 4px;
          color: var(--primary-text-color);
          font: inherit;
          font-size: 14px;
          cursor: pointer;
          user-select: none;
        }
        .live-edit-toggle[hidden] {
          display: none !important;
        }
        .overflow-live-edit {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          box-sizing: border-box;
          min-height: 48px;
          padding: 8px 16px;
          color: var(--primary-text-color);
        }
        .overflow-live-edit ha-switch {
          --mdc-switch-track-width: 36px;
        }
        .live-edit-toggle ha-switch {
          --mdc-switch-track-width: 36px;
        }
        .scene-palette-dialog {
          /* Dialog content padding sits outside this list and clips the
             card shadow, leaves a band above the footer, and shrinks the
             view. The inset lives on the scroller instead. */
          --dialog-content-padding: 0;
        }
        .scene-palette-dialog .scene-palette-hint {
          margin: 0;
          padding: 0 0 12px;
          color: var(--secondary-text-color);
          font-size: 14px;
          line-height: 20px;
        }
        .scene-palette-body {
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          min-height: 240px;
          /* wa-dialog tops out at 100dvh - 80px. Header and footer are 68px
             each, so this is the content band. A taller body makes that
             dialog scroll and clips the card shadow above the footer. */
          height: calc(100dvh - 216px);
          max-height: calc(100dvh - 216px);
          overflow: hidden;
        }
        .scene-palette-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1 1 auto;
          min-height: 0;
          max-height: none;
          overflow-x: hidden;
          overflow-y: auto;
          /* Inside the scroller, so scale(1.1) and the 32px shadow are not
             clipped and this inset does not sit between the list and the footer. */
          padding: 16px 20px 20px;
          box-sizing: border-box;
        }
        .scene-palette-dialog .live-edit-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-inline-start: auto;
        }
        .scene-palette-choice {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .scene-palette-none {
          align-self: flex-start;
          padding: 6px 10px;
          border: 2px solid transparent;
          border-radius: 10px;
          background: none;
          color: var(--primary-text-color);
          font: inherit;
          cursor: pointer;
        }
        .scene-palette-none.selected {
          border-color: var(--primary-color);
        }
        .scene-theme-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-height: min(480px, 60vh);
          overflow: auto;
        }
        .scene-theme-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border: 2px solid transparent;
          border-radius: 10px;
          background: none;
          color: var(--primary-text-color);
          font: inherit;
          text-align: start;
          cursor: pointer;
        }
        .scene-theme-row.selected {
          border-color: var(--primary-color);
        }
        .scene-palette-randomize[hidden] {
          display: none !important;
        }
        .scene-gallery-label {
          margin: 14px 0 8px;
          color: var(--secondary-text-color);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .scene-palette-list > .scene-gallery-label:first-child {
          margin-top: 0;
        }
        .scene-palette-list .scene-cards {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 20px;
          width: 100%;
          box-sizing: border-box;
          flex-wrap: wrap;
          overflow: visible;
          padding: 0;
        }
        .scene-palette-list .scene-card-slot {
          width: auto;
          max-width: none;
          max-height: none;
          flex: none;
        }
        .scene-palette-list .scene-card {
          max-width: none;
          max-height: none;
        }
        .scene-gallery-grid {
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
          align-items: flex-start;
          gap: 12px;
        }
        .scene-gallery-slot,
        .scene-gallery-grid > .scene-gallery-card {
          display: block;
          min-width: 0;
          width: calc(50% - 6px);
          max-width: 155px;
        }
        .scene-palette-randomize-label {
          position: absolute;
          top: 8px;
          right: 8px;
          z-index: 3;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.45);
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.02em;
          pointer-events: none;
        }
        .scene-palette-randomize-label ha-icon {
          --mdc-icon-size: 14px;
          width: 14px;
          height: 14px;
        }
        .scene-palette-randomize-label[hidden] {
          display: none !important;
        }
        .var-chip {
          position: relative;
        }
        .scene-gallery-card {
          position: relative;
          display: block;
          width: 100%;
          aspect-ratio: 1;
          max-height: 155px;
          margin: 0;
          padding: 0;
          border: 0;
          border-radius: 16px;
          overflow: hidden;
          appearance: none;
          background: var(--surface-2, #242022);
          color: #fff;
          cursor: pointer;
        }
        .scene-gallery-card::before {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 1;
          height: 46%;
          background: linear-gradient(
            to top,
            rgba(0, 0, 0, 0.62) 0%,
            rgba(0, 0, 0, 0.22) 62%,
            transparent 100%
          );
          pointer-events: none;
        }
        .scene-gallery-card.selected {
          outline: 3px solid var(--primary-color);
          outline-offset: 3px;
        }
        .scene-gallery-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          border: 0;
        }
        .scene-gallery-card > span:not(.scene-palette-randomize-label) {
          position: absolute;
          left: 10px;
          right: 10px;
          bottom: 10px;
          z-index: 2;
          font-size: 14px;
          font-weight: 650;
          line-height: 1.2;
          text-align: left;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
        }
        @media (max-width: 870px) {
          .scene-gallery-grid {
            flex-wrap: nowrap;
            overflow-x: auto;
            overscroll-behavior-x: contain;
            padding-bottom: 4px;
          }
          .scene-gallery-slot,
          .scene-gallery-grid > .scene-gallery-card {
            flex: 0 0 calc(50% - 6px);
          }
        }
        .dialog-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 16px;
        }
        .event-scene-field {
          display: flex;
          align-items: flex-end;
          gap: 4px;
          margin-top: 16px;
        }
        .event-scene-field ha-selector {
          flex: 1;
          min-width: 0;
          margin-top: 0;
        }
        .event-scene-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }
        .event-scene-hint,
        .event-scene-error {
          margin: 8px 0 0;
          font-size: 14px;
          line-height: 20px;
        }
        .event-scene-hint {
          color: var(--secondary-text-color);
        }
        .event-scene-error {
          color: var(--error-color);
        }
        .sun-event {
          flex: 1 1 0;
          min-width: 0;
          max-width: 10.5rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 2px;
          margin: 0;
          padding: 10px 8px;
          border: 1px solid transparent;
          border-radius: var(--ha-border-radius-lg, 12px);
          background: transparent;
          color: inherit;
          font: inherit;
          cursor: default;
        }
        .sun-event.clickable {
          cursor: pointer;
          background: var(--secondary-background-color, var(--card-background-color));
          border-color: var(--divider-color);
          box-shadow: var(--ha-box-shadow-s, 0 1px 2px rgba(0, 0, 0, 0.18));
          transform-origin: center center;
          transition:
            transform 160ms cubic-bezier(0.2, 0, 0, 1),
            border-color 160ms cubic-bezier(0.2, 0, 0, 1),
            background 160ms cubic-bezier(0.2, 0, 0, 1),
            box-shadow 160ms cubic-bezier(0.2, 0, 0, 1);
        }
        .sun-event.clickable:hover,
        .sun-event.clickable:focus-visible,
        .sun-event.clickable:active,
        .sun-event.clickable.selected {
          transform: scale(1.04);
        }
        .sun-event.clickable:hover {
          border-color: var(--primary-color);
          background: var(--card-background-color);
        }
        .sun-event.clickable:focus-visible {
          outline: 2px solid var(--primary-color);
          outline-offset: 2px;
        }
        .sun-event.clickable.missing {
          border: 2px solid var(--warning-color, var(--accent-color, var(--primary-color)));
          background: color-mix(
            in srgb,
            var(--warning-color, var(--primary-color)) 16%,
            var(--card-background-color)
          );
          box-shadow: none;
        }
        .sun-event.clickable.missing:hover {
          background: color-mix(
            in srgb,
            var(--warning-color, var(--primary-color)) 24%,
            var(--card-background-color)
          );
        }
        .sun-event.clickable.selected {
          border-color: var(--primary-color);
          border-width: 2px;
          background: color-mix(
            in srgb,
            var(--primary-color) 14%,
            var(--card-background-color)
          );
        }
        .sun-event.clickable.missing.selected {
          border-color: var(--primary-color);
        }
        .sun-event ha-icon {
          --mdc-icon-size: 22px;
          color: var(--primary-text-color);
        }
        .sun-event .name {
          font-size: 12px;
          font-weight: 500;
          white-space: nowrap;
        }
        .sun-event .time {
          font-size: 12px;
          color: var(--secondary-text-color);
          font-variant-numeric: tabular-nums;
        }
        .sun-event .time .solar-struck {
          text-decoration: line-through;
          opacity: 0.65;
          margin-right: 0.35em;
        }
        .sun-event .time .clamp-time {
          color: var(--primary-text-color);
          font-weight: 600;
        }
        .sun-hover-readout {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px 16px;
          min-height: 36px;
          padding: 4px 16px 8px;
          font-size: 13px;
          font-variant-numeric: tabular-nums;
          color: var(--secondary-text-color);
        }
        .sun-hover-readout[data-active] {
          color: var(--primary-text-color);
        }
        /* Dial: readout/chips live in .sun-toolbar (full stage width). Table
           view still puts the readout in .sun-path-body under the chart. */
        .sun-path.dial-view .sun-path-body {
          position: relative;
          width: 100%;
        }
        .sun-path.dial-view .sun-hover-readout {
          position: relative;
          top: auto;
          left: auto;
          z-index: 4;
          min-height: 0;
          margin: 0;
          padding: 8px 12px 8px 8px;
          pointer-events: none;
          color: var(--primary-text-color);
        }
        .sun-hover-time {
          font-weight: 500;
        }
        .sun-hover-play-split,
        .sun-hover-reset {
          pointer-events: auto;
          color: var(--primary-text-color);
          font: inherit;
        }
        .sun-hover-play-split {
          display: inline-flex;
          align-items: stretch;
          height: 32px;
          border-radius: 16px;
          background: color-mix(
            in srgb,
            var(--primary-color) 14%,
            var(--card-background-color)
          );
        }
        .sun-hover-play-main,
        .sun-hover-play-more {
          margin: 0;
          padding: 0;
          border: 0;
          background: transparent;
          color: inherit;
          cursor: pointer;
          font: inherit;
        }
        .sun-hover-play-main {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 0 8px 0 10px;
          border-radius: 16px 0 0 16px;
        }
        .sun-hover-play-label {
          font-size: 13px;
          font-weight: 500;
          white-space: nowrap;
        }
        .sun-hover-play-more {
          display: inline-grid;
          place-items: center;
          width: 28px;
          border-inline-start: 1px solid color-mix(
            in srgb,
            var(--primary-text-color) 18%,
            transparent
          );
          border-radius: 0 16px 16px 0;
        }
        .sun-hover-play-main:hover,
        .sun-hover-play-more:hover,
        .sun-hover-reset:hover {
          background: color-mix(
            in srgb,
            var(--primary-color) 24%,
            var(--card-background-color)
          );
        }
        .sun-hover-play-split ha-icon,
        .sun-hover-reset ha-icon {
          --mdc-icon-size: 18px;
        }
        .sun-hover-play-more-wrap {
          display: flex;
          align-items: stretch;
          pointer-events: auto;
        }
        .sun-hover-play-split ha-dropdown {
          display: flex;
          align-items: stretch;
          pointer-events: auto;
        }
        .sun-hover-reset {
          display: inline-grid;
          place-items: center;
          width: 32px;
          height: 32px;
          margin: 0;
          padding: 0;
          border: 0;
          border-radius: 50%;
          background: color-mix(
            in srgb,
            var(--primary-color) 14%,
            var(--card-background-color)
          );
        }
        .sun-plots {
          position: relative;
          cursor: crosshair;
        }
        .sun-now-line,
        .sun-hover-line {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 2px;
          margin-left: -1px;
          pointer-events: none;
        }
        .sun-now-line {
          background: var(--primary-color);
          z-index: 2;
        }
        .sun-hover-line {
          background: var(--primary-text-color);
          opacity: 0.55;
          z-index: 3;
          display: none;
        }
        .sun-plots[data-hovering] .sun-hover-line {
          display: block;
        }
        .sun-now {
          position: absolute;
          width: 10px;
          height: 10px;
          margin-left: -5px;
          margin-top: -5px;
          border-radius: 50%;
          background: var(--primary-color);
          border: 2px solid var(--card-background-color);
          box-sizing: border-box;
          pointer-events: none;
        }
        .sun-dot {
          position: absolute;
          width: 9px;
          height: 9px;
          margin-left: -4.5px;
          margin-top: -4.5px;
          border-radius: 50%;
          background: transparent;
          border: 2px solid var(--secondary-text-color);
          box-sizing: border-box;
          pointer-events: none;
          opacity: 0.55;
        }
        .sun-dot.clamp-tick {
          width: 6px;
          height: 6px;
          margin-left: -3px;
          margin-top: -3px;
          border-width: 1.5px;
          border-style: dashed;
          border-color: var(--secondary-text-color);
          background: transparent;
          opacity: 0.75;
        }
        .sun-clamp-link {
          position: absolute;
          height: 0;
          border: none;
          border-top: 1px dashed var(--secondary-text-color);
          opacity: 0.55;
          pointer-events: none;
          transform-origin: left center;
        }
        .page-shell {
          box-sizing: border-box;
          width: 100%;
          height: 100%;
          min-height: 0;
          display: flex;
          flex-direction: column;
          padding-right: var(--scene-sidebar-gutter);
          overflow-x: clip;
          overflow-y: hidden;
        }
        .page {
          --page-max-width: 1024px;
          max-width: var(--page-max-width);
          width: 100%;
          margin-inline: auto;
          padding-inline: 12px;
          box-sizing: border-box;
        }
        /* Narrow editors drop the area rail and mount straight in .page.
           The 12px inset kept tiles and the dial off the screen edge.
           The editor fills the shell: the wheel grows, the tiles stay at the bottom. */
        :host([narrow]) .page {
          padding-inline: 0;
        }
        :host([narrow]) .page:has(.content.wide),
        :host([narrow]) .page.dial-wide {
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          max-width: none;
          padding-bottom: 0;
        }
        /* The dial page also has an empty .content.wide, so :has(.content.wide)
           matches it and is more specific than .page.dial-wide. */
        :host([narrow]) .page:has(.content.wide):not(.dial-wide) {
          overflow: hidden;
        }
        /* The face shrinks to the leftover height. The page does not scroll. */
        :host([narrow]) .page.dial-wide {
          overflow: hidden;
        }
        :host([narrow]) .content.wide {
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          padding: 0;
        }
        /* Dial pages keep an empty .content beside the sun path. The fill
           rule above would split the column with it and shrink the dial. */
        :host([narrow]) .page.dial-wide > .content:empty {
          display: none;
          flex: none;
        }
        :host([narrow]) .page.dial-wide > .sun-path.dial-view {
          flex: 1 1 auto;
          min-height: 0;
          min-width: 0;
          width: 100%;
          display: flex;
          flex-direction: column;
          /* Tile-strip bleed padding hangs out of the column. Clip it so that
             padding is not extra scroll while the face still fits. Plates that
             slide up over the dial stay inside this box. */
          overflow: clip;
        }
        :host([narrow]) .sun-path.dial-view .sun-toolbar {
          flex: 0 0 auto;
        }
        :host([narrow]) .sun-chip-row,
        :host([narrow]) .sun-toolbar-chrome .sun-chip-row {
          display: none;
        }
        :host([narrow]) .sun-path.dial-view .sun-year-scrub {
          margin-bottom: 16px;
        }
        :host([narrow]) .sun-path.dial-view .sun-date-tools {
          flex-wrap: nowrap;
          width: 100%;
        }
        :host([narrow]) .sun-path.dial-view .sun-date-tools .sun-hover-readout {
          position: static;
          flex: 1 1 auto;
          justify-content: flex-end;
          flex-wrap: nowrap;
          min-height: 0;
          margin: 0;
          padding: 0;
          gap: 8px 12px;
        }
        :host([narrow]) .sun-hover-play-split {
          display: none;
        }
        @media (max-width: 870px) {
          .sun-chip-row,
          .sun-toolbar-chrome .sun-chip-row {
            display: none;
          }
          .sun-path.dial-view .sun-year-scrub {
            margin-bottom: 16px;
          }
        }
        :host([narrow]) .sun-path.dial-view .sun-path-stage,
        :host([narrow]) .sun-path.dial-view .sun-path-body,
        :host([narrow]) .sun-path.dial-view .sun-light-clock {
          flex: 1 1 auto;
          min-width: 0;
          min-height: 0;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        :host([narrow]) .sun-path.dial-view .sun-light-clock {
          padding: 0;
          gap: 0;
          justify-content: flex-start;
          /* The face may shrink below the color-wheel floor so the tiles fit.
             No extra pad: auto margins center the face between the date and tiles. */
          min-height: 0;
          flex: 1 1 auto;
          container-type: size;
        }
        :host([narrow]) .sun-path.dial-view .sun-light-clock-legend {
          flex: 0 0 auto;
          width: 100%;
          margin-top: 0;
          padding-bottom: var(--scene-safe-bottom, 0px);
        }
        :host([narrow]) .sun-light-clock-face {
          flex: 0 0 auto;
          /* --dial-face-max is the leftover height. margin-block centers the
             face in the space above the tiles; the legend stays at the bottom. */
          width: min(100%, var(--dial-face-max, 100%));
          max-width: 100%;
          height: auto;
          max-height: var(--dial-face-max, none);
          margin-inline: 0;
          margin-block: auto;
        }
        /* Workspace (rail + .stage-col) always uses the full panel — same
           shell as the circadian dial, including simple/variable editors. */
        .page:has(.workspace),
        .page.dial-wide {
          --page-max-width: none;
          max-width: none;
          padding-inline: 0;
          /* Extend under the sidebar gutter; in-flow content keeps padding so
             the dial still shifts left while horizon backgrounds span full width. */
          margin-right: calc(-1 * var(--scene-sidebar-gutter));
          width: calc(100% + var(--scene-sidebar-gutter));
          padding-right: var(--scene-sidebar-gutter);
          /* No FAB pad. The name button floats, and a bottom pad would lift
             the light tiles off the shell. Workspace pages also must not pad:
             the pad shrinks the flex content box while the workspace is sized
             to the shell, so overflow:hidden clips the scenes list and editor. */
          padding-bottom: 0;
          box-sizing: border-box;
          position: relative;
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          /* The shell clips. This page fills it so the scenes list and the
             editor body scroll inside, instead of growing past the panel. */
          overflow: hidden;
        }
        /* Clip X on the wide page. Horizon may bleed under the frosted rail;
           height is capped in _layoutClockHorizonBack. */
        .page:has(.workspace) {
          padding-bottom: 0;
        }
        .page:has(.workspace),
        .page.dial-wide {
          overflow-x: clip;
        }
        /* Sidebar open: keep path/face overflow visible for chips / underpaint;
           leave page-shell x-clipped so the horizontal scrollbar stays gone. */
        :host([data-sidebar-docked]) .sun-path.dial-view,
        :host([data-sidebar-docked]) .sun-path-stage,
        :host([data-sidebar-docked]) .sun-path-body,
        :host([data-sidebar-docked]) .sun-light-clock {
          overflow: visible;
        }
        /* Shared inset for draft + location banners (dial zeroes .page padding).
           Mounted into .stage-col when a workspace exists so they push the
           dial/list down without spanning the area rail. */
        .page-banners {
          position: relative;
          z-index: 5;
          flex: 0 0 auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: var(--ha-space-3);
          margin-inline: 16px;
        }
        .stage-col > .page-banners {
          z-index: 2;
        }
        .page-banners[hidden] {
          display: none;
        }
        .draft-restore {
          position: relative;
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          padding: 10px 12px;
          border-radius: var(--ha-border-radius-lg, 12px);
          border: 1px solid var(--info-color, var(--primary-color));
          background: color-mix(
            in srgb,
            var(--info-color, var(--primary-color)) 14%,
            var(--card-background-color)
          );
        }
        .draft-restore[hidden] {
          display: none;
        }
        .draft-restore ha-icon {
          --mdc-icon-size: 22px;
          color: var(--info-color, var(--primary-color));
          flex-shrink: 0;
        }
        .draft-restore-copy {
          flex: 1 1 auto;
          min-width: 0;
        }
        .draft-restore-copy .title {
          font-size: 13px;
          font-weight: 600;
        }
        .draft-restore-copy .detail {
          font-size: 12px;
          line-height: 1.35;
          color: var(--secondary-text-color);
        }
        .draft-restore-dismiss {
          flex-shrink: 0;
          margin-inline-end: -4px;
        }
        .content {
          position: relative;
          z-index: 5;
          padding: var(--ha-space-3) 0 88px;
        }
        /* Dial editor leaves content empty — do not reserve FAB pad twice. */
        .content:empty {
          display: none;
          padding: 0;
        }
        .content.wide {
          width: 100%;
          box-sizing: border-box;
          /* The shared content pad left a black band between the app bar and
             the wheel glow. Bottom pad stays so the FAB does not cover tiles. */
          padding-top: 0;
        }
        .content:has(.workspace) {
          flex: 1 1 auto;
          min-height: 0;
          overflow: hidden;
          padding: 0;
        }
        /* Color wheels cap at WHEEL_FACE_MAX; --dial-face-max shrinks them to
           fit above light tiles. The stage column itself stays full width. */
        .stage-col .hue-wheel-stage {
          width: min(100%, ${WHEEL_FACE_MAX_PX}px, var(--dial-face-max, ${WHEEL_FACE_MAX_PX}px));
          max-width: min(100%, ${WHEEL_FACE_MAX_PX}px, var(--dial-face-max, ${WHEEL_FACE_MAX_PX}px));
          margin: 0 auto;
          padding: 40px 0 16px;
          box-sizing: border-box;
        }
        .stage-col .hue-wheel-canvas {
          width: 100%;
          max-width: none;
        }
        /* Simple-scene disk is the leftover above the light tiles, not the
           dial budget. 64px is the mode row (48) plus the stage gap (16).
           Floor matches WHEEL_FACE_MIN_PX; the wheels box min-height makes
           the scrollport scroll before the disk goes smaller. */
        .stage-col .simple-editor .hue-wheel-stage {
          min-width: 0;
          padding: 0;
          width: 100%;
          max-width: none;
          height: 100%;
          max-height: 100%;
        }
        .stage-col .simple-editor .hue-wheel-canvas {
          width: max(
            ${WHEEL_FACE_MIN_PX}px,
            min(100cqi, calc(100cqb - 64px), ${WHEEL_FACE_MAX_PX}px)
          );
          max-width: min(100%, ${WHEEL_FACE_MAX_PX}px, calc(100cqb - 64px));
          height: auto;
        }
        /* Vertical modes and variables when the gutter beside the disk is wide enough. */
        .simple-editor.chrome-aside {
          .hue-wheel-face {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .stage-col .simple-editor .hue-wheel-canvas {
            width: min(100%, 100cqb, ${WHEEL_FACE_MAX_PX}px);
            height: auto;
            max-width: 100%;
            max-height: 100%;
            aspect-ratio: 1;
            margin: 0 auto;
          }
          .hue-wheel-chrome {
            position: absolute;
            top: 50%;
            left: calc(50% + var(--wheel-half, 0px) + var(--chrome-gap, 16px));
            right: auto;
            bottom: auto;
            transform: translateY(-50%);
            z-index: 4;
            flex-direction: column;
            align-items: flex-start;
            justify-content: flex-start;
            width: max-content;
            max-width: calc(50% - var(--wheel-half, 0px) - var(--chrome-gap, 16px) - 8px);
            height: auto;
            max-height: 100%;
            min-height: 0;
            padding: 6px 4px 6px 14px;
            box-sizing: border-box;
            overflow: visible;
            gap: 8px;
            transition:
              opacity 180ms cubic-bezier(0.2, 0, 0, 1),
              transform 180ms cubic-bezier(0.2, 0, 0, 1);
          }
          .hue-wheel-chrome:not(.is-shown) {
            opacity: 0;
            transform: translateY(-50%) translateX(24px);
            pointer-events: none;
          }
          .hue-wheel-mode-cluster,
          .hue-presets {
            opacity: 1;
            transform: none;
            pointer-events: auto;
          }
          .hue-wheel-chrome::-webkit-scrollbar {
            display: none;
          }
          /* Color modes stay put. Only the variables (and palette colors) scroll. */
          .hue-wheel-mode-cluster {
            flex: 0 0 auto;
            align-items: flex-start;
            align-self: flex-start;
            width: max-content;
            max-width: 100%;
            padding: 0 0 10px;
            margin-bottom: 12px;
            border-bottom: 1px solid var(--divider-color);
            background: none;
          }
          .wheel-mode-pill {
            flex-direction: column;
            align-items: flex-start;
            width: auto;
            max-width: 100%;
            height: auto;
            padding: 0;
            gap: 4px;
            background: none;
            box-shadow: none;
          }
          .wheel-mode-pill .wheel-wrapper {
            width: auto;
            max-width: 100%;
            height: 32px;
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: flex-start;
            gap: 8px;
            padding: 4px 0;
            border-color: transparent;
            opacity: 0.75;
            overflow: visible;
          }
          .wheel-mode-pill .wheel-wrapper:hover,
          .wheel-mode-pill .wheel-wrapper:active,
          .wheel-mode-pill .wheel-wrapper.active {
            border-color: transparent;
            background-color: transparent;
            opacity: 1;
          }
          .wheel-mode-pill .wheel-wrapper.active {
            gap: 10px;
          }
          .wheel-mode-pill .wheel-wrapper {
            transform-origin: 14px center;
            transition: transform 160ms cubic-bezier(0.2, 0, 0, 1);
          }
          .wheel-mode-pill .wheel-wrapper:hover:not(.active) {
            transform: translateX(-1.6px) scale(1.08);
          }
          .wheel-mode-pill .wheel-wrapper.active,
          .wheel-mode-pill .wheel-wrapper.active:hover {
            transform: translateX(-3.8px) scale(1.08);
          }
          .wheel-mode-pill .wheel-wrapper:active {
            transform: translateX(0.8px) scale(0.96);
          }
          .wheel-mode-pill .wheel-wrapper.active:active {
            transform: translateX(-1.1px) scale(0.96);
          }
          .wheel-mode-pill .wheel-wrapper .wheel {
            position: relative;
          }
          .wheel-mode-pill .wheel-wrapper.active .wheel {
            outline: none;
          }
          .wheel-mode-pill .wheel-wrapper.active .wheel::after {
            content: "";
            position: absolute;
            inset: -4px;
            border-radius: 50%;
            border: 2px solid #fff;
            opacity: 0.75;
            pointer-events: none;
            animation: hue-preset-ring-in 180ms cubic-bezier(0.2, 0, 0, 1);
          }
          .wheel-mode-pill .wheel-wrapper.palette-active {
            width: auto;
            background: none;
          }
          .wheel-mode-pill .wheel-wrapper.active .wheel-mode-name {
            font-weight: 700;
          }
          .wheel-mode-pill .wheel-wrapper .wheel {
            order: 0;
          }
          .wheel-mode-pill .wheel-wrapper .wheel-mode-name {
            order: 1;
          }
          .wheel-mode-pill .wheel-wrapper.palette-active .wheel-palette-edit {
            order: 2;
            width: auto;
            margin-inline-start: 4px;
          }
          .wheel-mode-name {
            display: block;
            max-width: none;
            overflow: visible;
            text-align: start;
          }
          .hue-presets {
            flex-direction: column;
            align-items: flex-start;
            justify-content: flex-start;
            width: max-content;
            max-width: 100%;
            height: auto;
            max-height: none;
            min-height: 0;
            flex: 1 1 auto;
            /* The scaled swatch and its ring sit in this padding so overflow
               does not clip the top of the selected variable. */
            padding: 14px 8px 14px 12px;
            margin: 0 -4px 0 0;
            overflow-x: hidden;
            overflow-y: auto;
            scrollbar-width: none;
            border-radius: 0;
            background: none;
            box-shadow: none;
          }
          .hue-presets::-webkit-scrollbar {
            display: none;
          }
          .hue-presets.can-scroll-start {
            -webkit-mask-image: linear-gradient(to bottom, transparent, #000 28px);
            mask-image: linear-gradient(to bottom, transparent, #000 28px);
          }
          .hue-presets.can-scroll-end {
            -webkit-mask-image: linear-gradient(
              to bottom,
              #000 calc(100% - 28px),
              transparent
            );
            mask-image: linear-gradient(to bottom, #000 calc(100% - 28px), transparent);
          }
          .hue-presets.can-scroll-start.can-scroll-end {
            -webkit-mask-image: linear-gradient(
              to bottom,
              transparent,
              #000 28px,
              #000 calc(100% - 28px),
              transparent
            );
            mask-image: linear-gradient(
              to bottom,
              transparent,
              #000 28px,
              #000 calc(100% - 28px),
              transparent
            );
          }
          .hue-presets-track {
            flex-direction: column;
            align-items: flex-start;
            width: max-content;
            max-width: 100%;
            overflow: visible;
          }
          .hue-presets::after {
            display: none;
          }
          .hue-preset:not(.add) {
            width: auto;
            max-width: 100%;
            height: 36px;
            border-radius: 18px;
            flex-direction: row;
            justify-content: flex-start;
            gap: 8px;
            padding: 4px 0;
            border-color: transparent;
            opacity: 0.75;
          }
          .hue-preset:not(.add):hover,
          .hue-preset.active {
            border-color: transparent;
            opacity: 1;
          }
          .hue-preset.active {
            gap: 10px;
          }
          .hue-preset {
            transform-origin: 14px center;
            transition: transform 160ms cubic-bezier(0.2, 0, 0, 1);
          }
          .hue-preset:hover:not(.active) {
            transform: translateX(-1.6px) scale(1.08);
          }
          .hue-preset.active,
          .hue-preset.active:hover {
            transform: translateX(-3.8px) scale(1.08);
          }
          .hue-preset:active {
            transform: translateX(0.8px) scale(0.96);
          }
          .hue-preset.active:active {
            transform: translateX(-1.1px) scale(0.96);
          }
          .hue-preset.active .hue-preset-swatch {
            outline: none;
          }
          .hue-preset.active .hue-preset-swatch::after {
            content: "";
            position: absolute;
            inset: -4px;
            border-radius: inherit;
            border: 2px solid #fff;
            opacity: 0.75;
            pointer-events: none;
            animation: hue-preset-ring-in 180ms cubic-bezier(0.2, 0, 0, 1);
          }
          .hue-preset.active .hue-preset-name {
            font-weight: 700;
          }
          .hue-preset.add {
            align-self: flex-start;
            width: auto;
            max-width: 100%;
            height: 36px;
            padding: 4px 0;
            justify-content: flex-start;
            gap: 8px;
            border-radius: 18px;
          }
          .hue-preset-name {
            display: block;
            max-width: none;
            overflow: visible;
            text-align: start;
          }
          .hue-palette-colors:not([hidden]) {
            display: flex !important;
            flex-direction: column;
            align-items: flex-start;
            gap: 2px;
            width: max-content;
            max-width: 100%;
            margin: 0 0 10px;
            padding: 0 0 10px;
            border-bottom: 1px solid var(--divider-color);
          }
          .hue-palette-colors-title {
            margin: 2px 0 4px;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: var(--secondary-text-color);
          }
          .hue-palette-color {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 8px;
            height: 36px;
            max-width: 100%;
            opacity: 0.9;
          }
        }
        @keyframes hue-preset-ring-in {
          from {
            transform: scale(0.72);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 0.75;
          }
        }
        :host(:not([data-dark-mode])) .simple-editor.chrome-aside .wheel-mode-pill .wheel-wrapper.active .wheel::after,
        :host(:not([data-dark-mode])) .simple-editor.chrome-aside .hue-preset.active .hue-preset-swatch::after {
          border-color: var(--primary-color);
        }
        .stage-bg .hue-wheel-glow {
          position: absolute;
          pointer-events: none;
          z-index: 0;
          transform: scale(1.2);
          transform-origin: center center;
          filter: blur(36px) saturate(1.3);
          opacity: 0.4;
          border-radius: 50%;
        }
        :host(:not([data-dark-mode])) .stage-bg .hue-wheel-glow {
          opacity: 0.16;
        }
        .card-content {
          padding: 16px;
        }
        .list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .list-tab-group {
          display: block;
          margin: 0 0 12px;
          --ha-tab-indicator-color: var(--primary-color);
        }
        .row.created-scene {
          cursor: pointer;
        }
        .list-settings-dialog .setup-link-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 0;
        }
        .list-settings-dialog .setup-link-row ha-switch {
          flex-shrink: 0;
          margin-top: 2px;
        }
        .list-settings-dialog .update-preference-row:has(ha-selector) {
          flex-direction: column;
          align-items: stretch;
        }
        .list-settings-dialog .automatically-update-lights-interval-row {
          flex-direction: column;
          align-items: stretch;
        }
        .list-settings-dialog .automatically-update-lights-interval-row ha-selector {
          width: 100%;
          margin-top: 8px;
        }
        .list-settings-dialog .dusk-minimum-row {
          flex-direction: column;
          align-items: stretch;
          gap: 4px;
        }
        .row .row-actions {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }
        .row .row-actions ha-icon-button {
          --mdc-icon-button-size: 40px;
          color: var(--secondary-text-color);
        }
        /* Shared with create-wizard mode cards; list uses the same chrome. */
        .setup-mode-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          width: 100%;
          text-align: left;
          padding: 14px 16px;
          border-radius: var(--ha-border-radius-lg, 12px);
          border: 2px solid var(--divider-color);
          background: var(--card-background-color);
          color: var(--primary-text-color);
          cursor: pointer;
          box-sizing: border-box;
        }
        /* After .setup-mode-card so row layout wins (same specificity otherwise
           leaves the switch under the copy). */
        .setup-mode-card.list-aul-card {
          margin-bottom: 12px;
          flex-direction: row;
          align-items: center;
          gap: 12px;
        }
        .list-aul-card .aul-copy {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
        }
        .list-aul-card .mode-detail {
          padding-left: 30px;
        }
        .list-aul-card ha-switch {
          flex-shrink: 0;
          pointer-events: auto;
        }
        .setup-mode-card:hover {
          border-color: color-mix(in srgb, var(--primary-color) 45%, var(--divider-color));
        }
        .setup-mode-card.selected {
          border-color: var(--primary-color);
          background: color-mix(
            in srgb,
            var(--primary-color) 10%,
            var(--card-background-color)
          );
        }
        .setup-mode-card .mode-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 15px;
          font-weight: 600;
        }
        .setup-mode-card .mode-title ha-icon {
          --mdc-icon-size: 22px;
          color: var(--primary-color);
        }
        .setup-mode-card .mode-detail {
          font-size: 13px;
          line-height: 1.35;
          color: var(--secondary-text-color);
          padding-left: 30px;
        }
        /* Scene list: HA data-table-like surface (custom panels cannot load
           ha-data-table reliably — lazy chunk, Lit column templates). */
        .list.scene-table {
          gap: 0;
          border: 1px solid var(--divider-color);
          border-radius: var(--ha-card-border-radius, 12px);
          overflow: hidden;
          background: var(--card-background-color);
        }
        .list.scene-table .scene-table-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 16px;
          height: 48px;
          box-sizing: border-box;
          color: var(--secondary-text-color);
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          border-bottom: 1px solid var(--divider-color);
          background: var(--card-background-color);
        }
        .list.scene-table .scene-table-group {
          display: flex;
          align-items: center;
          padding: 8px 16px;
          box-sizing: border-box;
          font-size: 14px;
          font-weight: 500;
          color: var(--secondary-text-color);
          background: var(--primary-background-color);
          border-bottom: 1px solid var(--divider-color);
        }
        .list.scene-table .scene-table-header .meta {
          flex: 1;
          min-width: 0;
        }
        .list.scene-table .scene-table-header .row-actions {
          width: 88px;
          flex-shrink: 0;
        }
        .list.scene-table .row {
          border: none;
          border-radius: 0;
          border-bottom: 1px solid var(--divider-color);
          background: transparent;
        }
        .list.scene-table .row:last-child {
          border-bottom: none;
        }
        .list.scene-table .row:hover {
          background: color-mix(
            in srgb,
            var(--primary-text-color) 6%,
            var(--card-background-color)
          );
        }
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          box-sizing: border-box;
          width: 100%;
          max-width: 480px;
          margin-inline: auto;
          padding: 48px 24px 112px;
          /* Prefer the scrollport height over 100vh so empty states do not
             force a second scrollbar outside ha-top-app-bar. */
          min-height: calc(100% - 96px);
        }
        .empty-state > ha-icon {
          --mdc-icon-size: 80px;
          color: var(--disabled-text-color, var(--secondary-text-color));
          margin-bottom: 16px;
        }
        .empty-state h1 {
          margin: 0 0 16px;
          font-size: 1.5rem;
          font-weight: 400;
          line-height: 1.3;
          color: var(--primary-text-color);
        }
        .stage-scroll > .empty-state {
          flex: 1 1 auto;
          width: 100%;
          max-width: 560px;
          min-height: 100%;
          padding: 48px 24px 64px;
        }
        .empty-state p {
          margin: 0 0 12px;
          font-size: 14px;
          line-height: 1.5;
          color: var(--secondary-text-color);
        }
        .empty-state a.learn-more {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-top: 8px;
          color: var(--primary-color);
          text-decoration: none;
          font-size: 14px;
        }
        .empty-state a.learn-more:hover {
          text-decoration: underline;
        }
        .empty-state a.learn-more ha-icon {
          --mdc-icon-size: 16px;
        }
        .empty-state .auto-configure {
          margin-top: 16px;
        }
        .empty {
          text-align: center;
          padding: 48px 16px;
          color: var(--secondary-text-color);
        }
        .row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: var(--card-background-color);
          border-radius: var(--ha-card-border-radius, 12px);
          cursor: pointer;
          border: 1px solid var(--divider-color);
        }
        .row:hover {
          background: var(--secondary-background-color);
        }
        .row ha-icon,
        .row ha-state-icon {
          color: var(--secondary-text-color);
          --mdc-icon-size: 24px;
        }
        .row .meta {
          flex: 1;
          min-width: 0;
        }
        .row .name {
          font-weight: 500;
        }
        .row .sub {
          color: var(--secondary-text-color);
          font-size: 14px;
        }
        /* Corner overlay matching hass-subpage #fab. ha-top-app-bar-fixed has
           no fab slot, so this sits as a sibling of the app bar. */
        .fab {
          position: absolute;
          right: calc(
            16px + var(--safe-area-inset-right, 0px) +
              var(--scene-sidebar-gutter)
          );
          bottom: calc(16px + var(--safe-area-inset-bottom, 0px));
          /* Above the light-tile strip (z-index 12). The event sidebar stays higher. */
          z-index: 13;
          --ha-button-box-shadow: var(--ha-box-shadow-l);
          transform-origin: bottom right;
          transition:
            opacity 180ms cubic-bezier(0.2, 0, 0, 1),
            transform 180ms cubic-bezier(0.2, 0, 0, 1),
            visibility 180ms;
        }
        /* Prefer class over [hidden] so opacity/scale can animate (UA hidden is display:none). */
        .fab.is-hidden {
          opacity: 0;
          transform: scale(0.85);
          visibility: hidden;
          pointer-events: none;
        }
        .save-dialog ha-input,
        .save-dialog ha-textfield,
        .save-dialog ha-textarea,
        .save-dialog ha-labels-picker,
        .save-dialog ha-category-picker,
        .save-dialog ha-icon-picker,
        .save-dialog ha-selector,
        .area-dialog ha-selector,
        .confirm-dialog p {
          display: block;
          margin-top: 16px;
        }
        .area-dialog {
          --mdc-dialog-min-width: min(440px, 95vw);
        }
        .area-dialog .setup-step {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-top: 8px;
        }
        .area-dialog .setup-step[hidden] {
          display: none;
        }
        .area-dialog .setup-mode-cards {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .area-dialog .setup-error {
          margin: 0;
          color: var(--error-color);
          font-size: 13px;
          line-height: 1.35;
        }
        .area-dialog .setup-intro {
          margin: 0;
          color: var(--primary-text-color);
          font-size: 14px;
          line-height: 1.45;
        }
        .area-dialog .setup-intro .muted {
          color: var(--secondary-text-color);
          font-size: 13px;
        }
        .area-dialog .setup-slot {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .area-dialog .setup-slot ha-selector {
          display: block;
          margin-top: 0;
        }
        .area-dialog .setup-link-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 4px 0 8px;
        }
        .area-dialog .setup-link-row span {
          font-size: 14px;
          line-height: 1.3;
        }
        .area-dialog .setup-link-helper {
          margin: -4px 0 8px;
          font-size: 12px;
          line-height: 1.35;
          color: var(--secondary-text-color);
        }
        .save-dialog ha-chip-set {
          margin-top: 16px;
        }
        .error {
          color: var(--error-color);
          margin: 0 0 16px;
        }
        button.fallback {
          background: var(--primary-color);
          color: var(--text-primary-color, #fff);
          border: 0;
          border-radius: 8px;
          padding: 8px 16px;
          cursor: pointer;
        }
        button.fallback.danger {
          background: var(--error-color);
        }
        button.fallback.ghost {
          background: transparent;
          color: var(--primary-color);
        }
        ha-icon-button {
          --mdc-icon-button-size: 40px;
          color: inherit;
        }
        ${LANDING_CSS}
        ${SIMPLE_EDITOR_CSS}
        ${EDITOR_SHELL_CSS}
        ${EDITOR_SHELL_LAYOUT_CSS}
        ${EDITOR_SHELL_MOTION_CSS}
        ${EDITOR_LIBRARY_PREVIEW_CSS}
        ${EDITOR_CONTAINER_CSS}
        ${EVENT_EDITOR_CSS}
      `;
