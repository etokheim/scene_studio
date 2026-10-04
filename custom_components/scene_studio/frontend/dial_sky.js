import { beginSvgFrame } from "./dial_svg_frame.js";
/* dial sky owns these panel methods.
 * The receiver is the panel: navigation, rendering and saving remain host hooks.
 * Keep closures bound to that receiver; do not bind methods to a separate object. */
import {
  SECONDS_PER_DAY,
  CLOCK_VIEW,
  CLOCK_CX,
  CLOCK_CY,
  CLOCK_RINGS_OUTER,
  CLOCK_SUN_PATH_PAD,
  CLOCK_SUN_PATH_WIDTH_PX,
  CLOCK_SKY_R,
  CLOCK_DAY_SKY_LIGHT,
  CLOCK_SUN_R_VIEW,
  CLOCK_SUN_SCALE_MAX,
  CLOCK_TICK_OUTER,
  CLOCK_OVERRIDE_R,
} from "./panel_constants.js";
import { nowSecondsSinceMidnight } from "./editor_session.js";
import { sunStrokePathRuns, interpolateElevation } from "./dial_clock.js";

export const dialSkyMethods = {
  /** Today's peak elevation from the sun curve (may be ≤0 in polar night). */
  _clockDayPeakElevation() {
    const curve = this._sunPath?.curve;
    if (!curve?.length) {
      return 0;
    }
    let peak = -Infinity;
    for (const [, elev] of curve) {
      peak = Math.max(peak, elev);
    }
    return peak;
  },

  /**
   * Perfect-circle path radius for the preview day: larger in summer (high
   * peak), smaller in winter. Clamped between planet+pad and face−pad so the
   * stroke (and large night sun) clear the dial and the core edge.
   */
  _clockSunPathRadius() {
    const sunClear = CLOCK_SUN_R_VIEW * CLOCK_SUN_SCALE_MAX;
    const rMin = CLOCK_RINGS_OUTER + CLOCK_SUN_PATH_PAD + sunClear;
    // Mobile uses more of the core toward the ticks; brightness 100% sits
    // outside the path in face chrome, not on this radius.
    const narrow =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 870px)").matches;
    const edgeScale = narrow ? 0.97 : 0.9;
    const rMax =
      (CLOCK_VIEW / 2 - CLOCK_SUN_PATH_PAD - sunClear) * edgeScale;
    const lo = Math.min(rMin, rMax);
    const hi = Math.max(rMin, rMax);
    const annual = Math.max(this._sunPath?.max_elevation || 0, 1e-6);
    const dayPeak = this._clockDayPeakElevation();
    const t = Math.min(1, Math.max(0, dayPeak / annual));
    return lo + t * (hi - lo);
  },

  _clockSunPathRadiusOf(_elevation) {
    return this._clockSunPathRadius();
  },

  /** Smallest at daytime zenith; largest at sunrise/sunset; fixed max at night. */
  _clockSunScale(elevation) {
    if (elevation < 0) {
      return CLOCK_SUN_SCALE_MAX;
    }
    const peak = Math.max(this._sunPath?.max_elevation || 0, 1e-6);
    const t = Math.min(1, Math.max(0, elevation / peak));
    return CLOCK_SUN_SCALE_MAX + (1 - CLOCK_SUN_SCALE_MAX) * t;
  },

  _clockSunXy(seconds, elevation) {
    const elev =
      elevation ?? interpolateElevation(this._sunPath?.curve || [], seconds);
    const deg = this._clockAngleDeg(seconds);
    const rad = ((deg - 90) * Math.PI) / 180;
    const r = this._clockSunPathRadiusOf(elev);
    return {
      x: CLOCK_CX + Math.cos(rad) * r,
      y: CLOCK_CY + Math.sin(rad) * r,
      r,
      rad,
      elev,
    };
  },

  _clockPolar(seconds, radius) {
    const deg = this._clockAngleDeg(seconds);
    const rad = ((deg - 90) * Math.PI) / 180;
    return {
      deg,
      rad,
      cos: Math.cos(rad),
      sin: Math.sin(rad),
      x: CLOCK_CX + Math.cos(rad) * radius,
      y: CLOCK_CY + Math.sin(rad) * radius,
    };
  },

  _clockWedgePath(fromSeconds, toSeconds, radius = CLOCK_SKY_R) {
    let span =
      (((toSeconds - fromSeconds) % SECONDS_PER_DAY) + SECONDS_PER_DAY) %
      SECONDS_PER_DAY;
    if (span < 1) {
      span = SECONDS_PER_DAY;
    }
    const start = this._clockPolar(fromSeconds, radius);
    const end = this._clockPolar(fromSeconds + span, radius);
    const large = span / SECONDS_PER_DAY > 0.5 ? 1 : 0;
    return `M ${CLOCK_CX} ${CLOCK_CY} L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`;
  },

  _clockEventSeconds(events, id) {
    const event = (events || []).find((item) => item.id === id);
    return this._eventMarkSeconds(event);
  },

  /** True solar time for path/sky marks (ignores earliest-dusk clamp). */
  _eventMarkSeconds(event) {
    if (!event || event.seconds == null) {
      return null;
    }
    if (event.overridden && event.solar_seconds != null) {
      return event.solar_seconds;
    }
    return event.seconds;
  },

  /** Effective scene time (clamped when earliest-dusk applies). */
  _eventButtonSeconds(event) {
    return event?.seconds != null ? event.seconds : null;
  },

  /** Prefer connected core sun/hit nodes over detached paint leftovers. */
  _ensureLiveClockSunEls() {
    const core =
      this._clockFaceEl?.querySelector(".sun-light-clock-core") ||
      this._clockSunEl?.parentElement;
    if (!core) {
      return;
    }
    if (!this._clockSunEl?.isConnected) {
      const live = core.querySelector(":scope > .clock-sun");
      if (live) {
        this._clockSunEl = live;
      }
    }
    if (!this._clockSunHitEl?.isConnected) {
      const liveHit = core.querySelector(":scope > .clock-sun-hit");
      if (liveHit) {
        this._clockSunHitEl = liveHit;
      }
    }
    if (!this._clockSunFillEl?.isConnected) {
      const liveFill = this._clockOverlayEl?.querySelector(
        ".clock-sun-day-group .clock-sun-fill"
      );
      if (liveFill) {
        const group = liveFill.parentElement;
        this._clockSunFillEl = liveFill;
        this._clockSunGlowEl = group?.querySelector(".clock-sun-glow-disc") || null;
        this._clockSunShadowEl =
          group?.querySelector(".clock-sun-shadow-disc") || null;
      }
    }
  },

  _layoutClockHorizonBack() {
    if (this._editorMotionKind() !== "dial") {
      return;
    }
    const back = this._clockHorizonBackEl;
    const face = this._clockFaceEl;
    if (!back || !face) {
      return;
    }
    const overlay = this._outgoingStageLayer;
    // Do not steal the fading-out dial's sky. Incoming circadian still needs
    // layout while a simple-editor overlay is exiting.
    if (overlay && (overlay.contains(back) || overlay.contains(face))) {
      return;
    }
    const stage = this._contentEl?.querySelector(".stage-col");
    const bg = this._stageBgEl(stage);
    // Keep the sky aligned to the face, but outside the preview's scroll
    // geometry. The shell clips decorative overflow on narrow screens.
    const background = bg || this._sharedEditorShell?.background || face;
    if (back.parentNode !== background) {
      background.appendChild(back);
    }
    const host = this.getBoundingClientRect();
    const originRect = background.getBoundingClientRect();
    const clip = this._contentEl?.querySelector(".workspace")?.getBoundingClientRect() || host;
    const fr = face.getBoundingClientRect();
    if (fr.width < 8 || host.width < 8) {
      return;
    }
    const cx = fr.left + fr.width / 2;
    const cy = fr.top + fr.height / 2;
    back.style.left = `${cx - originRect.left}px`;
    back.style.top = `${cy - originRect.top}px`;
    // Reach the light list under the face so horizon/bloom fill behind it —
    // but stop ~156px past the list so an abspos back cannot inflate scroll
    // height when an ancestor becomes a scrollport (overflow-x: clip quirk).
    const clock = face.closest(".sun-light-clock");
    const legend = this._clockLegendEl;
    const listBottom =
      legend?.getBoundingClientRect().bottom ??
      clock?.getBoundingClientRect().bottom ??
      fr.bottom;
    const contentBottom = listBottom + 156;
    // Cover the workspace from the face center, including under the frosted
    // area rail. Rails sit at a higher z-index; glow paints through the frost.
    const reach = Math.max(
      cx - clip.left,
      clip.right - cx,
      cy - clip.top,
      Math.min(clip.bottom, contentBottom) - cy,
      contentBottom - cy,
      Math.hypot(cx - clip.left, cy - clip.top),
      Math.hypot(clip.right - cx, cy - clip.top),
      Math.hypot(cx - clip.left, Math.min(clip.bottom, contentBottom) - cy),
      Math.hypot(clip.right - cx, Math.min(clip.bottom, contentBottom) - cy),
      fr.width * 0.62
    );
    const side = reach * 2 + 2;
    back.style.width = `${side}px`;
    back.style.height = `${side}px`;
  },

  _ensureOverrideArc(overlay) {
    const defs =
      overlay.querySelector("defs") ||
      overlay.insertBefore(
        document.createElementNS("http://www.w3.org/2000/svg", "defs"),
        overlay.firstChild
      );
    let grad = defs.querySelector("#clock-override-glow-grad");
    if (!grad) {
      grad = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "radialGradient"
      );
      grad.setAttribute("id", "clock-override-glow-grad");
      grad.setAttribute("cx", "50%");
      grad.setAttribute("cy", "50%");
      grad.setAttribute("r", "50%");
      defs.appendChild(grad);
    }
    while (grad.firstChild) {
      grad.removeChild(grad.firstChild);
    }
    const mk = (offset, opacity) => {
      const stop = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "stop"
      );
      stop.setAttribute("offset", offset);
      // Warm white–gold; a touch more opaque than the prior soft wash.
      stop.setAttribute("stop-color", "#ffe08a");
      stop.setAttribute("stop-opacity", String(opacity));
      grad.appendChild(stop);
    };
    // Half the prior inward reach; slightly less transparent than rev 121.
    mk("0%", 0);
    mk("78%", 0);
    mk("90%", 0.1);
    mk("100%", 0.24);
    let clip = defs.querySelector("#clock-override-wedge");
    if (!clip) {
      clip = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
      clip.setAttribute("id", "clock-override-wedge");
      clip.setAttribute("clipPathUnits", "userSpaceOnUse");
      const slice = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      clip.appendChild(slice);
      defs.appendChild(clip);
      this._clockOverrideWedgePathEl = slice;
    } else {
      this._clockOverrideWedgePathEl = clip.querySelector("path");
    }
    let glow = overlay.querySelector(".clock-override-glow");
    if (!glow) {
      glow = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      glow.setAttribute("class", "clock-override-glow");
      glow.setAttribute("cx", String(CLOCK_CX));
      glow.setAttribute("cy", String(CLOCK_CY));
      glow.setAttribute("r", String(CLOCK_OVERRIDE_R));
      glow.setAttribute("fill", "url(#clock-override-glow-grad)");
      glow.setAttribute("clip-path", "url(#clock-override-wedge)");
      glow.setAttribute("visibility", "hidden");
      overlay.appendChild(glow);
    }
    let arc = overlay.querySelector(".clock-override-arc");
    if (!arc) {
      arc = document.createElementNS("http://www.w3.org/2000/svg", "path");
      arc.setAttribute("class", "clock-override-arc");
      arc.setAttribute("vector-effect", "non-scaling-stroke");
      arc.setAttribute("stroke-width", "1px");
      arc.setAttribute("visibility", "hidden");
      overlay.appendChild(arc);
    }
    this._clockOverrideGlowEl = glow;
    this._clockOverrideArcEl = arc;
  },

  _updateOverrideArc(overrideSeconds) {
    const glow = this._clockOverrideGlowEl;
    const arc = this._clockOverrideArcEl;
    const wedge = this._clockOverrideWedgePathEl;
    if (!glow || !arc || !wedge) {
      return;
    }
    if (overrideSeconds == null) {
      glow.setAttribute("visibility", "hidden");
      arc.setAttribute("visibility", "hidden");
      this._clockOverrideArcSweep = null;
      return;
    }
    const now = nowSecondsSinceMidnight();
    const cw = this._clockwiseSecondsDelta(now, overrideSeconds);
    const ccw = (SECONDS_PER_DAY - cw) % SECONDS_PER_DAY;
    if (Math.min(cw, ccw) < 45) {
      glow.setAttribute("visibility", "hidden");
      arc.setAttribute("visibility", "hidden");
      this._clockOverrideArcSweep = null;
      return;
    }
    // Keep the sweep that was already growing so the wedge does not flip
    // to the short arc at 12h (play / long sun drags wrap past halfway).
    let sweep = this._clockOverrideArcSweep;
    if (sweep !== 0 && sweep !== 1) {
      sweep = cw <= ccw ? 1 : 0;
    }
    this._clockOverrideArcSweep = sweep;
    const r = this._clockOverrideR ?? CLOCK_OVERRIDE_R;
    glow.setAttribute("r", String(r));
    const start = this._clockPolar(now, r);
    const end = this._clockPolar(overrideSeconds, r);
    const absSpan = sweep === 1 ? cw : ccw;
    const large = absSpan / SECONDS_PER_DAY > 0.5 ? 1 : 0;
    const arcD = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
    const wedgeD = `M ${CLOCK_CX} ${CLOCK_CY} L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`;
    arc.setAttribute("d", arcD);
    wedge.setAttribute("d", wedgeD);
    glow.setAttribute("visibility", "visible");
    arc.setAttribute("visibility", "visible");
  },

  _layoutClockHandle(seconds, elev, scale = 1) {
    const inner = this._clockHandleInnerEl;
    const outer = this._clockHandleOuterEl;
    if (!inner || !outer) {
      return;
    }
    const pos = this._clockSunXy(seconds, elev);
    const sunR = CLOCK_SUN_R_VIEW * scale;
    const dist = Math.hypot(pos.x - CLOCK_CX, pos.y - CLOCK_CY);
    const near = this._clockPolar(seconds, Math.max(0, dist - sunR));
    const far = this._clockPolar(seconds, dist + sunR);
    const tip = this._clockPolar(
      seconds,
      Math.max(CLOCK_TICK_OUTER, dist + sunR + 4)
    );
    inner.setAttribute("x1", String(CLOCK_CX));
    inner.setAttribute("y1", String(CLOCK_CY));
    inner.setAttribute("x2", near.x.toFixed(2));
    inner.setAttribute("y2", near.y.toFixed(2));
    outer.setAttribute("x1", far.x.toFixed(2));
    outer.setAttribute("y1", far.y.toFixed(2));
    outer.setAttribute("x2", tip.x.toFixed(2));
    outer.setAttribute("y2", tip.y.toFixed(2));
  },

  _horizonWeight(seconds, center, band) {
    let delta = Math.abs(seconds - center);
    delta = Math.min(delta, SECONDS_PER_DAY - delta);
    if (delta >= band) {
      return 0;
    }
    return 0.5 * (1 + Math.cos((delta / band) * Math.PI));
  },

  _rgbCss(rgb) {
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  },

  _lerpRgb(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t),
    ];
  },

  /**
   * Continuous core→outer RGB stops for the horizon rim (then → surface).
   * Colorful gold→pink→purple only through civil twilight; at dusk (sun −6°,
   * “last light”) and below the rim is dark blue only — no afterglow pinks.
   * Elevation keyframes share the same stop count so scrub never jumps.
   */
  _horizonSpectrumStops(elev) {
    const light = !this.hasAttribute("data-dark-mode");
    // 5 stops: near-sun → mid → far, then caller mixes into surface.
    // Dusk/dawn in this product = civil ±6° (see scene_dusk helper copy).
    const keys = light
      ? [
          {
            e: -90,
            stops: [
              [130, 145, 175],
              [145, 158, 185],
              [160, 172, 198],
              [175, 185, 208],
              [190, 198, 218],
            ],
          },
          {
            // At/after dusk: dark-blue wash only (soft for light surfaces).
            e: -6,
            stops: [
              [120, 140, 180],
              [135, 152, 188],
              [150, 165, 198],
              [168, 180, 208],
              [185, 195, 218],
            ],
          },
          {
            e: 0,
            // Gold → coral → pink → mauve → soft sky (sunset / last civil light).
            stops: [
              [255, 178, 88],
              [245, 140, 96],
              [236, 120, 150],
              [196, 148, 210],
              [158, 200, 245],
            ],
          },
          {
            e: 8,
            stops: [
              [126, 200, 255],
              [140, 206, 255],
              [168, 216, 250],
              [196, 228, 252],
              [220, 238, 255],
            ],
          },
          {
            e: 90,
            stops: [
              [79, 179, 255],
              [120, 198, 255],
              [158, 214, 252],
              [190, 226, 255],
              [220, 238, 255],
            ],
          },
        ]
      : [
          {
            e: -90,
            stops: [
              [8, 12, 28],
              [10, 16, 40],
              [12, 20, 48],
              [14, 24, 56],
              [18, 30, 68],
            ],
          },
          {
            // At/after dusk (−6°): dark blue only — pink/purple end with last light.
            e: -6,
            stops: [
              [28, 45, 100],
              [22, 38, 85],
              [16, 30, 70],
              [12, 22, 55],
              [10, 16, 42],
            ],
          },
          {
            e: 0,
            // Gold/orange core (Rayleigh), then pink, mauve, blue through twilight.
            stops: [
              [255, 170, 85],
              [245, 140, 100],
              [232, 120, 160],
              [150, 90, 180],
              [70, 120, 200],
            ],
          },
          {
            e: 8,
            stops: [
              [100, 185, 250],
              [79, 179, 255],
              [70, 150, 230],
              [50, 110, 190],
              [36, 80, 150],
            ],
          },
          {
            e: 90,
            stops: [
              [79, 179, 255],
              [64, 165, 250],
              [50, 130, 220],
              [36, 90, 170],
              [28, 64, 120],
            ],
          },
        ];
    let lo = keys[0];
    let hi = keys[keys.length - 1];
    for (let i = 0; i < keys.length - 1; i += 1) {
      if (elev >= keys[i].e && elev <= keys[i + 1].e) {
        lo = keys[i];
        hi = keys[i + 1];
        break;
      }
      if (elev < keys[0].e) {
        lo = hi = keys[0];
        break;
      }
    }
    if (elev > keys[keys.length - 1].e) {
      lo = hi = keys[keys.length - 1];
    }
    const span = hi.e - lo.e || 1;
    const t = lo === hi ? 0 : (elev - lo.e) / span;
    return lo.stops.map((a, i) => this._lerpRgb(a, hi.stops[i], t));
  },

  /** Color along spectrum for band weight 1 (event) → 0 (surface). */
  _horizonBandColor(weight, spectrumStops) {
    const SURFACE = "var(--primary-background-color)";
    const u = 1 - Math.min(1, Math.max(0, weight));
    // Evenly space RGB stops, then a final segment into the surface color.
    const n = spectrumStops.length;
    const pos = u * n;
    if (pos >= n - 1e-6) {
      return SURFACE;
    }
    const i = Math.min(n - 1, Math.floor(pos));
    const f = pos - i;
    if (i >= n - 1) {
      const pct = Math.round((1 - f) * 100);
      if (pct >= 100) {
        return this._rgbCss(spectrumStops[n - 1]);
      }
      if (pct <= 0) {
        return SURFACE;
      }
      return `color-mix(in srgb, ${this._rgbCss(spectrumStops[n - 1])} ${pct}%, ${SURFACE})`;
    }
    return this._rgbCss(this._lerpRgb(spectrumStops[i], spectrumStops[i + 1], f));
  },

  /**
   * Day-wedge sky from elevation (smooth; light = crispy blue).
   */
  _horizonDaySky(elev, spectrumStops) {
    const light = !this.hasAttribute("data-dark-mode");
    if (light) {
      return CLOCK_DAY_SKY_LIGHT;
    }
    return elev >= 4
      ? this._rgbCss(spectrumStops[0])
      : "rgb(79, 179, 255)";
  },

  _updateHorizonGlow(elev, _glowLook) {
    const el = this._clockHorizonGlowEl;
    if (!el) {
      return;
    }
    const sunrise = this._clockSunriseSeconds;
    const sunset = this._clockSunsetSeconds;
    if (sunrise == null && sunset == null) {
      this._horizonGlowCacheKey = null;
      el.style.background = "transparent";
      el.style.opacity = "";
      if (this._clockSkyDayEl) {
        this._clockSkyDayEl.setAttribute("fill", "transparent");
      }
      return;
    }
    const maxElev = Math.max(this._sunPath?.max_elevation || 0, 1e-6);
    // Skip rebuild when scrub elev has not moved enough to change the wash.
    const elevQ = Math.round(elev / 0.25) * 0.25;
    const cacheKey = `${elevQ}|${sunrise}|${sunset}|${maxElev.toFixed(2)}`;
    if (cacheKey === this._horizonGlowCacheKey) {
      return;
    }
    this._horizonGlowCacheKey = cacheKey;
    // Climb 0 at/below horizon → 1 at that day's peak (smooth; no hard palette cut).
    const climb = Math.min(1, Math.max(0, elev) / maxElev);
    const nearHorizon = elev < 0 ? 1 : 1 - climb;
    // Keep some wash at noon so sky blue still peeks; stronger near horizon.
    const strength = 0.42 + 0.58 * nearHorizon;
    // Wider band so gold→pink→purple→blue can stretch into surface.
    const band = 5 * 3600;
    const steps = 48;
    const stops = [];
    const spectrum = this._horizonSpectrumStops(elev);
    const daySky = this._horizonDaySky(elev, spectrum);
    for (let i = 0; i <= steps; i += 1) {
      const seconds = (i / steps) * SECONDS_PER_DAY;
      let weight = 0;
      if (sunrise != null) {
        weight = Math.max(weight, this._horizonWeight(seconds, sunrise, band));
      }
      if (sunset != null) {
        weight = Math.max(weight, this._horizonWeight(seconds, sunset, band));
      }
      const mix = Math.min(1, weight * strength);
      stops.push(
        `${this._horizonBandColor(mix, spectrum)} ${((i / steps) * 100).toFixed(2)}%`
      );
    }
    el.style.background = `conic-gradient(from 180deg, ${stops.join(", ")})`;
    // Quiet day/night blue rim wash; keep civil-twilight gold→pink at full
    // strength (do not blanket-dim the conic — that washed out sunrise/sunset).
    const fancy = Math.max(0, 1 - Math.abs(elev) / 6);
    el.style.opacity = String(0.15 + 0.85 * fancy);

    // Day wedge (sunrise→sunset): crispy sky blue in light; elevation sky in dark.
    const dayEl = this._clockSkyDayEl;
    if (dayEl) {
      // Bridge civil twilight so fill alpha does not jump at elev=0.
      const twilight =
        elev >= 0 ? 1 : Math.min(1, Math.max(0, (elev + 6) / 6));
      // Half of the prior peak (~80%) so the sky fill stays visible; glow
      // opacity above is what quiets noon/midnight blue.
      const dayAlpha = (0.16 + 0.26 * twilight + 0.38 * climb) * 0.5;
      dayEl.setAttribute(
        "fill",
        `color-mix(in srgb, ${daySky} ${Math.round(dayAlpha * 100)}%, transparent)`
      );
    }
  },

  /** Sky wash removed — dial relies on night wedges + horizon rim glow only. */
  _layoutClockSunFill(pos, scale) {
    const fill = this._clockSunFillEl;
    const glow = this._clockSunGlowEl;
    const shadow = this._clockSunShadowEl;
    if (!fill) {
      return;
    }
    const r = CLOCK_SUN_R_VIEW * scale * 0.94;
    fill.setAttribute("cx", pos.x.toFixed(2));
    fill.setAttribute("cy", pos.y.toFixed(2));
    fill.setAttribute("r", r.toFixed(2));
    if (glow) {
      // 50% larger than the prior 2.2× halo; shares the day-wedge clip.
      const glowR = r * 3.3;
      glow.setAttribute("cx", pos.x.toFixed(2));
      glow.setAttribute("cy", pos.y.toFixed(2));
      glow.setAttribute("r", glowR.toFixed(2));
    }
    if (shadow) {
      // Keep shadow inside the glow so the halo stays visible around it.
      const shadowR = r * 1.85;
      shadow.setAttribute("cx", pos.x.toFixed(2));
      shadow.setAttribute("cy", pos.y.toFixed(2));
      shadow.setAttribute("r", shadowR.toFixed(2));
    }
    // Without a sunrise/sunset wedge, hide fill+glow entirely below horizon.
    if (!this._clockSunDayClipId) {
      const below = this._clockSunEl?.classList.contains("below-horizon");
      const vis = below ? "hidden" : "visible";
      fill.setAttribute("visibility", vis);
      if (glow) {
        glow.setAttribute("visibility", vis);
      }
    }
  },

  _paintSunDayClip(overlay, events) {
    const sunrise = this._clockEventSeconds(events, "sunrise");
    const sunset = this._clockEventSeconds(events, "sunset");
    this._clockSunDayClipId = null;
    const defs =
      overlay.querySelector("defs") ||
      overlay.insertBefore(
        document.createElementNS("http://www.w3.org/2000/svg", "defs"),
        overlay.firstChild
      );
    let clip = defs.querySelector("#clock-sun-day-clip");
    if (sunset == null || sunrise == null) {
      clip?.remove();
      return;
    }
    if (!clip) {
      clip = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
      clip.setAttribute("id", "clock-sun-day-clip");
      clip.setAttribute("clipPathUnits", "userSpaceOnUse");
      defs.appendChild(clip);
    }
    let slice = clip.querySelector("path");
    if (!slice) {
      slice = document.createElementNS("http://www.w3.org/2000/svg", "path");
      clip.appendChild(slice);
    }
    slice.setAttribute("d", this._clockWedgePath(sunrise, sunset, CLOCK_SKY_R));
    this._clockSunDayClipId = "clock-sun-day-clip";
  },

  _paintHorizonShadow(overlay, events) {
    const sunrise = this._clockEventSeconds(events, "sunrise");
    const sunset = this._clockEventSeconds(events, "sunset");
    const dawn = this._clockEventSeconds(events, "dawn");
    const dusk = this._clockEventSeconds(events, "dusk");
    this._clockSunriseSeconds = sunrise;
    this._clockSunsetSeconds = sunset;
    this._clockSkyDayEl = null;
    if (sunset != null && sunrise != null) {
      // Day sector first (under night wedges) — sky-blue wash updates with elev.
      const day = document.createElementNS("http://www.w3.org/2000/svg", "path");
      day.setAttribute("class", "clock-sky-day");
      day.setAttribute("d", this._clockWedgePath(sunrise, sunset, CLOCK_SKY_R));
      overlay.appendChild(day);
      this._clockSkyDayEl = day;
      const night = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      night.setAttribute("class", "clock-sky-night");
      night.setAttribute("d", this._clockWedgePath(sunset, sunrise, CLOCK_SKY_R));
      overlay.appendChild(night);
    }
    if (dusk != null && dawn != null) {
      const deep = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      deep.setAttribute("class", "clock-sky-deep");
      deep.setAttribute("d", this._clockWedgePath(dusk, dawn, CLOCK_SKY_R));
      overlay.appendChild(deep);
    }
  },

  _paintClockSunPath(overlay, events, { includeSun = true } = {}) {
    const curve = this._sunPath?.curve;
    if (!curve?.length) {
      beginSvgFrame(overlay, overlay.querySelector(".clock-sun-day-group")).finish();
      return;
    }
    this._paintSunDayClip(overlay, events);

    const r = this._clockSunPathRadius();
    const arcPath = (fromSeconds, toSeconds) => {
      let span =
        (((toSeconds - fromSeconds) % SECONDS_PER_DAY) + SECONDS_PER_DAY) %
        SECONDS_PER_DAY;
      if (span < 1) {
        return null;
      }
      const start = this._clockPolar(fromSeconds, r);
      const end = this._clockPolar(fromSeconds + span, r);
      const large = span / SECONDS_PER_DAY > 0.5 ? 1 : 0;
      return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
    };
    const marks = beginSvgFrame(overlay, overlay.querySelector(".clock-sun-day-group"));
    let runIndex = 0;
    // Night dashed arcs only below the horizon (no full-circle underlay).
    for (const run of sunStrokePathRuns(curve, () => CLOCK_SUN_PATH_WIDTH_PX)) {
      const from = run.points[0][0];
      const to = run.points[run.points.length - 1][0];
      const d = arcPath(from, to);
      if (!d) {
        continue;
      }
      marks.node(`sun-run:${runIndex++}`, "path", {
        class: run.night ? "clock-sun-path-night" : "clock-sun-day",
        d,
        "vector-effect": "non-scaling-stroke",
        "stroke-width": "1px",
      });
    }

    const spokeOuter = Math.min(96, CLOCK_TICK_OUTER - 1);
    this._clockEventDotEls = [];
    this._clockEventSpokeEls = [];
    this._clockEventClampLinkEls = [];
    for (const event of events || []) {
      const markSeconds = this._eventMarkSeconds(event);
      if (markSeconds == null) {
        continue;
      }
      const pos = this._clockSunXy(markSeconds);
      const outer = this._clockPolar(markSeconds, spokeOuter);
      const spoke = marks.node(`ray:${event.id}`, "line", {
        class: "clock-event-ray",
        x1: outer.x.toFixed(2), y1: outer.y.toFixed(2),
        x2: pos.x.toFixed(2), y2: pos.y.toFixed(2),
        "data-event-id": event.id,
      });
      this._clockEventSpokeEls.push(spoke);
      const dot = marks.node(`dot:${event.id}`, "circle", {
        class: "clock-event-dot", cx: pos.x.toFixed(2), cy: pos.y.toFixed(2),
      });
      // r is still set by layout for a fixed screen size.
      this._clockEventDotEls.push(dot);
      const buttonSeconds = this._eventButtonSeconds(event);
      if (
        event.overridden &&
        buttonSeconds != null &&
        buttonSeconds !== markSeconds
      ) {
        const link = marks.node(`clamp:${event.id}`, "path", {
          class: "clock-event-clamp-link", fill: "none", "data-event-id": event.id,
        });
        this._clockEventClampLinkEls.push(link);
      }
    }

    marks.finish();

    // Year-scrub patch only refreshes path/marks — recreating sun chrome here
    // would replace _clockSunEl with a detached node and skip spoke layout.
    // Re-append the fill group so new paths stay *under* the sun (append order
    // otherwise paints the path on top of the fill; HTML outline is separate).
    if (!includeSun) {
      const dayGroup = overlay.querySelector(".clock-sun-day-group");
      if (dayGroup && dayGroup !== overlay.lastChild) {
        overlay.appendChild(dayGroup);
      }
      return;
    }

    const defs =
      overlay.querySelector("defs") ||
      overlay.insertBefore(
        document.createElementNS("http://www.w3.org/2000/svg", "defs"),
        overlay.firstChild
      );
    let glowGrad = defs.querySelector("#clock-sun-glow-grad");
    if (!glowGrad) {
      glowGrad = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "radialGradient"
      );
      glowGrad.setAttribute("id", "clock-sun-glow-grad");
      glowGrad.setAttribute("cx", "50%");
      glowGrad.setAttribute("cy", "50%");
      glowGrad.setAttribute("r", "50%");
      defs.appendChild(glowGrad);
    }
    while (glowGrad.firstChild) {
      glowGrad.removeChild(glowGrad.firstChild);
    }
    const mkGlow = (offset, color, opacity) => {
      const stop = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "stop"
      );
      stop.setAttribute("offset", offset);
      stop.setAttribute("stop-color", color);
      stop.setAttribute("stop-opacity", String(opacity));
      glowGrad.appendChild(stop);
    };
    // Soft warm halo via gradient only (no CSS blur — that trailed on scrub).
    mkGlow("0%", "#ffffff", 0.28);
    mkGlow("22%", "#ffffff", 0.9);
    mkGlow("48%", "#fff1c2", 0.58);
    mkGlow("72%", "#ffd27a", 0.28);
    mkGlow("100%", "#ffc878", 0);

    let shadowGrad = defs.querySelector("#clock-sun-shadow-grad");
    if (!shadowGrad) {
      shadowGrad = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "radialGradient"
      );
      shadowGrad.setAttribute("id", "clock-sun-shadow-grad");
      shadowGrad.setAttribute("cx", "50%");
      shadowGrad.setAttribute("cy", "50%");
      shadowGrad.setAttribute("r", "50%");
      defs.appendChild(shadowGrad);
    }
    while (shadowGrad.firstChild) {
      shadowGrad.removeChild(shadowGrad.firstChild);
    }
    const mkShadow = (offset, opacity) => {
      const stop = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "stop"
      );
      stop.setAttribute("offset", offset);
      stop.setAttribute("stop-color", "#000");
      stop.setAttribute("stop-opacity", String(opacity));
      shadowGrad.appendChild(stop);
    };
    mkShadow("0%", 0.22);
    mkShadow("55%", 0.12);
    mkShadow("100%", 0);

    const clipUrl = this._clockSunDayClipId
      ? `url(#${this._clockSunDayClipId})`
      : null;

    // Shadow + glow + fill share the day wedge clip so they fade together
    // across the horizon (no hard on/off). Outline ring stays unclipped.
    overlay.querySelectorAll(".clock-sun-day-group").forEach((el) => el.remove());
    const shadow = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    shadow.setAttribute("class", "clock-sun-shadow-disc");
    shadow.setAttribute("fill", "url(#clock-sun-shadow-grad)");
    const glow = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    glow.setAttribute("class", "clock-sun-glow-disc");
    glow.setAttribute("fill", "url(#clock-sun-glow-grad)");
    const fill = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    fill.setAttribute("class", "clock-sun-fill");
    fill.setAttribute("fill", "#fff");
    const dayGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    dayGroup.setAttribute("class", "clock-sun-day-group");
    if (clipUrl) {
      dayGroup.setAttribute("clip-path", clipUrl);
    }
    dayGroup.append(shadow, glow, fill);
    overlay.append(dayGroup);
    this._clockSunShadowEl = shadow;
    this._clockSunGlowEl = glow;
    this._clockSunFillEl = fill;
    this._clockSunNightEl = null;

    // Full build only — caller appends these to the core. Never create them
    // during year-scrub patch (includeSun: false) or the visible outline sticks.
    const marker = document.createElement("div");
    marker.className = "clock-sun";
    marker.setAttribute("aria-hidden", "true");
    const ring = document.createElement("span");
    ring.className = "clock-sun-ring";
    marker.appendChild(ring);
    this._clockSunEl = marker;

    const hit = document.createElement("div");
    hit.className = "clock-sun-hit";
    hit.setAttribute("role", "slider");
    hit.setAttribute("aria-label", "Drag to preview time of day");
    this._clockSunHitEl = hit;
    this._clockSunLive = false;
    this._cancelClockSunArc();
  },

  /** Update night/day wedge path `d` in place during morph (no node churn). */
  _syncHorizonShadowPaths(events) {
    const sky = this._clockHorizonSkyEl;
    if (!sky) {
      return;
    }
    const sunrise = this._clockEventSeconds(events, "sunrise");
    const sunset = this._clockEventSeconds(events, "sunset");
    const dawn = this._clockEventSeconds(events, "dawn");
    const dusk = this._clockEventSeconds(events, "dusk");
    this._clockSunriseSeconds = sunrise;
    this._clockSunsetSeconds = sunset;
    const dayEl = sky.querySelector(".clock-sky-day");
    const nightEl = sky.querySelector(".clock-sky-night");
    const deepEl = sky.querySelector(".clock-sky-deep");
    if (sunrise != null && sunset != null) {
      if (dayEl) {
        dayEl.setAttribute(
          "d",
          this._clockWedgePath(sunrise, sunset, CLOCK_SKY_R)
        );
        this._clockSkyDayEl = dayEl;
      }
      if (nightEl) {
        nightEl.setAttribute(
          "d",
          this._clockWedgePath(sunset, sunrise, CLOCK_SKY_R)
        );
      }
    }
    if (dusk != null && dawn != null && deepEl) {
      deepEl.setAttribute(
        "d",
        this._clockWedgePath(dusk, dawn, CLOCK_SKY_R)
      );
    }
  }
};
