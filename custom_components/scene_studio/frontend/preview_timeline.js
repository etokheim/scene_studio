/* preview timeline owns these panel methods.
 * The receiver is the panel: navigation, rendering and saving remain host hooks.
 * Keep closures bound to that receiver; do not bind methods to a separate object. */
import { formatLatLng } from "./location_helpers.js";
import { CLOCK_LANDSCAPE_SCRUB_MIN_WIDTH_PX, PREVIEW_REFINE_MS } from "./panel_constants.js";
import {
  isoYear,
  daysInYear,
  dayOfYear,
  isoFromDayOfYear,
  todayIso,
  formatPreviewDayMonth,
} from "./editor_session.js";
import {
  renderSceneUsed,
  renderPaletteUsed,
  renderLibraryUsedBy,
  renderThemePresetSource,
} from "./landing.js";

export const previewTimelineMethods = {
  _buildDateToolbar() {
    const toolbar = document.createElement("div");
    toolbar.className = "sun-toolbar";

    const year = new Date().getFullYear();
    const presets = [
      ["Today", todayIso()],
      ["21 Jun", `${year}-06-21`],
      ["21 Dec", `${year}-12-21`],
    ];
    const chipRow = document.createElement("div");
    chipRow.className = "sun-chip-row";
    for (const [name, value] of presets) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "sun-chip";
      chip.textContent = name;
      chip.addEventListener("click", () => {
        this._setPreviewDate(value);
      });
      chipRow.appendChild(chip);
    }

    // Visually hidden HA date field — opened from the day/month label click.
    const pickerHost = document.createElement("div");
    pickerHost.className = "sun-date-picker-host";
    pickerHost.setAttribute("aria-hidden", "true");
    const picker = document.createElement("ha-selector");
    picker.hass = this._hass;
    picker.label = "Date";
    picker.required = true;
    picker.selector = { date: {} };
    picker.value = this._previewDate;
    picker.addEventListener("value-changed", (ev) => {
      const value = ev.detail?.value;
      if (!value || value === this._previewDate) {
        return;
      }
      this._setPreviewDate(value);
    });
    pickerHost.appendChild(picker);

    const dateBtn = document.createElement("div");
    dateBtn.className = "sun-scrub-date";
    dateBtn.setAttribute("role", "button");
    dateBtn.setAttribute("aria-label", "Choose preview date");
    dateBtn.tabIndex = 0;
    const dateLabel = document.createElement("span");
    dateLabel.className = "sun-scrub-date-label";
    const dateReset = document.createElement("ha-icon");
    dateReset.className = "sun-scrub-date-reset";
    dateReset.setAttribute("icon", "mdi:restore");
    dateReset.hidden = true;
    dateBtn.append(dateLabel, dateReset, pickerHost);
    const onDateActivate = () => {
      if (this._previewDate !== todayIso()) {
        this._setPreviewDate(todayIso());
        return;
      }
      this._openPreviewDatePicker();
    };
    dateBtn.addEventListener("click", onDateActivate);
    dateBtn.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" && ev.key !== " ") {
        return;
      }
      ev.preventDefault();
      onDateActivate();
    });

    const dateTools = document.createElement("div");
    dateTools.className = "sun-date-tools";
    // Chips first: left of the date in portrait/table row; above the date in
    // the landscape rail (column + align-end).
    dateTools.append(chipRow, dateBtn);

    const scrubBlock = document.createElement("div");
    scrubBlock.className = "sun-scrub-block";
    scrubBlock.append(dateTools, this._buildYearScrub());

    this._datePicker = picker;
    this._dateChips = chipRow.querySelectorAll(".sun-chip");
    this._scrubDateBtn = dateBtn;
    this._scrubDateLabel = dateLabel;
    this._scrubDateReset = dateReset;
    this._dateTools = dateTools;
    this._chipRow = chipRow;
    this._scrubBlock = scrubBlock;
    // Location banner is in .page-banners (wired in first render), not toolbar.
    toolbar.append(scrubBlock);
    this._syncLocationToolbar();
    this._syncScrubDateLabel();
    return toolbar;
  },

  _syncScrubDateLabel() {
    if (!this._scrubDateLabel) {
      return;
    }
    const otherDay = this._previewDate !== todayIso();
    this._scrubDateLabel.textContent = formatPreviewDayMonth(this._previewDate);
    if (this._scrubDateReset) {
      this._scrubDateReset.hidden = !otherDay;
    }
    if (this._scrubDateBtn) {
      this._scrubDateBtn.classList.toggle("is-other-day", otherDay);
      const choose = this._t(
        "frontend.actions.choose_preview_date",
        "Choose preview date"
      );
      const back = this._t("frontend.actions.back_to_today", "Back to today");
      this._scrubDateBtn.title = otherDay ? back : this._previewDate;
      this._scrubDateBtn.setAttribute("aria-label", otherDay ? back : choose);
    }
  },

  _syncLocationToolbar() {
    const active = Boolean(this._previewLocation);
    if (this._locationBtn) {
      this._locationBtn.hidden = active;
    }
    if (this._locationBanner) {
      this._locationBanner.hidden = !active;
    }
    this._syncPageBannersVisibility();
    if (this._locationCoords && this._previewLocation) {
      this._locationCoords.textContent = formatLatLng(
        this._previewLocation.latitude,
        this._previewLocation.longitude
      );
    }
    const homeName = this._hass?.config?.location_name || "home";
    if (this._locationBanner) {
      const reset = this._locationBanner.querySelector("ha-icon-button");
      if (reset) {
        reset.label = `Use ${homeName} location`;
      }
    }
  },

  _buildYearScrub() {
    const scrub = document.createElement("div");
    scrub.className = "sun-year-scrub";
    scrub.tabIndex = 0;
    scrub.setAttribute("role", "slider");
    scrub.setAttribute("aria-label", "Preview day");
    const months = document.createElement("div");
    months.className = "sun-year-months";
    const track = document.createElement("div");
    track.className = "sun-year-track";
    const bar = document.createElement("div");
    bar.className = "sun-year-bar";
    const fill = document.createElement("div");
    fill.className = "sun-year-fill";
    const todayMark = document.createElement("div");
    todayMark.className = "sun-year-today";
    const thumb = document.createElement("div");
    thumb.className = "sun-year-thumb";
    track.append(bar, fill, todayMark, thumb);
    scrub.append(months, track);

    const dateFromEvent = (ev) => {
      const rect = track.getBoundingClientRect();
      const vertical = scrub.classList.contains("vertical");
      const t = vertical
        ? rect.height
          ? (ev.clientY - rect.top) / rect.height
          : 0
        : rect.width
          ? (ev.clientX - rect.left) / rect.width
          : 0;
      const year = isoYear(this._previewDate);
      const days = daysInYear(year);
      const dayIndex = Math.max(0, Math.min(days - 1, Math.floor(t * days)));
      return isoFromDayOfYear(year, dayIndex);
    };
    const applyPointer = (ev) => {
      this._setPreviewDate(dateFromEvent(ev), { debounce: true });
    };

    scrub.addEventListener("pointerdown", (ev) => {
      if (ev.button != null && ev.button !== 0) {
        return;
      }
      ev.preventDefault();
      // Do not focus on pointer — :focus-visible still rings in some browsers
      // after programmatic focus from click. Tab / arrows keep working via tabindex.
      scrub.setPointerCapture(ev.pointerId);
      this._yearScrubbing = true;
      this._stopScenePlayBecauseTimeChanged();
      applyPointer(ev);
    });
    scrub.addEventListener("pointermove", (ev) => {
      if (!scrub.hasPointerCapture(ev.pointerId)) {
        return;
      }
      this._pendingScrubPoint = { clientX: ev.clientX, clientY: ev.clientY };
      if (this._scrubRaf) {
        return;
      }
      this._scrubRaf = window.requestAnimationFrame(() => {
        this._scrubRaf = undefined;
        if (!this._yearScrubbing || !this._pendingScrubPoint) {
          return;
        }
        applyPointer(this._pendingScrubPoint);
      });
    });
    const endScrub = (ev) => {
      if (!this._yearScrubbing) {
        return;
      }
      this._yearScrubbing = false;
      if (this._scrubRaf) {
        window.cancelAnimationFrame(this._scrubRaf);
        this._scrubRaf = undefined;
      }
      if (this._pendingScrubPoint) {
        applyPointer(this._pendingScrubPoint);
        this._pendingScrubPoint = undefined;
      }
      if (ev?.pointerId != null && scrub.hasPointerCapture(ev.pointerId)) {
        scrub.releasePointerCapture(ev.pointerId);
      }
      this._syncDateToolbar();
      this._syncYearScrubLayout();
      this._pathMorphMs = PREVIEW_REFINE_MS;
      this._ensureSunPath().then(() => this._resumeRoomPreviewIfPreferred());
    };
    scrub.addEventListener("pointerup", endScrub);
    scrub.addEventListener("pointercancel", endScrub);
    scrub.addEventListener("keydown", (ev) => {
      const year = isoYear(this._previewDate);
      if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") {
        ev.preventDefault();
        this._shiftPreviewDate(-1);
      } else if (ev.key === "ArrowRight" || ev.key === "ArrowUp") {
        ev.preventDefault();
        this._shiftPreviewDate(1);
      } else if (ev.key === "PageDown") {
        ev.preventDefault();
        this._shiftPreviewDate(30);
      } else if (ev.key === "PageUp") {
        ev.preventDefault();
        this._shiftPreviewDate(-30);
      } else if (ev.key === "Home") {
        ev.preventDefault();
        this._setPreviewDate(`${year}-01-01`);
      } else if (ev.key === "End") {
        ev.preventDefault();
        this._setPreviewDate(`${year}-12-31`);
      }
    });

    this._yearScrub = scrub;
    this._yearMonths = months;
    this._yearFill = fill;
    this._yearTodayMark = todayMark;
    this._yearThumb = thumb;
    this._yearMonthsYear = undefined;
    return scrub;
  },

  _syncDateToolbar() {
    if (this._datePicker) {
      this._datePicker.hass = this._hass;
      this._datePicker.value = this._previewDate;
    }
    const year = new Date().getFullYear();
    const presets = [todayIso(), `${year}-06-21`, `${year}-12-21`];
    this._dateChips?.forEach((chip, index) => {
      if (presets[index] === this._previewDate) {
        chip.setAttribute("selected", "");
      } else {
        chip.removeAttribute("selected");
      }
    });
    this._syncScrubDateLabel();
    this._syncLocationToolbar();
    this._syncYearScrub();
  },

  _syncYearScrub() {
    if (!this._yearScrub) {
      return;
    }
    const iso = this._previewDate;
    const year = isoYear(iso);
    const days = daysInYear(year);
    const dayIndex = dayOfYear(iso);
    const thumbT = ((dayIndex + 0.5) / days) * 100;
    const vertical = this._yearScrub.classList.contains("vertical");
    if (vertical) {
      this._yearThumb.style.left = "";
      this._yearThumb.style.top = `${thumbT}%`;
      this._yearFill.style.width = "";
      this._yearFill.style.height = `${thumbT}%`;
    } else {
      this._yearThumb.style.top = "";
      this._yearThumb.style.left = `${thumbT}%`;
      this._yearFill.style.height = "";
      this._yearFill.style.width = `${thumbT}%`;
    }
    this._yearScrub.setAttribute("aria-valuemin", "1");
    this._yearScrub.setAttribute("aria-valuemax", String(days));
    this._yearScrub.setAttribute("aria-valuenow", String(dayIndex + 1));
    this._yearScrub.setAttribute("aria-valuetext", iso);
    this._yearScrub.setAttribute(
      "aria-orientation",
      vertical ? "vertical" : "horizontal"
    );
    this._yearScrub.title = iso;

    const today = todayIso();
    if (isoYear(today) === year) {
      this._yearTodayMark.hidden = false;
      const todayT = ((dayOfYear(today) + 0.5) / days) * 100;
      if (vertical) {
        this._yearTodayMark.style.left = "";
        this._yearTodayMark.style.top = `${todayT}%`;
      } else {
        this._yearTodayMark.style.top = "";
        this._yearTodayMark.style.left = `${todayT}%`;
      }
    } else {
      this._yearTodayMark.hidden = true;
    }

    if (this._yearMonthsYear === year && this._yearMonthsVertical === vertical) {
      return;
    }
    this._yearMonthsYear = year;
    this._yearMonthsVertical = vertical;
    const locale = this._hass?.locale?.language || this._hass?.language || "en";
    this._yearMonths.replaceChildren();
    for (let month = 0; month < 12; month += 1) {
      const label = document.createElement("span");
      label.textContent = new Date(year, month, 1).toLocaleDateString(locale, {
        month: "short",
      });
      const startDay = dayOfYear(`${year}-${String(month + 1).padStart(2, "0")}-01`);
      const pos = (startDay / days) * 100;
      if (vertical) {
        label.style.left = "auto";
        label.style.right = "0";
        label.style.top = `${pos}%`;
        if (month === 0) {
          label.style.transform = "none";
        } else if (month === 11) {
          label.style.transform = "translateY(-100%)";
        } else {
          label.style.transform = "translateY(-50%)";
        }
      } else {
        label.style.right = "";
        label.style.top = "";
        label.style.left = `${pos}%`;
        if (month === 0) {
          label.style.transform = "none";
        } else if (month === 11) {
          label.style.transform = "translateX(-100%)";
        } else {
          label.style.transform = "translateX(-50%)";
        }
      }
      this._yearMonths.appendChild(label);
    }
  },

  _isLandscape() {
    return Boolean(this._landscapeMq?.matches) ||
      window.matchMedia("(orientation: landscape)").matches;
  },

  /** Wide enough for the dual-gutter landscape scrub rail. */
  _landscapeScrubFits() {
    return window.matchMedia(
      `(min-width: ${CLOCK_LANDSCAPE_SCRUB_MIN_WIDTH_PX}px)`
    ).matches;
  },

  _sceneSidebarIsOpen() {
    const el = this.shadowRoot?.querySelector(".scene-sidebar");
    if (!el || el._closing) {
      return false;
    }
    if (el.localName === "ha-bottom-sheet") {
      return Boolean(el.open);
    }
    return el.classList.contains("open");
  },

  _ensureToolbarChrome() {
    if (this._toolbarChrome?.isConnected) {
      return this._toolbarChrome;
    }
    const chrome = document.createElement("div");
    chrome.className = "sun-toolbar-chrome";
    this._toolbarChrome = chrome;
    return chrome;
  },

  _placeDateWithReadout() {
    if (!this._dateTools || !this._scrubDateBtn) {
      return;
    }
    const row = [this._scrubDateBtn];
    if (this._hoverReadout) {
      row.push(this._hoverReadout);
    }
    this._dateTools.replaceChildren(...row);
  },

  _dialChromeOverlaysFace() {
    return (
      !this._isEditorNarrow() &&
      Boolean(this._sunPathStage?.classList.contains("landscape-clock-scrub"))
    );
  },

  _syncYearScrubLayout() {
    if (!this._yearScrub || !this._dateToolbar || !this._scrubBlock) {
      return;
    }
    const shell = this._sharedEditorShell;
    if (shell?.el.isConnected && this._isDialView()) {
      if (this._yearScrubbing) return;
      const vertical = shell.el.clientWidth >= shell.el.clientHeight;
      shell.el.dataset.timeline = vertical ? "vertical" : "horizontal";
      shell.timeline.hidden = false;
      if (this._yearScrub.parentNode !== shell.timeline) shell.timeline.replaceChildren(this._yearScrub);
      this._yearScrub.classList.toggle("vertical", vertical);
      this._yearScrub.setAttribute("aria-hidden", "false");
      this._clockScrubRail.hidden = true;
      this._sunPathStage?.classList.remove("landscape-clock-scrub", "scrub-collapsed");
      const chrome = this._ensureToolbarChrome();
      this._chipRow.hidden = false;
      this._scrubDateBtn.hidden = false;
      this._dateTools.replaceChildren(this._chipRow, this._scrubDateBtn);
      chrome.replaceChildren(...[this._hoverReadout, this._dateTools].filter(Boolean));
      this._dateToolbar.replaceChildren(chrome);
      this._syncYearScrub();
      this._syncSceneUsed();
      return;
    }
    // Keep the scrub node where it is while dragging so pointer capture and
    // axis stay stable across preview redraws.
    if (this._yearScrubbing) {
      return;
    }
    const landscape = this._isLandscape();
    const clock =
      this._isDialView() &&
      Boolean(this._clockScrubRail) &&
      Boolean(this.shadowRoot?.querySelector(".sun-light-clock-face"));
    const sidebarOpen = this._sceneSidebarIsOpen();
    // Portrait chrome below this width — empty left rail reads as a black bar.
    const landscapeClock = landscape && clock && this._landscapeScrubFits();
    // The drawer owns the right-side space while open; the face FLIP absorbs
    // this rail collapse into the same smooth scale/translation.
    const collapse = landscapeClock && sidebarOpen;
    const hideToolbarScrub = landscape && sidebarOpen && !clock;

    this._yearScrub.classList.toggle("vertical", landscapeClock);
    this._sunPathStage?.classList.toggle("landscape-clock-scrub", landscapeClock);
    this._sunPathStage?.classList.toggle("scrub-collapsed", collapse);
    this._yearScrub.setAttribute("aria-hidden", collapse || hideToolbarScrub ? "true" : "false");
    if (this._scrubDateBtn) {
      this._scrubDateBtn.hidden = collapse || hideToolbarScrub;
    }
    if (this._chipRow) {
      this._chipRow.hidden = collapse || hideToolbarScrub;
    }

    if (landscapeClock) {
      this._clockScrubRail.hidden = false;
      // Stay in the rail while collapsed so width can animate; do not use hidden.
      this._scrubBlock.hidden = false;
      if (this._scrubBlock.parentNode !== this._clockScrubRail) {
        this._clockScrubRail.appendChild(this._scrubBlock);
      }
      if (this._narrow) {
        // Chips are hidden. Now and sun angle sit on the date row.
        this._toolbarChrome?.remove();
        this._placeDateWithReadout();
      } else {
        // Time + date chips stay in the stage toolbar (full column). The rail
        // only holds the date label and year slider beside the face.
        const chrome = this._ensureToolbarChrome();
        [...chrome.querySelectorAll(".sun-hover-readout")].forEach((el) => {
          if (el !== this._hoverReadout) {
            el.remove();
          }
        });
        if (this._hoverReadout && this._hoverReadout.parentNode !== chrome) {
          chrome.appendChild(this._hoverReadout);
        }
        if (this._chipRow && this._chipRow.parentNode !== chrome) {
          chrome.appendChild(this._chipRow);
        }
        if (chrome.parentNode !== this._dateToolbar) {
          this._dateToolbar.insertBefore(chrome, this._dateToolbar.firstChild);
        }
        if (this._dateTools && this._scrubDateBtn) {
          this._dateTools.replaceChildren(this._scrubDateBtn);
        }
      }
    } else {
      this._sunPathStage?.classList.remove("scrub-collapsed");
      if (this._clockScrubRail) {
        this._clockScrubRail.hidden = true;
        this._clockScrubRail.style.height = "";
        this._clockScrubRail.style.paddingBottom = "";
        this._clockScrubRail.style.marginTop = "";
        this._clockScrubRail.style.top = "";
        this._clockScrubRail.style.left = "";
      }
      if (this._scrubBlock.parentNode !== this._dateToolbar) {
        this._dateToolbar.appendChild(this._scrubBlock);
      }
      this._scrubBlock.hidden = hideToolbarScrub;
      this._yearScrub.classList.remove("vertical");

      if (clock && this._narrow) {
        this._toolbarChrome?.remove();
        this._placeDateWithReadout();
      } else if (clock) {
        // Portrait dial: time/sun + chips in one wrapping chrome row; date +
        // year scrub below (in-flow so the timeline pushes the dial down).
        const chrome = this._ensureToolbarChrome();
        [...chrome.querySelectorAll(".sun-hover-readout")].forEach((el) => {
          if (el !== this._hoverReadout) {
            el.remove();
          }
        });
        if (this._hoverReadout && this._hoverReadout.parentNode !== chrome) {
          chrome.appendChild(this._hoverReadout);
        }
        if (this._chipRow && this._chipRow.parentNode !== chrome) {
          chrome.appendChild(this._chipRow);
        }
        if (chrome.parentNode !== this._dateToolbar) {
          this._dateToolbar.insertBefore(chrome, this._scrubBlock);
        }
        if (this._dateTools && this._scrubDateBtn) {
          this._dateTools.replaceChildren(this._scrubDateBtn);
        }
      } else {
        // Table / list chart: chips with date; readout stays in the body.
        if (this._toolbarChrome) {
          this._toolbarChrome.remove();
        }
        if (
          this._hoverReadout &&
          this._sunPathBodyEl &&
          this._hoverReadout.parentNode !== this._sunPathBodyEl
        ) {
          this._sunPathBodyEl.insertBefore(
            this._hoverReadout,
            this._sunPathBodyEl.firstChild
          );
        }
        if (this._dateTools && this._chipRow && this._scrubDateBtn) {
          this._dateTools.append(this._scrubDateBtn, this._chipRow);
        }
      }
    }
    this._syncYearScrub();
    if (
      this._toolbarChrome?.isConnected &&
      (this._view === "theme" ||
        (this._view === "edit" && this._formData?.kind !== "simple"))
    ) {
      this._syncSceneUsed();
    }
    if (landscapeClock) {
      requestAnimationFrame(() => this._alignYearScrubRail());
    }
    // Portrait timeline is in-flow — remeasure face budget after chrome settles.
    requestAnimationFrame(() => this._syncDialHeightBudget(landscapeClock));
  },

  _syncDialHeightBudget(landscapeClock) {
    const path = this._sunPathEl;
    if (!path) {
      return;
    }
    if (!path.classList.contains("dial-view")) {
      path.style.removeProperty("--dial-timeline-h");
      path.style.removeProperty("--dial-face-max");
      path.style.removeProperty("--dial-banner-h");
      return;
    }
    // Toolbar (time + chips; portrait also date + year scrub) is in-flow so
    // the face shrinks, then scrolls at DIAL_FACE_MIN. Landscape year rail
    // sits beside the face (not in the toolbar).
    let toolbarH = 0;
    if (this._dateToolbar?.isConnected && !this._dialChromeOverlaysFace()) {
      toolbarH = Math.ceil(this._dateToolbar.getBoundingClientRect().height) || 0;
    }
    path.style.setProperty("--dial-timeline-h", `${toolbarH}px`);

    // Draft/location banners live in .stage-col above the scrollport.
    // Face size (fits light tiles, same floor as the color wheel) is _syncStageFaceMax.
    const hostRect = this.getBoundingClientRect();
    const pathTop = path.getBoundingClientRect().top;
    const vignetteReach = Math.max(0, Math.round(pathTop - hostRect.top));
    path.style.setProperty("--dial-banner-h", `${vignetteReach}px`);
    this._syncStageFaceMax();
    // Face size may have changed — re-align landscape rail / chrome next frame.
    requestAnimationFrame(() => this._alignYearScrubRail());
  },

  _alignYearScrubRail() {
    if (this._sharedEditorShell?.el.isConnected) return;
    if (
      !this._clockScrubRail ||
      this._clockScrubRail.hidden ||
      !this._sunPathStage?.classList.contains("landscape-clock-scrub")
    ) {
      return;
    }
    const face = this.shadowRoot?.querySelector(".sun-light-clock-face");
    if (!face) {
      return;
    }
    const faceRect = face.getBoundingClientRect();
    if (!faceRect.height) {
      return;
    }
    // Match the dial height; grid columns handle horizontal centering.
    // Pad the bottom so the Save FAB does not cover the year scrub track.
    let padBottom = 0;
    const fab = this._fabEl;
    if (fab && !fab.hidden) {
      const fabRect = fab.getBoundingClientRect();
      const railRect = this._clockScrubRail.getBoundingClientRect();
      if (
        fabRect.height > 0 &&
        fabRect.left < railRect.right &&
        fabRect.right > railRect.left &&
        fabRect.top < faceRect.bottom
      ) {
        padBottom = Math.max(0, faceRect.bottom - fabRect.top + 12);
      }
    }
    this._clockScrubRail.style.height = `${faceRect.height}px`;
    this._clockScrubRail.style.paddingBottom = padBottom ? `${padBottom}px` : "";
    this._clockScrubRail.style.top = "";
    this._clockScrubRail.style.left = "";
    this._clockScrubRail.style.marginTop = "";
  },

  _ensureHoverReadout() {
    if (this._hoverReadout) {
      return this._hoverReadout;
    }
    const readout = document.createElement("div");
    readout.className = "sun-hover-readout";
    readout.setAttribute("aria-live", "polite");
    this._hoverReadout = readout;
    return readout;
  },

  _presetControlsHost(editor) {
    const shell = this._sharedEditorShell;
    return editor && shell?.preview.contains(editor) ? shell.toolbar : editor;
  },

  _replaceSceneUsed(host, strip) {
    // Responsive layout briefly detaches the readout. A document query cannot
    // see its existing controls then; reconcile its own children first.
    const rows = [...(host?.querySelectorAll(":scope > .scene-used") || [])];
    const previous = rows.shift();
    rows.forEach(row => row.remove());
    for (const row of this.shadowRoot?.querySelectorAll(".scene-used") || []) {
      if (row !== previous && !row.closest(".editor-preview-exit")) row.remove();
    }
    if (!host || !strip) previous?.remove();
    else if (previous) previous.replaceWith(strip);
    else host.insertBefore(strip, host.querySelector(":scope > .sun-time-row"));
  },

  _syncSceneUsed() {
    if (this._view === "theme") {
      const strip = renderThemePresetSource(this);
      const host = this._hoverReadout || this._toolbarChrome;
      this._replaceSceneUsed(host, strip);
      this._syncLibraryUsedBy();
      return;
    }
    if (this._view === "palette") {
      const strip = renderPaletteUsed(this);
      const host = this._presetControlsHost(this.shadowRoot?.querySelector(".simple-editor"));
      this._replaceSceneUsed(host, strip);
      this._syncLibraryUsedBy();
      return;
    }
    const strip = renderSceneUsed(this);
    const simple =
      this._view === "edit" && this._formData?.kind === "simple"
        ? this.shadowRoot?.querySelector(".simple-editor")
        : null;
    const chrome = this._toolbarChrome;
    const host =
      this._presetControlsHost(simple) ||
      (this._view === "edit" && this._formData?.kind !== "simple" ? (this._hoverReadout || chrome) : null);
    this._replaceSceneUsed(host, strip);
    this._syncLibraryUsedBy();
  },

  _syncLibraryUsedBy() {
    // The scene editor's "Uses N presets" row shares this class. Leave it.
    for (const row of this.shadowRoot?.querySelectorAll(
      ".library-used-by:not(.scene-preset-uses)"
    ) || []) {
      row.remove();
    }
    let kind = null;
    let id = null;
    let host = null;
    if (this._view === "theme" && this._themeId) {
      kind = "theme";
      id = this._themeId;
      host = this._hoverReadout || this._toolbarChrome;
    } else if (this._view === "palette" && this._variableId) {
      kind = "palette";
      id = this._variableId;
      host = this._presetControlsHost(this.shadowRoot?.querySelector(".simple-editor"));
    } else if (this._view === "variable" && this._variableId) {
      kind = "variable";
      id = this._variableId;
      host = this.shadowRoot?.querySelector(".library-editor");
    }
    if (!kind || !id || !host) {
      return;
    }
    const row = renderLibraryUsedBy(this, { kind, id });
    if (!row) {
      return;
    }
    const used = host.querySelector(":scope > .scene-used");
    if (used) {
      used.appendChild(row);
      return;
    }
    if (this._view === "theme") {
      host.append(row);
    } else {
      host.prepend(row);
    }
  }
};
