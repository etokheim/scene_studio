/* dial interaction owns these panel methods.
 * The receiver is the panel: navigation, rendering and saving remain host hooks.
 * Keep closures bound to that receiver; do not bind methods to a separate object. */
import {
  SECONDS_PER_DAY,
  CLOCK_SNAP_CAPTURE_SEC,
  CLOCK_DRAG_CLICK_PX,
  CLOCK_EVENT_BRIGHT_DRAG_PX,
  CLOCK_BRIGHT_MOVE_MS,
  CLOCK_SUN_MOVE_MS,
  SCENE_PLAY_TRANSITION_SEC,
} from "./panel_constants.js";
import { nowSecondsSinceMidnight } from "./editor_session.js";
import { easeOutCubic } from "./dial_clock.js";

export const dialInteractionMethods = {
  _resetClockSunToNow() {
    this._clearSelectedSolarEvent();
    if (this._scenePlayActive()) {
      this._stopScenePlay({ restore: !this._roomPreview });
    }
    this._clockStickySeconds = undefined;
    this._clockOverrideArcSweep = null;
    this._clockSunDragging = false;
    this._hoverSeconds = undefined;
    this._clockSunLive = false;
    const now = nowSecondsSinceMidnight();
    this._moveClockSunTo(now, { durationMs: CLOCK_SUN_MOVE_MS });
    this._fillHoverReadout(now, { hovering: false });
    this._scheduleScenePreviewApply({
      force: true,
      transition: SCENE_PLAY_TRANSITION_SEC,
    });
  },

  /** Ease the sun along the path when it relocates (event pin, reset, etc.). */
  _moveClockSunTo(toSeconds, { durationMs = CLOCK_SUN_MOVE_MS } = {}) {
    if (!this._clockSunEl || toSeconds == null) {
      return;
    }
    const to =
      ((toSeconds % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
    const from = this._clockSunDisplayedSeconds ?? to;
    this._cancelClockSunArc();
    if (Math.abs(this._shortestSecondsDelta(from, to)) < 1) {
      this._applyClockSunAppearance(to);
      return;
    }
    this._animateClockSunArc(from, to, durationMs);
  },

  _secondsFromClockPointer(ev, face) {
    const rect = face.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = ev.clientX - cx;
    const dy = ev.clientY - cy;
    // 0° at midnight (bottom), clockwise — matches conic-gradient(from 180deg).
    let deg = (Math.atan2(dx, -dy) * 180) / Math.PI + 180;
    deg = ((deg % 360) + 360) % 360;
    return (deg / 360) * SECONDS_PER_DAY;
  },

  _clockAngleDeg(seconds) {
    // Noon at top, midnight at bottom (180° offset from CSS 12-o'clock).
    const s =
      ((Number(seconds) % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
    return (s / SECONDS_PER_DAY) * 360 + 180;
  },

  _lightAtClockPointer(ev, ringsHost, ringLights) {
    if (!ringLights.length || !ringsHost) {
      return null;
    }
    const rect = ringsHost.getBoundingClientRect();
    const ringsRadius = Math.min(rect.width, rect.height) / 2;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const r = Math.hypot(ev.clientX - cx, ev.clientY - cy);
    if (r > ringsRadius || ringsRadius <= 0) {
      return null;
    }
    const pct = (r / ringsRadius) * 100;
    const n = ringLights.length;
    const hole = 0;
    const stroke = (100 - hole) / n;
    for (let index = 0; index < n; index += 1) {
      const midOuter = 100 - index * stroke;
      const midInner = Math.max(hole, midOuter - stroke);
      if (pct <= midOuter && pct >= midInner) {
        return ringLights[index];
      }
    }
    // Center falls in the innermost ring when the hole is filled.
    if (pct < hole && n) {
      return ringLights[n - 1];
    }
    return null;
  },

  _clockSunIdleSeconds() {
    if (this._clockStickySeconds != null) {
      return this._clockStickySeconds;
    }
    const id = this._sidebarEventId;
    if (id) {
      const event = (this._sunPath?.events || []).find((item) => item.id === id);
      if (event?.seconds != null) {
        return event.seconds;
      }
    }
    return nowSecondsSinceMidnight();
  },

  _idleReadoutSeconds() {
    if (this._clockStickySeconds != null) {
      return this._clockStickySeconds;
    }
    if (this._sidebarEventId) {
      const event = (this._sunPath?.events || []).find(
        (item) => item.id === this._sidebarEventId
      );
      if (event?.seconds != null) {
        return event.seconds;
      }
    }
    // Wall-clock “now” on any preview date — sun elev comes from that day’s curve.
    return nowSecondsSinceMidnight();
  },

  /** Shortest signed seconds delta on the 24h circle (for arc lerps). */
  _shortestSecondsDelta(from, to) {
    let d =
      ((((to - from) % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY);
    if (d > SECONDS_PER_DAY / 2) {
      d -= SECONDS_PER_DAY;
    }
    return d;
  },

  /** Clockwise seconds from `from` to `to` on the 24h circle (0..86400). */
  _clockwiseSecondsDelta(from, to) {
    return (
      (((to - from) % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY
    );
  },

  _cancelClockSunArc() {
    if (this._clockSunArcRaf) {
      window.cancelAnimationFrame(this._clockSunArcRaf);
      this._clockSunArcRaf = undefined;
    }
  },

  /**
   * Ease the sun along the elevation curve by chasing time-of-day.
   * Retargeting mid-flight only updates the goal — exponential smoothing
   * keeps motion on the arc without restarting a CSS/tween chord.
   */
  _tickClockSunArc(now) {
    const last = this._clockSunArcLastTick ?? now;
    this._clockSunArcLastTick = now;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    const cur =
      this._clockSunDisplayedSeconds ?? this._clockSunIdleSeconds();
    const target = this._clockSunArcTo;
    const d = this._shortestSecondsDelta(cur, target);
    // Don't treat a zero-dt first frame as "arrived" (that snapped the
    // return-to-idle motion when hover ended).
    if (dt < 0.001) {
      this._clockSunArcRaf = window.requestAnimationFrame((t) =>
        this._tickClockSunArc(t)
      );
      return;
    }
    // ~0.11s time-constant ≈ settles in ~300ms; follows a moving pointer.
    const tau = 0.11;
    const step = d * (1 - Math.exp(-dt / tau));
    if (Math.abs(d) < 0.75) {
      this._clockSunArcRaf = undefined;
      this._applyClockSunAppearance(target);
      if (this._clockSunArcThenLive && this._hoverSeconds != null) {
        this._clockSunLive = true;
        this._applyClockSunAppearance(this._hoverSeconds);
      }
      return;
    }
    let s = cur + step;
    s = ((s % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
    this._applyClockSunAppearance(s);
    this._clockSunArcRaf = window.requestAnimationFrame((t) =>
      this._tickClockSunArc(t)
    );
  },

  /** Timed ease along the elevation curve (used for the clock enter sweep). */
  _animateClockSunArc(fromSeconds, toSeconds, durationMs, { forward = false } = {}) {
    this._cancelClockSunArc();
    this._clockSunLive = false;
    const from =
      ((fromSeconds % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
    const to =
      ((toSeconds % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
    // Enter sweep wants a fixed 6h forward run; hover uses shortest arc.
    const delta = forward
      ? (((to - from) % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY
      : this._shortestSecondsDelta(from, to);
    const started = performance.now();
    this._applyClockSunAppearance(from);
    const tick = (now) => {
      const u = Math.min(1, (now - started) / durationMs);
      // Cubic ease-out: decelerates across more of the 1.5s than quintic.
      const eased = easeOutCubic(u);
      let s = from + delta * eased;
      s = ((s % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
      this._applyClockSunAppearance(s);
      if (u < 1) {
        this._clockSunArcRaf = window.requestAnimationFrame(tick);
        return;
      }
      this._clockSunArcRaf = undefined;
      this._applyClockSunAppearance(to);
    };
    this._clockSunArcRaf = window.requestAnimationFrame(tick);
  },

  _playClockEnterAnimation(face) {
    const idle = this._clockSunIdleSeconds();
    const from =
      (((idle - 6 * 3600) % SECONDS_PER_DAY) + SECONDS_PER_DAY) %
      SECONDS_PER_DAY;
    face.classList.remove("clock-face-enter");
    // Restart CSS enter if the face was recycled in the same document.
    void face.offsetWidth;
    face.classList.add("clock-face-enter");
    const finish = () => {
      face.classList.remove("clock-face-enter");
      face.removeEventListener("animationend", clearEnter);
    };
    const clearEnter = (ev) => {
      if (ev.animationName && ev.animationName !== "clock-overlay-spin") {
        return;
      }
      finish();
    };
    face.addEventListener("animationend", clearEnter);
    window.setTimeout(finish, 480);
    this._animateClockSunArc(from, idle, 700, { forward: true });
  },

  _cancelClockBrightMotion() {
    if (this._clockBrightAnimRaf) {
      window.cancelAnimationFrame(this._clockBrightAnimRaf);
      this._clockBrightAnimRaf = undefined;
    }
  },

  _syncClockBrightMotion(targets) {
    const next = { ...targets };
    if (
      this._clockBrightDragging ||
      this._brightnessScrubbing ||
      !Object.keys(this._clockBrightShown || {}).length
    ) {
      this._cancelClockBrightMotion();
      this._clockBrightShown = next;
      this._clockBrightTarget = next;
      this._clockBrightFrom = next;
      return;
    }
    if (this._clockBrightValuesEqual(this._clockBrightTarget, next)) {
      return;
    }
    this._clockBrightFrom = { ...this._clockBrightShown };
    this._clockBrightTarget = next;
    this._clockBrightAnimT0 = performance.now();
    this._cancelClockBrightMotion();
    const tick = (now) => {
      const u = Math.min(1, (now - this._clockBrightAnimT0) / CLOCK_BRIGHT_MOVE_MS);
      const eased = easeOutCubic(u);
      const shown = {};
      const ids = new Set([
        ...Object.keys(this._clockBrightFrom),
        ...Object.keys(this._clockBrightTarget),
      ]);
      for (const id of ids) {
        const a = this._clockBrightFrom[id] ?? this._clockBrightTarget[id] ?? 0;
        const b = this._clockBrightTarget[id] ?? a;
        shown[id] = a + (b - a) * eased;
      }
      this._clockBrightShown = shown;
      this._placeClockBrightnessHandles();
      this._layoutClockEventSpokes();
      this._layoutClockBrightnessCurve();
      if (u < 1) {
        this._clockBrightAnimRaf = window.requestAnimationFrame(tick);
        return;
      }
      this._clockBrightAnimRaf = undefined;
      this._clockBrightShown = { ...this._clockBrightTarget };
      this._placeClockBrightnessHandles();
      this._layoutClockEventSpokes();
      this._layoutClockBrightnessCurve();
    };
    this._clockBrightAnimRaf = window.requestAnimationFrame(tick);
  },

  _bindClockEventBrightnessDrag(btn, event, anchor) {
    const onDown = (ev) => {
      if (ev.button != null && ev.button !== 0) {
        return;
      }
      this._clockEventDragMoved = false;
      this._clockEventDragOrigin = { x: ev.clientX, y: ev.clientY };
      this._clockEventDragEventId = event.id;
      this._clockEventDragUndo = false;
      btn.setPointerCapture?.(ev.pointerId);
    };
    const onMove = (ev) => {
      if (this._clockEventDragEventId !== event.id) {
        return;
      }
      const origin = this._clockEventDragOrigin;
      if (!origin) {
        return;
      }
      const dx = ev.clientX - origin.x;
      const dy = ev.clientY - origin.y;
      if (
        !this._clockEventDragMoved &&
        dx * dx + dy * dy <
          CLOCK_EVENT_BRIGHT_DRAG_PX * CLOCK_EVENT_BRIGHT_DRAG_PX
      ) {
        return;
      }
      if (!this._clockEventDragMoved) {
        this._clockEventDragMoved = true;
        this._clockBrightDragging = true;
        this._beginBrightnessScrub();
        this._cancelClockBrightMotion();
        btn.classList.add("bright-dragging");
      }
      ev.preventDefault();
      const face = this._clockFaceEl;
      const r0 = this._clockBrightR0;
      const r1 = this._clockBrightR1;
      const polar = anchor._clockPolar;
      if (!face || r0 == null || r1 == null || !polar || !(r1 > r0)) {
        return;
      }
      const rect = face.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const along = (ev.clientX - cx) * polar.cos + (ev.clientY - cy) * polar.sin;
      const r0Px = (r0 / 100) * rect.width;
      const r1Px = (r1 / 100) * rect.width;
      const t = (along - r0Px) / (r1Px - r0Px);
      const bounded = t < 0 ? 0 : t > 1 ? 1 : t;
      const brightness = Math.round(bounded * 255);
      this._writeDialEventBrightness(event.id, brightness, {
        history: !this._clockEventDragUndo,
      });
      this._clockEventDragUndo = true;
    };
    const onUp = (ev) => {
      if (this._clockEventDragEventId !== event.id) {
        return;
      }
      if (this._clockEventDragMoved) {
        this._clockEventSuppressClick = true;
        ev.preventDefault();
      }
      btn.classList.remove("bright-dragging");
      this._clockEventDragEventId = null;
      this._clockEventDragOrigin = null;
      this._clockBrightDragging = false;
      this._endBrightnessScrub();
    };
    btn.addEventListener("pointerdown", onDown);
    btn.addEventListener("pointermove", onMove);
    btn.addEventListener("pointerup", onUp);
    btn.addEventListener("pointercancel", onUp);
  },

  _clockMagnetEvents() {
    return (this._sunPath?.events || []).filter(
      (event) => event?.seconds != null
    );
  },

  _nearestClockMagnet(seconds) {
    let best = null;
    let bestAbs = Infinity;
    for (const event of this._clockMagnetEvents()) {
      const delta = this._shortestSecondsDelta(seconds, event.seconds);
      const abs = Math.abs(delta);
      if (abs < bestAbs) {
        bestAbs = abs;
        best = { event, delta, abs };
      }
    }
    return best;
  },

  /** Snap to a solar event only when the pointer is within the capture window. */
  _clockSnapTargetSeconds(pointerSeconds) {
    const nearest = this._nearestClockMagnet(pointerSeconds);
    if (nearest && nearest.abs <= CLOCK_SNAP_CAPTURE_SEC) {
      return nearest.event.seconds;
    }
    return pointerSeconds;
  },

  _bindClockSunDrag(face, handles) {
    const applyLive = (seconds) => {
      this._hoverSeconds = seconds;
      this._clockStickySeconds = seconds;
      this._applyClockSunAppearance(seconds);
      this._fillHoverReadout(seconds, { hovering: true, paintLights: false });
      this._scheduleScenePreviewApply({
        transition: SCENE_PLAY_TRANSITION_SEC,
      });
    };
    const onMove = (ev) => {
      if (!this._clockPointerArmed) {
        return;
      }
      const origin = this._clockPointerOrigin;
      if (origin) {
        const dist = Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y);
        if (dist >= CLOCK_DRAG_CLICK_PX) {
          if (!this._clockSunDragging) {
            this._stopScenePlayBecauseTimeChanged();
          }
          this._clockSunDragging = true;
        }
      }
      if (!this._clockSunDragging) {
        return;
      }
      this._pendingClockHover = { clientX: ev.clientX, clientY: ev.clientY };
      if (this._clockHoverRaf) {
        return;
      }
      this._clockHoverRaf = window.requestAnimationFrame(() => {
        this._clockHoverRaf = undefined;
        if (!this._pendingClockHover || !this._clockSunDragging) {
          return;
        }
        const pointer = this._secondsFromClockPointer(
          this._pendingClockHover,
          face
        );
        applyLive(pointer);
      });
    };
    const onUp = (ev) => {
      if (!this._clockPointerArmed) {
        return;
      }
      this._clockPointerArmed = false;
      this._pendingClockHover = undefined;
      if (this._clockHoverRaf) {
        window.cancelAnimationFrame(this._clockHoverRaf);
        this._clockHoverRaf = undefined;
      }
      const wasDragging = this._clockSunDragging;
      this._clockSunDragging = false;
      try {
        ev.currentTarget.releasePointerCapture?.(ev.pointerId);
      } catch {
        /* already released */
      }
      if (!wasDragging) {
        // Click — return to wall-clock now.
        this._resetClockSunToNow();
        return;
      }
      const pointer = this._secondsFromClockPointer(ev, face);
      const finalSeconds = this._clockSnapTargetSeconds(pointer);
      this._cancelClockSunArc();
      this._clockStickySeconds = finalSeconds;
      this._hoverSeconds = undefined;
      this._clockSunLive = false;
      // Snap only after release: 1s quintic ease-out (same curve as event pin).
      if (
        Math.abs(
          this._shortestSecondsDelta(
            this._clockSunDisplayedSeconds ?? pointer,
            finalSeconds
          )
        ) >= 1
      ) {
        this._moveClockSunTo(finalSeconds, { durationMs: CLOCK_SUN_MOVE_MS });
      } else {
        this._applyClockSunAppearance(finalSeconds);
      }
      this._fillHoverReadout(finalSeconds, { hovering: false });
      this._scheduleScenePreviewApply({
        force: true,
        transition: SCENE_PLAY_TRANSITION_SEC,
      });
      if (this._clockCloseSidebarAfterDrag) {
        this._clockCloseSidebarAfterDrag = false;
        this._closeSceneSidebar({ animate: true });
      }
    };
    const onDown = (ev) => {
      if (ev.button != null && ev.button !== 0) {
        return;
      }
      ev.preventDefault();
      ev.stopPropagation();
      this._clockPointerArmed = true;
      this._clockSunDragging = false;
      this._clockCloseSidebarAfterDrag = false;
      this._clockPointerOrigin = { x: ev.clientX, y: ev.clientY };
      this._cancelClockSunArc();
      this._clockSunLive = true;
      ev.currentTarget.setPointerCapture?.(ev.pointerId);
    };
    for (const el of handles) {
      if (!el) {
        continue;
      }
      el.addEventListener("pointerdown", onDown);
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);
    }
  }
};
