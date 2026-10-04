/* dial renderer owns these panel methods.
 * The receiver is the panel: navigation, rendering and saving remain host hooks.
 * Keep closures bound to that receiver; do not bind methods to a separate object. */
import { SECONDS_PER_DAY, CLOCK_VIEW, CLOCK_CX, CLOCK_CY, CLOCK_EVENT_BTN_PX, CLOCK_TICK_MINOR_LEN, CLOCK_HOUR_LABEL_OUTSET_PX, CLOCK_EVENT_GAP_FROM_PATH_PX } from "./panel_constants.js";
import { polarEaseClosedPathD, THEME_BRIGHTNESS_SNAP } from "./color_ui.js";
import { nowSecondsSinceMidnight, formatClock } from "./editor_session.js";
import { interpolateElevation, skyLookFromElevation, conicGradientFromSamples } from "./dial_clock.js";
import { bindGroupTitleStick, captureLightStripLayout, createAddLightTile, createLightTilesHint, playLightStripLayout, revealLightActionsNow } from "./light_tiles.js";

export const dialRendererMethods = {
  _drawSunPath() {
    if (this._view === "theme") {
      /* Theme editor uses the same dial as circadian scenes. */
    } else if (this._view !== "edit" || this._formData?.kind === "simple") {
      this._parkSunPath();
      return;
    }
    if (!this._sunPathEl || !this._sunPath || !this._sunPath.curve?.length) {
      return;
    }
    if (
      this._clockRingsHost?.isConnected &&
      this._patchLightClock(this._sunPath)
    ) {
      this._displayedSunPath = this._sunPath;
      if (this._dateToolbar) {
        if (this._yearScrubbing) {
          this._syncYearScrub();
        } else {
          this._syncDateToolbar();
        }
      }
      this._syncEditorChrome();
      this._ensureHoverReadout();
      this._syncYearScrubLayout();
      this._fillHoverReadout(this._idleReadoutSeconds(), { hovering: false, paintLights: false });
      this._syncSceneUsed();
      return;
    }
    const { events } = this._sunPath;
    const tileSnap = captureLightStripLayout(
      this._clockLegendEl?.querySelector(".light-tiles")
    );
    const clockEl = this._buildLightClock(events);
    if (!this._dateToolbar) {
      this._dateToolbar = this._buildDateToolbar();
    }
    if (this._dateToolbar.parentNode !== this._sunPathEl) {
      const before = this._sunPathStage || this._sunPathBodyEl;
      this._sunPathEl.insertBefore(this._dateToolbar, before);
    }
    if (this._yearScrubbing) {
      this._syncYearScrub();
    } else {
      this._syncDateToolbar();
    }
    const children = [];
    if (events.some((event) => event.fallback)) {
      const note = document.createElement("p");
      note.className = "sun-fallback-note";
      note.textContent = this._t(
        "frontend.chart.fallback_note",
        "* Time uses a seasonal fallback because the sun does not rise or set that day."
      );
      children.push(note);
    }
    children.push(clockEl);
    this._sunPathEl.hidden = false;
    this._sunPathBodyEl.replaceChildren(...children);
    if (this._clockLegendEl) {
      this._sunPathEl.appendChild(this._clockLegendEl);
    }
    playLightStripLayout(
      this._clockLegendEl?.querySelector(".light-tiles"),
      tileSnap
    );
    this._syncEditorChrome();
    this._ensureHoverReadout();
    this._syncYearScrubLayout();
    this._fillHoverReadout(this._idleReadoutSeconds(), { hovering: false });
    this._syncSceneUsed();
    this._displayedSunPath = this._sunPath;
    this._syncSharedEditorShell();
    this._restoreHeldTileScroll();
  },

  _patchHoverReadoutClock(seconds) {
    this._updateLightNameBrightness(seconds);
    const readout = this._hoverReadout;
    if (!readout) {
      return;
    }
    const time = readout.querySelector(".sun-hover-time");
    const sun = readout.querySelector(".sun-hover-elev");
    if (time) {
      time.textContent = formatClock(seconds);
    }
    if (sun && this._sunPath?.curve) {
      const elev = interpolateElevation(this._sunPath.curve, seconds);
      sun.textContent = `Sun ${elev.toFixed(1)}°`;
    }
  },

  _fillHoverReadout(seconds, { hovering, paintLights = true }) {
    if (paintLights) this._updateLightNameBrightness(seconds);
    const readout = this._hoverReadout;
    if (!readout) {
      return;
    }
    if (seconds == null) {
      seconds = nowSecondsSinceMidnight();
    }
    if (hovering) {
      readout.setAttribute("data-active", "");
    } else {
      readout.removeAttribute("data-active");
    }
    const eventIdle =
      !hovering &&
      this._sidebarEventId &&
      (this._sunPath?.events || []).some((e) => e.id === this._sidebarEventId);
    const sticky = this._clockStickySeconds != null;
    const timeLabel =
      hovering || eventIdle || sticky
        ? formatClock(seconds)
        : `Now ${formatClock(seconds)}`;
    const curve = this._sunPath?.curve;
    const elev = curve ? interpolateElevation(curve, seconds) : null;
    const sunLabel = elev == null ? "" : `Sun ${elev.toFixed(1)}°`;
    let timeRow = readout.querySelector(":scope > .sun-time-row");
    const firstPaint = !timeRow;
    if (!timeRow) {
      timeRow = document.createElement("div");
      timeRow.className = "sun-time-row";
      const time = document.createElement("span");
      time.className = "sun-hover-time";
      const sun = document.createElement("span");
      sun.className = "sun-hover-elev";
      const resetSlot = document.createElement("span");
      resetSlot.className = "sun-hover-reset-slot";
      timeRow.append(time, sun, resetSlot);
      readout.append(timeRow);
    }
    const time = timeRow.querySelector(".sun-hover-time");
    const sun = timeRow.querySelector(".sun-hover-elev");
    if (time.textContent !== timeLabel) time.textContent = timeLabel;
    if (sun.textContent !== sunLabel) sun.textContent = sunLabel;
    const resetSlot = timeRow.querySelector(".sun-hover-reset-slot");
    const reset = resetSlot.firstElementChild;
    const wantReset = sticky && this._isDialView();
    if (wantReset && !reset) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sun-hover-reset";
      button.title = "Reset to now";
      button.setAttribute("aria-label", "Reset sun to current time");
      const icon = document.createElement("ha-icon");
      icon.setAttribute("icon", "mdi:restore");
      button.appendChild(icon);
      button.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this._resetClockSunToNow();
      });
      resetSlot.appendChild(button);
    } else if (!wantReset && reset) {
      reset.remove();
    }
    if (this._canPlayScenePreview()) {
      const play = this._ensureScenePlayButton();
      if (play.parentElement !== readout) readout.insertBefore(play, timeRow);
    } else {
      readout.querySelector(":scope > .sun-hover-play-split")?.remove();
    }
    // Preset/usage controls refresh on data and selection changes, not each frame.
    if (firstPaint) this._syncSceneUsed();
    const used = readout.querySelector(":scope > .scene-used, :scope > .library-used-by");
    if (used && used.nextSibling !== timeRow) readout.insertBefore(used, timeRow);
    this._syncNarrowPlayAction();
  },

  _applyClockSunAppearance(seconds, { skipHorizonGlow = false } = {}) {
    const curve = this._sunPath?.curve;
    if (!curve?.length) {
      return;
    }
    this._clockSunDisplayedSeconds = seconds;
    const elev = interpolateElevation(curve, seconds);
    const glowLook = skyLookFromElevation(elev);
    const pos = this._clockSunXy(seconds, elev);
    // Year-scrub must never leave us updating a detached sun while the visible
    // outline stays put — reattach refs to the live core nodes if needed.
    this._ensureLiveClockSunEls();
    const sun = this._clockSunEl;
    const sunHit = this._clockSunHitEl;
    const scale = this._clockSunScale(elev);
    if (sun) {
      sun.style.left = `${(pos.x / CLOCK_VIEW) * 100}%`;
      sun.style.top = `${(pos.y / CLOCK_VIEW) * 100}%`;
      sun.style.setProperty("--sun-scale", String(scale));
      sun.classList.toggle("below-horizon", elev < 0);
      sun.setAttribute(
        "aria-label",
        `Sun ${elev >= 0 ? "above" : "below"} horizon`
      );
      this._layoutClockSunFill(pos, scale);
      this._layoutClockHandle(seconds, elev, scale);
    } else {
      this._layoutClockHandle(seconds, elev, 1);
    }
    if (sunHit) {
      sunHit.style.left = `${(pos.x / CLOCK_VIEW) * 100}%`;
      sunHit.style.top = `${(pos.y / CLOCK_VIEW) * 100}%`;
      sunHit.style.setProperty("--sun-scale", String(scale));
    }
    const handleHit = this._clockHandleHitEl;
    if (handleHit) {
      handleHit.style.setProperty(
        "--handle-deg",
        `${this._clockAngleDeg(seconds)}deg`
      );
    }
    // Dial glow is a blurred clone of the rings — not elevation-tinted.
    // Skip rim rebuild mid-morph — sunrise/sunset lerps made the bottom flash.
    if (!skipHorizonGlow) {
      this._updateHorizonGlow(elev, glowLook);
    }
    this._updateOverrideArc(this._clockStickySeconds);
    this._updateLightNameBrightness(seconds);
  },

  _layoutClockEventDots() {
    const core = this._clockSunEl?.parentElement;
    const dots = this._clockEventDotEls;
    if (!core || !dots?.length) {
      return;
    }
    const w = core.clientWidth;
    if (w < 8) {
      return;
    }
    // 6px screen diameter, independent of dial size.
    const r = (3 / w) * CLOCK_VIEW;
    for (const dot of dots) {
      dot.setAttribute("r", r.toFixed(3));
    }
  },

  _clockFacePctToCore(faceXPct, faceYPct, faceW, coreW, chrome) {
    const faceX = (faceXPct / 100) * faceW;
    const faceY = (faceYPct / 100) * faceW;
    return {
      x: ((faceX - chrome) / coreW) * CLOCK_VIEW,
      y: ((faceY - chrome) / coreW) * CLOCK_VIEW,
    };
  },

  _clockEventAnchorRadius(eventId, { ghost = false } = {}) {
    const hit = (this._clockEventAnchors || []).find(
      (anchor) =>
        anchor.dataset.eventId === eventId &&
        anchor.classList.contains("ghost") === ghost
    );
    if (hit?._clockIconR != null) {
      return hit._clockIconR;
    }
    return this._clockEventIconR;
  },

  _shownEventBrightness(eventId) {
    const shown = this._clockBrightShown?.[eventId];
    if (shown != null && Number.isFinite(shown)) {
      return shown;
    }
    return this._dialEventBrightness(eventId);
  },

  _clockBrightPct(bri) {
    return Math.round((Number(bri) / 255) * 100);
  },

  _clockBrightValuesEqual(a, b) {
    const ids = new Set([
      ...Object.keys(a || {}),
      ...Object.keys(b || {}),
    ]);
    for (const id of ids) {
      if (Math.abs((a?.[id] ?? 0) - (b?.[id] ?? 0)) > 0.5) {
        return false;
      }
    }
    return true;
  },

  _paintClockEventAnchorCopy(anchor, event, bri) {
    const timeText = event.fallback ? `${event.time}*` : event.time;
    const pct = this._clockBrightPct(bri);
    const heading = anchor.querySelector(".clock-event-heading");
    if (heading) {
      heading.textContent = `${event.name} · ${timeText}`;
    }
    const brightEl = anchor.querySelector(".clock-event-bright");
    if (brightEl) {
      brightEl.textContent = this._t(
        "frontend.clock.event_bright_pct",
        "{percent}%",
        { percent: pct }
      );
    }
    const btn = anchor.querySelector(".clock-event");
    if (!btn) {
      return;
    }
    const solarHint =
      event.overridden && event.solar_time
        ? ` (solar ${event.solar_time})`
        : "";
    btn.title = `${event.name} · ${timeText}${solarHint} · ${pct}%`;
    const nameTime = heading?.textContent || `${event.name} ${timeText}`;
    btn.setAttribute(
      "aria-label",
      this._t(
        "frontend.clock.event_brightness",
        "{label}, brightness {percent}%",
        { label: nameTime, percent: pct }
      )
    );
  },

  _placeClockBrightnessHandles() {
    const anchors = this._clockEventAnchors || [];
    const r0 = this._clockBrightR0;
    const r1 = this._clockBrightR1;
    if (!anchors.length || r0 == null || r1 == null) {
      return;
    }
    for (const anchor of anchors) {
      const { cos, sin } = anchor._clockPolar || {};
      if (cos == null || sin == null) {
        continue;
      }
      const bri = this._shownEventBrightness(anchor.dataset.eventId);
      const iconR = r1 > r0 ? r0 + (bri / 255) * (r1 - r0) : r0;
      anchor._clockIconR = iconR;
      anchor.style.left = `${50 + cos * iconR}%`;
      anchor.style.top = `${50 + sin * iconR}%`;
      if (anchor.classList.contains("ghost")) {
        continue;
      }
      const event = (this._sunPath?.events || []).find(
        (item) => item.id === anchor.dataset.eventId
      );
      if (event) {
        this._paintClockEventAnchorCopy(anchor, event, bri);
      }
    }
  },

  _layoutClockBrightnessCurve() {
    const fill = this._clockBrightnessFillEl;
    const stroke = this._clockBrightnessArcEl;
    const grad = this._clockBrightnessGradEl;
    const r0 = this._clockBrightR0;
    const r1 = this._clockBrightR1;
    if (!fill || !stroke || !grad || r0 == null || r1 == null) {
      return;
    }
    const events = this._sunPath?.events || [];
    const knots = [];
    for (const event of events) {
      const seconds = this._eventButtonSeconds(event);
      if (seconds == null) {
        continue;
      }
      knots.push({
        seconds,
        bri: this._shownEventBrightness(event.id),
      });
    }
    if (knots.length < 2 || !(r1 > r0)) {
      fill.setAttribute("d", "");
      stroke.setAttribute("d", "");
      this._layoutClockThemeBrightDots();
      return;
    }
    grad.setAttribute("r", String(r1));
    while (grad.firstChild) {
      grad.removeChild(grad.firstChild);
    }
    const lightMode = !this.hasAttribute("data-dark-mode");
    const mk = (offset, opacity) => {
      const stop = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "stop"
      );
      stop.setAttribute("offset", offset);
      stop.setAttribute("stop-color", lightMode ? "#000" : "#fff");
      stop.setAttribute("stop-opacity", String(opacity));
      grad.appendChild(stop);
    };
    const innerPct = (r0 / r1) * 100;
    // Light mode: gray near 0% (path) so the annulus reads on a pale sky;
    // 100% is transparent. Dark mode: white wash that strengthens outward.
    if (lightMode) {
      mk("0%", 0);
      mk(`${innerPct.toFixed(2)}%`, 0.05);
      mk("100%", 0);
    } else {
      mk("0%", 0);
      mk(`${innerPct.toFixed(2)}%`, 0);
      mk(`${Math.min(100, innerPct + (100 - innerPct) * 0.55).toFixed(2)}%`, 0.035);
      mk("100%", 0.08);
    }
    const polar = (seconds, radius) => {
      const deg = this._clockAngleDeg(seconds);
      const rad = ((deg - 90) * Math.PI) / 180;
      return {
        x: 50 + Math.cos(rad) * radius,
        y: 50 + Math.sin(rad) * radius,
      };
    };
    const radiusOf = (bri) => r0 + (bri / 255) * (r1 - r0);
    const strokeD = polarEaseClosedPathD(knots, (seconds, bri) =>
      polar(seconds, radiusOf(bri))
    );
    const innerCircle = `M ${(50 + r0).toFixed(2)} 50 A ${r0.toFixed(2)} ${r0.toFixed(
      2
    )} 0 1 0 ${(50 - r0).toFixed(2)} 50 A ${r0.toFixed(2)} ${r0.toFixed(
      2
    )} 0 1 0 ${(50 + r0).toFixed(2)} 50`;
    stroke.setAttribute("d", strokeD);
    fill.setAttribute("fill-rule", "evenodd");
    fill.setAttribute("d", `${strokeD} ${innerCircle}`);
    this._layoutClockThemeBrightDots();
  },

  _layoutClockThemeBrightDots() {
    const host = this._clockThemeBrightDotsEl;
    const r0 = this._clockBrightR0;
    const r1 = this._clockBrightR1;
    if (!host) {
      return;
    }
    host.replaceChildren();
    const lightId = this._dialBrightnessLightId();
    if (!lightId || r0 == null || !(r1 > r0)) {
      return;
    }
    for (const event of this._sunPath?.events || []) {
      const seconds = this._eventButtonSeconds(event);
      if (seconds == null) {
        continue;
      }
      const themeBri = this._themeEventBrightness(event.id);
      const shown = this._shownEventBrightness(event.id);
      if (Math.abs(shown - themeBri) <= THEME_BRIGHTNESS_SNAP) {
        continue;
      }
      const deg = this._clockAngleDeg(seconds);
      const rad = ((deg - 90) * Math.PI) / 180;
      const radius = r0 + (themeBri / 255) * (r1 - r0);
      const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("class", "clock-theme-bright-dot");
      dot.setAttribute("cx", (50 + Math.cos(rad) * radius).toFixed(2));
      dot.setAttribute("cy", (50 + Math.sin(rad) * radius).toFixed(2));
      dot.setAttribute("r", "1.15");
      host.appendChild(dot);
    }
  },

  _layoutClockEventMetas(anchors) {
    if (!anchors?.length) {
      return;
    }
    // Ghosts have no labels — only active buttons compete for placement.
    anchors = anchors.filter((anchor) => !anchor.classList.contains("ghost"));
    if (!anchors.length) {
      return;
    }
    const TOP = -0.4;
    const BOTTOM = 0.4;
    const top = [];
    const bottom = [];
    const left = [];
    const right = [];
    for (const anchor of anchors) {
      const { cos, sin } = anchor._clockPolar || {};
      if (sin == null || cos == null) {
        continue;
      }
      if (sin <= TOP) {
        top.push(anchor);
      } else if (sin >= BOTTOM) {
        bottom.push(anchor);
      } else if (cos < 0) {
        left.push(anchor);
      } else {
        right.push(anchor);
      }
    }
    const setBelow = (anchor, below) => {
      anchor.querySelector(".clock-event-meta")?.classList.toggle("below", below);
    };
    for (const anchor of top) {
      setBelow(anchor, false);
    }
    for (const anchor of bottom) {
      setBelow(anchor, true);
    }
    // Topmost first on each side — that one keeps the label above.
    left.sort((a, b) => a._clockPolar.sin - b._clockPolar.sin);
    right.sort((a, b) => a._clockPolar.sin - b._clockPolar.sin);
    left.forEach((anchor, index) => setBelow(anchor, index !== 0));
    right.forEach((anchor, index) => setBelow(anchor, index !== 0));
  },

  _layoutClockEventSpokes() {
    const spokes = this._clockEventSpokeEls;
    const links = this._clockEventClampLinkEls;
    const face = this._clockFaceEl;
    const core = this._clockSunEl?.parentElement;
    if (!face || !core) {
      return;
    }
    const faceW = face.clientWidth;
    const coreW = core.clientWidth;
    const chrome = parseFloat(
      getComputedStyle(face).getPropertyValue("--clock-chrome")
    );
    if (!(faceW > 8) || !(coreW > 8) || !Number.isFinite(chrome)) {
      return;
    }
    const chromePoint = (seconds, iconR) => {
      const deg = this._clockAngleDeg(seconds);
      const rad = ((deg - 90) * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const faceXPct = 50 + cos * iconR;
      const faceYPct = 50 + sin * iconR;
      return this._clockFacePctToCore(faceXPct, faceYPct, faceW, coreW, chrome);
    };
    const tipRadius = (eventId) => {
      const ghost = (this._clockEventAnchors || []).find(
        (anchor) =>
          anchor.dataset.eventId === eventId &&
          anchor.classList.contains("ghost") &&
          !anchor.hidden
      );
      if (ghost?._clockIconR != null) {
        return ghost._clockIconR;
      }
      return this._clockEventAnchorRadius(eventId);
    };
    for (const spoke of spokes || []) {
      const id = spoke.dataset.eventId;
      const event = (this._sunPath?.events || []).find((item) => item.id === id);
      const markSeconds = this._eventMarkSeconds(event);
      const iconR = tipRadius(id);
      if (markSeconds == null || iconR == null) {
        continue;
      }
      // Spoke aims at true-solar chrome (ghost when overridden, else button).
      const tip = chromePoint(markSeconds, iconR);
      spoke.setAttribute("x1", tip.x.toFixed(2));
      spoke.setAttribute("y1", tip.y.toFixed(2));
    }
    for (const link of links || []) {
      const id = link.dataset.eventId;
      const event = (this._sunPath?.events || []).find((item) => item.id === id);
      const markSeconds = this._eventMarkSeconds(event);
      const buttonSeconds = this._eventButtonSeconds(event);
      const fromR = this._clockEventAnchorRadius(id, { ghost: true });
      const toR = this._clockEventAnchorRadius(id);
      if (markSeconds == null || buttonSeconds == null || fromR == null || toR == null) {
        continue;
      }
      const from = chromePoint(markSeconds, fromR);
      const to = chromePoint(buttonSeconds, toR);
      const delta = this._shortestSecondsDelta(markSeconds, buttonSeconds);
      const absSpan = Math.abs(delta);
      if (absSpan < 30) {
        link.setAttribute("d", "");
        continue;
      }
      if (Math.abs(fromR - toR) >= 0.2) {
        link.setAttribute(
          "d",
          `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} L ${to.x.toFixed(2)} ${to.y.toFixed(2)}`
        );
        continue;
      }
      const r = Math.hypot(from.x - CLOCK_CX, from.y - CLOCK_CY);
      if (!(r > 1)) {
        continue;
      }
      const large = absSpan / SECONDS_PER_DAY > 0.5 ? 1 : 0;
      const sweep = delta >= 0 ? 1 : 0;
      link.setAttribute(
        "d",
        `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${large} ${sweep} ${to.x.toFixed(2)} ${to.y.toFixed(2)}`
      );
    }
  },

  _paintClockHandle(overlay) {
    const handleInner = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line"
    );
    handleInner.setAttribute("class", "clock-handle");
    handleInner.setAttribute("vector-effect", "non-scaling-stroke");
    handleInner.setAttribute("stroke-width", "1.5px");
    const handleOuter = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line"
    );
    handleOuter.setAttribute("class", "clock-handle");
    handleOuter.setAttribute("vector-effect", "non-scaling-stroke");
    handleOuter.setAttribute("stroke-width", "1.5px");
    overlay.append(handleInner, handleOuter);
    this._clockHandleInnerEl = handleInner;
    this._clockHandleOuterEl = handleOuter;
  },

  _clearClockBackgrounds({ keepOverlay = false } = {}) {
    for (const node of this.shadowRoot?.querySelectorAll(".clock-horizon-back") || []) {
      // Outgoing pixels belong to their exit layer until its animation finishes.
      // All other skies belong to the current dial and must not survive a rebuild.
      if (keepOverlay && this._outgoingStageLayer?.contains(node)) continue;
      node.remove();
    }
  },

  _forgetClockDom({ keepOverlay = false } = {}) {
    this._clearClockBackgrounds({ keepOverlay });
    if (this._clockOutsideClick) {
      this.shadowRoot?.removeEventListener("click", this._clockOutsideClick);
      this._clockOutsideClick = null;
    }
    this._clockResizeObserver?.disconnect();
    this._clockResizeObserver = undefined;
    this._clockRingsHost = undefined;
    this._clockOverlayEl = undefined;
    this._clockGlowLayer = undefined;
    this._layoutDialChromeFn = undefined;
    if (!keepOverlay) {
      if (!this._sharedEditorShell?.lights.contains(this._clockLegendEl)) this._dropClockLegends();
    }
    this._clockHorizonBackEl = undefined;
    this._clockFaceEl = undefined;
    this._clockLegendEl = undefined;
    this._clockBrightnessGradEl = undefined;
    this._clockBrightnessFillEl = undefined;
    this._clockBrightnessArcEl = undefined;
    this._clockThemeBrightDotsEl = undefined;
    this._cancelClockBrightMotion();
    this._clockBrightShown = {};
    this._clockBrightTarget = {};
    this._clockBrightFrom = {};
    // A new legend is a flat list. A matching signature must not skip grouping it.
    this._legendGroupSignature = "";
  },

  _patchLightClock(payload, { morphing = false } = {}) {
    const ringsHost = this._clockRingsHost;
    const overlay = this._clockOverlayEl;
    if (
      !ringsHost?.isConnected ||
      !overlay?.isConnected ||
      !payload?.events
    ) {
      return false;
    }
    const ringLights = this._clockRingLights(payload.lights || []);
    const rings = [...ringsHost.querySelectorAll(":scope > .clock-ring")];
    if (rings.length !== ringLights.length) {
      return false;
    }
    const legendLights = this._legendLights(payload.lights || []);
    const legendRows = [
      ...(this._clockLegendEl?.querySelectorAll(
        ".simple-light-selector:not(.add-light-tile):not(.select-all-tile)"
      ) || []),
    ];
    if (legendRows.length !== legendLights.length) {
      return false;
    }
    const legendById = new Map(
      legendRows.map((row) => [row.dataset.entityId, row])
    );
    if (legendById.size !== legendLights.length) {
      return false;
    }
    for (const light of legendLights) {
      const row = legendById.get(light.entity_id);
      if (!row) {
        return false;
      }
      if (row.classList.contains("suggested") !== Boolean(light.suggested)) {
        return false;
      }
      if (
        row.classList.contains("removed") !==
        Boolean(light.removed || light.suggested)
      ) {
        return false;
      }
    }
    if (this._lightNameLabels?.length) {
      const byId = new Map(
        legendLights.map((item) => [item.entity_id, item])
      );
      for (const entry of this._lightNameLabels) {
        const next = byId.get(entry.light?.entity_id);
        if (next) {
          entry.light = next;
        }
      }
    }
    for (let index = 0; index < rings.length; index += 1) {
      if (rings[index].dataset.entityId !== ringLights[index].entity_id) {
        return false;
      }
    }
    for (let index = 0; index < rings.length; index += 1) {
      const bg = conicGradientFromSamples(ringLights[index].samples || []);
      const fill = rings[index].querySelector(".clock-ring-fill");
      if (fill) {
        fill.style.background = bg;
      }
    }
    // Bloom is two semi-transparent blurred clones of the same conics. Updating
    // them every morph frame doubles the mid-transition chroma under the dial;
    // sync once when morphing finishes.
    if (!morphing) {
      for (const glow of this._clockGlowLayer?.querySelectorAll(
        ":scope > .sun-light-clock-glow"
      ) || []) {
        const glowRings = glow.querySelectorAll(":scope > .clock-ring");
        for (let index = 0; index < glowRings.length; index += 1) {
          const fill = glowRings[index].querySelector(".clock-ring-fill");
          if (fill && ringLights[index]) {
            fill.style.background = conicGradientFromSamples(
              ringLights[index].samples || []
            );
          }
        }
      }
    }
    for (const sel of [
      ".clock-sun-day",
      ".clock-sun-path-night",
      ".clock-event-dot",
      ".clock-event-ray",
      ".clock-event-clamp-link",
    ]) {
      overlay.querySelectorAll(sel).forEach((el) => el.remove());
    }
    this._paintClockSunPath(overlay, payload.events, { includeSun: false });
    if (!morphing) {
      const sky = this._clockHorizonSkyEl;
      if (sky) {
        while (sky.firstChild) {
          sky.removeChild(sky.firstChild);
        }
        this._paintHorizonShadow(sky, payload.events);
      }
    } else {
      // Keep wedge geometry in sync without tear-down (avoids bottom flash).
      this._syncHorizonShadowPaths(payload.events);
    }
    this._syncClockEventAnchorsForScrub(payload.events);
    this._layoutDialChromeFn?.();
    const seconds =
      this._clockStickySeconds ??
      this._clockSunDisplayedSeconds ??
      this._clockSunIdleSeconds();
    if (!morphing) this._placeLegendModeGroups(this._clockLegendEl?.querySelector(".light-tiles"));
    this._applyClockSunAppearance(seconds, { skipHorizonGlow: morphing });
    if (this._hoverReadout) {
      this._fillHoverReadout(seconds, { hovering: false, paintLights: false });
    }
    return true;
  },

  _syncClockEventAnchorsForScrub(events) {
    const anchors = this._clockEventAnchors || [];
    for (const anchor of anchors) {
      const eventId = anchor.dataset.eventId;
      const event = (events || []).find((item) => item.id === eventId);
      if (event == null) {
        continue;
      }
      const isGhost = anchor.classList.contains("ghost");
      const markSeconds = this._eventMarkSeconds(event);
      const buttonSeconds = this._eventButtonSeconds(event);
      const placeSeconds = isGhost ? markSeconds : buttonSeconds;
      if (placeSeconds == null) {
        continue;
      }
      if (isGhost) {
        const show =
          event.overridden &&
          markSeconds != null &&
          buttonSeconds != null &&
          markSeconds !== buttonSeconds;
        anchor.hidden = !show;
        if (!show) {
          continue;
        }
      }
      const deg = this._clockAngleDeg(placeSeconds);
      const rad = ((deg - 90) * Math.PI) / 180;
      anchor._clockPolar = { cos: Math.cos(rad), sin: Math.sin(rad) };
      if (isGhost) {
        const ghostBtn = anchor.querySelector(".clock-event");
        if (ghostBtn) {
          ghostBtn.title = `${event.name} · solar ${event.solar_time || event.time}`;
        }
        continue;
      }
      const timeText = event.fallback ? `${event.time}*` : event.time;
      const heading = anchor.querySelector(".clock-event-heading");
      if (heading) {
        heading.textContent = `${event.name} · ${timeText}`;
      }
      const btn = anchor.querySelector(".clock-event");
      if (btn) {
        const solarHint =
          event.overridden && event.solar_time
            ? ` (solar ${event.solar_time})`
            : "";
        btn.title = `${event.name} · ${timeText}${solarHint}`;
      }
    }
  },

  _dropClockLegends() {
    // The dial legend is appended beside the face, not inside the clock node.
    // Leaving the editor nulls `_clockLegendEl` while the node stays on the sun
    // path, so the next visit used to append a second strip.
    const nodes = new Set(this._clockLegendEl ? [this._clockLegendEl] : []);
    for (const el of this._sunPathEl?.querySelectorAll(
      ":scope > .sun-light-clock-legend"
    ) || []) {
      nodes.add(el);
    }
    for (const el of nodes) {
      el.remove();
    }
    this._clockLegendEl = null;
  },

  _buildLightClock(events) {
    this._clearClockBackgrounds({ keepOverlay: true });
    this._dropClockLegends();
    this._lightNameLabels = [];
    const lights = this._sunPath.lights || [];
    const ringLights = this._clockRingLights(lights);
    const legendLights = this._legendLights(lights);
    const suggested = lights.filter((light) => light.suggested);
    const wrap = document.createElement("div");
    wrap.className = "sun-light-clock";

    const face = document.createElement("div");
    face.className = "sun-light-clock-face";
    face.setAttribute("role", "img");
    face.setAttribute(
      "aria-label",
      "24-hour light rings with sun elevation around the rim; midnight at the bottom"
    );

    // Horizon glow + event shadow sit behind the planet (and outside the core).
    const horizonBack = document.createElement("div");
    horizonBack.className = "clock-horizon-back";
    horizonBack.setAttribute("aria-hidden", "true");
    this._clockHorizonBackEl = horizonBack;
    this._clockFaceEl = face;
    const horizonGlow = document.createElement("div");
    horizonGlow.className = "clock-horizon-glow";
    this._clockHorizonGlowEl = horizonGlow;
    const skyOverlay = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );
    skyOverlay.setAttribute("class", "clock-horizon-sky");
    skyOverlay.setAttribute("viewBox", `0 0 ${CLOCK_VIEW} ${CLOCK_VIEW}`);
    this._paintHorizonShadow(skyOverlay, events);
    horizonBack.append(horizonGlow, skyOverlay);
    this._clockHorizonSkyEl = skyOverlay;

    const core = document.createElement("div");
    core.className = "sun-light-clock-core";

    const ringsHost = document.createElement("div");
    ringsHost.className = "sun-light-clock-rings";
    this._clockRingsHost = ringsHost;
    const n = ringLights.length;
    const hole = 0;
    const usable = 100 - hole;
    const stroke = n ? usable / n : 0;
    // Band edges are the true partitions; --clock-feather bleeds them into
    // neighbors in soft mode and drops to 0% in sharp (hover/selected) mode.
    for (let index = 0; index < n; index += 1) {
      const light = ringLights[index];
      const outer = 100 - index * stroke;
      const inner = Math.max(hole, outer - stroke);
      // --ring-expand / --ring-rim-w grow the hover rim; --clock-feather softens seams.
      const mask = `radial-gradient(farthest-side, transparent calc(var(--ring-inner) - var(--clock-feather) - var(--ring-expand)), #000 calc(var(--ring-inner) + var(--clock-feather) - var(--ring-expand)), #000 calc(var(--ring-outer) - var(--clock-feather) + var(--ring-expand)), transparent calc(var(--ring-outer) + var(--clock-feather) + var(--ring-expand)))`;
      const bg = conicGradientFromSamples(light.samples || []);

      const ring = document.createElement("div");
      ring.className = "clock-ring";
      ring.dataset.entityId = light.entity_id;
      ring.style.setProperty("--ring-inner", `${inner}%`);
      ring.style.setProperty("--ring-outer", `${outer}%`);
      if (this._legendSelectedIds?.has(light.entity_id)) {
        ring.classList.add("selected");
        ring.setAttribute("aria-current", "true");
      }
      const fill = document.createElement("div");
      fill.className = "clock-ring-fill";
      fill.style.background = bg;
      fill.style.webkitMaskImage = mask;
      fill.style.maskImage = mask;
      ring.appendChild(fill);
      const lightName = this._lightDisplayName(light.entity_id, {
        fallback: light.name,
      });
      const capabilities = this._lightSupportsSubtitle(light.entity_id);
      ring.title = capabilities ? `${lightName} · ${capabilities}` : lightName;
      ring.dataset.lightName = lightName;
      ring.dataset.capabilities = capabilities;
      ringsHost.appendChild(ring);
    }
    const hoverName = document.createElement("div");
    hoverName.className = "clock-ring-hover-name";
    hoverName.setAttribute("aria-live", "polite");
    hoverName.hidden = true;
    const hoverTitle = document.createElement("span");
    const hoverCaps = document.createElement("span");
    hoverCaps.className = "clock-ring-hover-caps";
    hoverName.append(hoverTitle, hoverCaps);
    // On the core (not ringsHost — glow clones copy ringsHost). Positioned at
    // the rings inset so the pill sits flush above the outer light ring.
    const setHoveredRing = (entityId) => {
      let label = "";
      let capabilities = "";
      for (const ring of ringsHost.querySelectorAll(".clock-ring")) {
        const on =
          Boolean(entityId) && ring.dataset.entityId === entityId;
        ring.classList.toggle("hovered", on);
        if (on) {
          label = ring.dataset.lightName || "";
          capabilities = ring.dataset.capabilities || "";
        }
      }
      if (label) {
        if (hoverTitle.textContent !== label) hoverTitle.textContent = label;
        if (hoverCaps.textContent !== capabilities) hoverCaps.textContent = capabilities ? `· ${capabilities}` : "";
        hoverName.hidden = false;
      } else {
        hoverName.hidden = true;
      }
    };
    const updateRingHover = (ev) => {
      // Block page scroll while a finger/pen scrubs across the planet.
      if (ev.cancelable && (ev.pointerType === "touch" || ev.pointerType === "pen")) {
        ev.preventDefault();
      }
      const light = this._lightAtClockPointer(ev, ringsHost, ringLights);
      setHoveredRing(light?.entity_id || null);
    };
    // Touch/pen: open on release (click is unreliable after preventDefault).
    let suppressRingClick = false;
    ringsHost.addEventListener("pointerdown", (ev) => {
      // Touch has no hover: capture so move events keep updating the band.
      if (ev.pointerType === "touch" || ev.pointerType === "pen") {
        if (ev.cancelable) {
          ev.preventDefault();
        }
        try {
          ringsHost.setPointerCapture(ev.pointerId);
        } catch (_err) {
          /* capture optional */
        }
      }
      updateRingHover(ev);
    });
    ringsHost.addEventListener("pointermove", updateRingHover);
    ringsHost.addEventListener("pointerup", (ev) => {
      if (ev.pointerType === "touch" || ev.pointerType === "pen") {
        const light = this._lightAtClockPointer(ev, ringsHost, ringLights);
        if (light) {
          openRingAt(ev, light);
          suppressRingClick = true;
        }
        setHoveredRing(null);
        if (ringsHost.hasPointerCapture?.(ev.pointerId)) {
          try {
            ringsHost.releasePointerCapture(ev.pointerId);
          } catch (_err) {
            /* optional */
          }
        }
      }
    });
    ringsHost.addEventListener("pointercancel", (ev) => {
      setHoveredRing(null);
      if (
        (ev.pointerType === "touch" || ev.pointerType === "pen") &&
        ringsHost.hasPointerCapture?.(ev.pointerId)
      ) {
        try {
          ringsHost.releasePointerCapture(ev.pointerId);
        } catch (_err) {
          /* optional */
        }
      }
    });
    ringsHost.addEventListener("pointerleave", (ev) => {
      // With capture, leave can fire mid-drag; only clear when not captured.
      if (ringsHost.hasPointerCapture?.(ev.pointerId)) {
        return;
      }
      setHoveredRing(null);
    });
    // Non-passive touchmove so preventDefault can block scroll. Once the
    // browser has committed to scrolling, the event is not cancelable.
    ringsHost.addEventListener(
      "touchmove",
      (ev) => {
        if (ev.cancelable) {
          ev.preventDefault();
        }
      },
      { passive: false }
    );
    const openRingAt = (ev, light) => {
      if (!light) {
        return;
      }
      if (this._view === "edit") {
        this._selectCircadianLight(light.entity_id, ev);
        return;
      }
      const seconds =
        this._clockSunDisplayedSeconds ??
        this._clockStickySeconds ??
        this._clockSunIdleSeconds();
      if (this._view === "theme") {
        const closest = this._closestEvent(events, seconds);
        if (closest) {
          this._openThemeEventSidebar(closest);
        }
        return;
      }

    };
    ringsHost.addEventListener("click", (ev) => {
      // Always stop: planet clicks must not hit the outside-deselect listener.
      ev.stopPropagation();
      if (suppressRingClick) {
        suppressRingClick = false;
        return;
      }
      openRingAt(ev, this._lightAtClockPointer(ev, ringsHost, ringLights));
    });
    ringsHost.tabIndex = 0;
    ringsHost.setAttribute("role", "listbox");
    ringsHost.setAttribute("aria-label", "Light rings");
    ringsHost.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" && ev.key !== " ") {
        return;
      }
      ev.preventDefault();
      const selected =
        ringLights.find((light) => light.entity_id === this._sidebarLightId) ||
        ringLights[0];
      openRingAt(ev, selected);
    });
    // Click outside the rings (and outside light-pickers / the sidebar)
    // clears the selection by closing the light editor.
    if (this._clockOutsideClick) {
      this.shadowRoot?.removeEventListener("click", this._clockOutsideClick);
    }
    this._clockOutsideClick = (ev) => {
      const t = ev.target;
      if (!(t instanceof Element)) {
        return;
      }
      if (
        t.closest(
          ".scene-sidebar, .sun-light-clock-rings, .simple-light-selector, .light-mode-label, .clock-event, .sun-event, .gm, .hue-wheel-chrome, .simple-level-host, .var-palette, .hue-presets, ha-dialog, ha-dropdown"
        )
      ) {
        return;
      }
      if (this._sidebarLightId) {
        this._requestCloseSceneSidebar();
        return;
      }
      if (this._legendSelectedIds?.size) {
        this._legendSelectedIds = new Set();
        this._syncClockLightSelection();
        revealLightActionsNow(this.shadowRoot);
      }
    };
    this.shadowRoot.addEventListener("click", this._clockOutsideClick);
    // Soft bloom clones behind the interactive rings — same conic colors as the
    // planet (not elevation sky). Large + half-size layers share opacity.
    // Face-level layer (not inside core) so bloom paints over the horizon wash.
    const makeGlow = (mod) => {
      const glow = ringsHost.cloneNode(true);
      glow.className = `sun-light-clock-glow ${mod}`;
      glow.removeAttribute("tabindex");
      glow.removeAttribute("role");
      glow.removeAttribute("aria-label");
      glow.setAttribute("aria-hidden", "true");
      for (const ring of glow.querySelectorAll(".clock-ring")) {
        ring.classList.remove("selected", "hovered");
        ring.removeAttribute("aria-current");
        ring.removeAttribute("title");
      }
      return glow;
    };
    const glowLayer = document.createElement("div");
    glowLayer.className = "sun-light-clock-glow-layer";
    glowLayer.setAttribute("aria-hidden", "true");
    const glowLg = makeGlow("glow-lg");
    const glowMd = makeGlow("glow-md");
    glowLayer.append(glowLg, glowMd);
    this._clockSkyGlow = glowLg;
    this._clockGlowLayer = glowLayer;
    core.append(ringsHost, hoverName);

    const overlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    overlay.setAttribute("class", "sun-light-clock-overlay");
    overlay.setAttribute("viewBox", `0 0 ${CLOCK_VIEW} ${CLOCK_VIEW}`);
    overlay.setAttribute("aria-hidden", "true");
    this._clockOverlayEl = overlay;
    const cx = CLOCK_CX;
    const cy = CLOCK_CY;
    // Hour ticks + numbers live on the face (outer chrome). Core overlay is
    // path / sun / handle only.
    const hourLabels = [];
    const faceTicks = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );
    faceTicks.setAttribute("class", "clock-face-ticks");
    faceTicks.setAttribute("viewBox", `0 0 ${CLOCK_VIEW} ${CLOCK_VIEW}`);
    faceTicks.setAttribute("aria-hidden", "true");
    const faceTickLines = [];
    for (let hour = 0; hour < 24; hour += 1) {
      const seconds = hour * 3600;
      const deg = this._clockAngleDeg(seconds);
      const rad = ((deg - 90) * Math.PI) / 180;
      const major = hour % 6 === 0;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      if (!major) {
        const tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
        tick.setAttribute("class", "clock-tick");
        faceTicks.appendChild(tick);
        faceTickLines.push({
          el: tick,
          cos,
          sin,
          len: CLOCK_TICK_MINOR_LEN,
        });
      } else {
        const label = document.createElement("div");
        label.className = "clock-hour-label";
        label.textContent = hour === 0 ? "24" : String(hour).padStart(2, "0");
        label._clockPolar = { cos, sin };
        hourLabels.push(label);
      }
    }
    this._paintClockSunPath(overlay, events);
    this._ensureOverrideArc(overlay);

    const handleOverlay = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );
    handleOverlay.setAttribute("class", "sun-light-clock-handle-overlay");
    handleOverlay.setAttribute("viewBox", `0 0 ${CLOCK_VIEW} ${CLOCK_VIEW}`);
    handleOverlay.setAttribute("aria-hidden", "true");
    this._paintClockHandle(handleOverlay);

    const handleHit = document.createElement("div");
    handleHit.className = "clock-handle-hit";
    handleHit.setAttribute("aria-hidden", "true");
    this._clockHandleHitEl = handleHit;
    // Path under sun; rings above handle so the planet occludes it.
    core.append(
      overlay,
      this._clockSunEl,
      handleOverlay,
      this._clockSunHitEl,
      handleHit
    );
    // Horizon → light bloom → planet; face ticks under event buttons / labels.
    face.append(horizonBack, glowLayer, core, faceTicks);

    const editable = this._view === "edit" || this._view === "theme";
    const hadTheme = Boolean(this._themeDraft);
    void this._ensureThemeDraft().then((ok) => {
      if (!ok || hadTheme || !this.isConnected) {
        return;
      }
      if (this._view !== "edit" || this._formData?.kind === "simple") {
        return;
      }
      this._patchDialFromSession({ applyTheme: true });
    });
    const eventLayer = document.createElement("div");
    eventLayer.className = "clock-event-layer";
    const briSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    briSvg.setAttribute("class", "clock-brightness-overlay");
    briSvg.setAttribute("viewBox", "0 0 100 100");
    briSvg.setAttribute("aria-hidden", "true");
    const briDefs = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "defs"
    );
    const briGrad = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "radialGradient"
    );
    briGrad.setAttribute("id", "clock-brightness-glow-grad");
    briGrad.setAttribute("gradientUnits", "userSpaceOnUse");
    briGrad.setAttribute("cx", "50");
    briGrad.setAttribute("cy", "50");
    briGrad.setAttribute("r", "50");
    briDefs.appendChild(briGrad);
    const briFill = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );
    briFill.setAttribute("class", "clock-brightness-fill");
    briFill.setAttribute("fill", "url(#clock-brightness-glow-grad)");
    const briArc = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );
    briArc.setAttribute("class", "clock-brightness-arc");
    briArc.setAttribute("vector-effect", "non-scaling-stroke");
    const briThemeDots = document.createElementNS("http://www.w3.org/2000/svg", "g");
    briThemeDots.setAttribute("class", "clock-theme-bright-dots");
    briSvg.append(briDefs, briFill, briArc, briThemeDots);
    eventLayer.appendChild(briSvg);
    this._clockBrightnessGradEl = briGrad;
    this._clockBrightnessFillEl = briFill;
    this._clockBrightnessArcEl = briArc;
    this._clockThemeBrightDotsEl = briThemeDots;
    const eventAnchors = [];
    const polarForSeconds = (seconds) => {
      const deg = this._clockAngleDeg(seconds);
      const rad = ((deg - 90) * Math.PI) / 180;
      return { cos: Math.cos(rad), sin: Math.sin(rad) };
    };
    for (const event of events) {
      const buttonSeconds = this._eventButtonSeconds(event);
      const markSeconds = this._eventMarkSeconds(event);
      if (buttonSeconds == null) {
        continue;
      }
      const { cos, sin } = polarForSeconds(buttonSeconds);
      const timeText = event.fallback ? `${event.time}*` : event.time;

      const anchor = document.createElement("div");
      anchor.className = "clock-event-anchor";
      anchor.dataset.eventId = event.id;
      anchor._clockPolar = { cos, sin };

      const meta = document.createElement("div");
      meta.className = "clock-event-meta";
      meta.setAttribute("aria-hidden", "true");
      const heading = document.createElement("span");
      heading.className = "clock-event-heading";
      heading.textContent = `${event.name} · ${timeText}`;
      const brightEl = document.createElement("span");
      brightEl.className = "clock-event-bright";
      meta.append(heading, brightEl);

      const btn = document.createElement(editable ? "button" : "div");
      btn.className = "clock-event";
      if (editable) {
        btn.type = "button";
        btn.dataset.eventId = event.id;
      }
      const solarHint =
        event.overridden && event.solar_time
          ? ` (solar ${event.solar_time})`
          : "";
      btn.title = `${event.name} · ${timeText}${solarHint}`;
      if (this._sidebarEventId === event.id) {
        btn.classList.add("selected");
        btn.setAttribute("aria-current", "true");
      }
      const icon = document.createElement("ha-icon");
      icon.setAttribute("icon", event.icon);
      btn.appendChild(icon);
      if (editable) {
        btn.setAttribute("aria-label", `${event.name} ${timeText}`);
        btn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          if (this._clockEventSuppressClick) {
            this._clockEventSuppressClick = false;
            return;
          }
          this._toggleEventSceneDialog(event);
        });
        this._bindClockEventBrightnessDrag(btn, event, anchor);
      }
      anchor.append(meta, btn);
      eventLayer.appendChild(anchor);
      eventAnchors.push(anchor);

      if (
        event.overridden &&
        markSeconds != null &&
        markSeconds !== buttonSeconds
      ) {
        const ghostPolar = polarForSeconds(markSeconds);
        const ghost = document.createElement("div");
        ghost.className = "clock-event-anchor ghost";
        ghost.dataset.eventId = event.id;
        ghost._clockPolar = ghostPolar;
        ghost.setAttribute("aria-hidden", "true");
        const ghostBtn = document.createElement("div");
        ghostBtn.className = "clock-event ghost";
        ghostBtn.title = `${event.name} · solar ${event.solar_time || timeText}`;
        const ghostIcon = document.createElement("ha-icon");
        ghostIcon.setAttribute("icon", event.icon);
        ghostBtn.appendChild(ghostIcon);
        ghost.appendChild(ghostBtn);
        eventLayer.appendChild(ghost);
        eventAnchors.push(ghost);
      }
    }
    // Hour labels on the face (above event anchors in paint order).
    face.appendChild(eventLayer);
    for (const label of hourLabels) {
      face.appendChild(label);
    }

    const layoutEventAnchors = () => {
      const w = face.clientWidth;
      if (!w) {
        return;
      }
      // Cardinal numerals sit on the old 6h tick tips (near the face edge).
      // Size follows the face so widths between phone and desktop are not a step.
      const labelFontPx = Math.round(w * 0.08);
      face.style.setProperty("--clock-hour-size", `${labelFontPx}px`);
      // Brightness 0% is the sun path. 100% is a shorter span on a smaller face
      // (half of 92px on a phone dial, three quarters on a desktop dial) so the
      // core can use the space the span used to reserve.
      const gapT = Math.min(1, Math.max(0, (w - 360) / (800 - 360)));
      const eventGap = CLOCK_EVENT_GAP_FROM_PATH_PX * (0.5 + 0.25 * gapT);
      const tickOuterPad = w >= 871 ? 10 : 6;
      const labelPad =
        tickOuterPad + labelFontPx * 0.42 - CLOCK_HOUR_LABEL_OUTSET_PX;
      const narrowFace = window.matchMedia("(max-width: 870px)").matches;
      const chromeFloor = Math.ceil(tickOuterPad + labelFontPx * 0.42 + 4);
      let chromePx = chromeFloor;
      const pathR = this._clockSunPathRadius();
      const pathFrac = pathR / 100;
      const half = w / 2;
      const btnClear = CLOCK_EVENT_BTN_PX / 2 + 2;
      const outerNeed = eventGap + btnClear;
      if (pathFrac > 0 && half > outerNeed) {
        const chromeForBri = Math.ceil(half - (half - outerNeed) / pathFrac);
        const maxChrome = Math.max(0, Math.floor((w - 80) / 2));
        chromePx = Math.min(Math.max(chromePx, chromeForBri), maxChrome);
      }
      face.style.setProperty("--clock-chrome", `${chromePx}px`);
      // Derive core size from chrome (do not wait for a second layout pass).
      const coreW = w - 2 * chromePx;
      if (coreW < 8) {
        return;
      }
      // Face SVG viewBox radius 100 ≡ half the face; pad → viewBox r.
      const tickOuterR = 100 * (1 - (2 * tickOuterPad) / w);
      for (const tick of faceTickLines) {
        const outer = tickOuterR;
        const len = narrowFace
          ? CLOCK_TICK_MINOR_LEN
          : CLOCK_TICK_MINOR_LEN * 1.75;
        const inner = tickOuterR - len;
        tick.el.setAttribute("x1", (cx + tick.cos * inner).toFixed(2));
        tick.el.setAttribute("y1", (cy + tick.sin * inner).toFixed(2));
        tick.el.setAttribute("x2", (cx + tick.cos * outer).toFixed(2));
        tick.el.setAttribute("y2", (cy + tick.sin * outer).toFixed(2));
      }
      const labelR = ((w / 2 - labelPad) / w) * 100;
      for (const label of hourLabels) {
        const { cos, sin } = label._clockPolar;
        label.style.left = `${50 + cos * labelR}%`;
        label.style.top = `${50 + sin * labelR}%`;
      }
      const pathPx = pathFrac * (coreW / 2);
      let r1Px = pathPx + eventGap;
      if (r1Px + btnClear > half) {
        r1Px = half - btnClear;
      }
      if (r1Px < pathPx) {
        r1Px = pathPx;
      }
      const r0 = (pathPx / w) * 100;
      const r1 = (r1Px / w) * 100;
      this._clockBrightR0 = r0;
      this._clockBrightR1 = r1;
      this._clockEventIconR = r1;
      const targets = {};
      for (const event of this._sunPath?.events || []) {
        if (this._eventButtonSeconds(event) == null) {
          continue;
        }
        targets[event.id] = this._dialEventBrightness(event.id);
      }
      this._syncClockBrightMotion(targets);
      this._placeClockBrightnessHandles();
      // Override arc/glow on the outer tip of the face hour ticks, in core space.
      const tickOuterPx = (tickOuterR / 100) * (w / 2);
      const overrideR = (tickOuterPx / (coreW / 2)) * 100;
      this._clockOverrideR = overrideR;
      if (this._clockOverrideGlowEl) {
        this._clockOverrideGlowEl.setAttribute("r", String(overrideR));
      }
      this._updateOverrideArc(this._clockStickySeconds);
      this._layoutClockEventMetas(eventAnchors);
      this._layoutClockEventSpokes();
      this._layoutClockBrightnessCurve();
    };
    this._clockEventAnchors = eventAnchors;
    this._layoutDialChromeFn = () => {
      layoutEventAnchors();
      this._layoutClockEventDots();
      this._layoutClockHorizonBack();
      this._alignYearScrubRail();
    };
    layoutEventAnchors();
    const layoutDialChrome = () => {
      this._layoutDialChromeFn?.();
    };
    layoutDialChrome();
    this._clockResizeObserver?.disconnect();
    if (typeof ResizeObserver === "function") {
      this._clockResizeObserver = new ResizeObserver(() => {
        layoutDialChrome();
      });
      this._clockResizeObserver.observe(face);
    }
    requestAnimationFrame(() => layoutDialChrome());

    this._bindClockSunDrag(face, [this._clockSunHitEl, this._clockHandleHitEl]);
    // Enter when arriving from a non-dial surface. Dial→dial skips it.
    // Optimistic paint from the list sun_path has no lights — do not consume
    // the enter flag there; preview rebuild (with rings) should still animate.
    const optimisticListCurve =
      !ringLights.length ||
      String(this._sunPathKey || "").startsWith("list-sun:");
    if (this._clockEnterPlayed || optimisticListCurve) {
      this._applyClockSunAppearance(this._clockSunIdleSeconds());
    } else {
      this._clockEnterPlayed = true;
      this._playClockEnterAnimation(face);
    }
    wrap.appendChild(face);

    if (!ringLights.length && this._view !== "theme") {
      const hint = document.createElement("p");
      hint.className = "sun-light-clock-empty-hint";
      hint.textContent = suggested.length
        ? "Create a native scene from a solar event to fill the dial — area lights are listed below."
        : "No lights in this area yet.";
      wrap.appendChild(hint);
    }

    const legend = document.createElement("div");
    legend.className = "sun-light-clock-legend";
    const scroller = document.createElement("div");
    scroller.className = "light-tiles-scroller";
    const tiles = document.createElement("div");
    tiles.className = "light-tiles";
    for (const light of legendLights) {
      tiles.appendChild(this._clockLegendRow(light, events));
    }
    if (this._view === "edit") {
      tiles.appendChild(
        createAddLightTile({
          label: this._t("frontend.lights.add_light", "Add light"),
          onActivate: (anchor) => this._openAddLightPicker(anchor),
        })
      );
    }
    if (this._view === "edit" && legendLights.filter(light => !light.removed && !light.suggested).length > 1) tiles.prepend(this._createCircadianSelectAll());
    this._placeLegendModeGroups(tiles);
    if (tiles.childElementCount) {
      scroller.appendChild(tiles);
      bindGroupTitleStick(scroller);
      legend.append(
        scroller,
        createLightTilesHint(
          this._t(
            "frontend.lights.tiles_hint_pick",
            "Select a solar event or a light to edit it, or drag the sun to preview the lights at a point in time"
          )
        )
      );
      this._clockLegendEl = legend;
      this._syncClockLegendBrightEdit();
    } else {
      this._clockLegendEl = null;
    }
    return wrap;
  }
};
