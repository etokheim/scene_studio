/* panel dialogs owns these panel methods.
 * The receiver is the panel: navigation, rendering and saving remain host hooks.
 * Keep closures bound to that receiver; do not bind methods to a separate object. */
import { DOMAIN } from "./panel_constants.js";
import { mergeFields, useSavedField } from "./collaboration.js";
import { draftRgb, applyVariableToDraft } from "./color_ui.js";
import {
  galleryAsPalette,
  galleryCopyName,
  galleryCoverUrl,
  galleryPalette,
  gallerySections,
  galleryTheme,
  galleryThemes,
} from "./gallery.js";
import { paletteSwatchCss, variableIsPalette } from "./palette.js";
import { PALETTE_RANDOMIZE_ICON, createPresetSceneCard, paintThemeDial } from "./landing.js";

export const panelDialogMethods = {
  async _openNameItemDialog() {
    if (this._view === "edit") {
      await this._openSaveDialog({ rename: true });
      return;
    }
    const isTheme = this._view === "theme";
    const current = isTheme
      ? this._themeDraft?.name
      : this._variableDraft?.name;
    const suggested = this._nameIsPlaceholder(current)
      ? this._suggestedLibraryName()
      : current;
    await this._openLibraryRenameDialog({
      title: this._nameFabLabel(),
      value: suggested,
      onSave: async (name) => {
        if (isTheme) {
          if (!this._themeDraft) {
            return;
          }
          this._commitUndo();
          this._themeDraft.name = name;
          await this._saveThemeQuiet();
        } else if (this._variableDraft) {
          this._commitUndo();
          this._variableDraft.name = name;
          await this._saveVariableQuiet();
        }
        this._syncAppBarTitle();
        this._syncNameFab();
      },
    });
  },

  async _openLibraryRenameDialog({ title, value, onSave }) {
    this.shadowRoot.querySelector("ha-dialog.save-dialog")?.remove();
    const dialog = document.createElement("ha-dialog");
    dialog.className = "save-dialog";
    dialog.setAttribute("header-title", title);
    dialog.open = true;
    const nameInput = this._haInput(
      this._t("frontend.common.name", "Name"),
      value || ""
    );
    nameInput.required = true;
    nameInput.setAttribute("autofocus", "");
    dialog.appendChild(nameInput);
    const footer = customElements.get("ha-dialog-footer")
      ? document.createElement("ha-dialog-footer")
      : document.createElement("div");
    footer.slot = "footer";
    const cancel = document.createElement("ha-button");
    cancel.slot = "secondaryAction";
    cancel.appearance = "plain";
    cancel.textContent = this._t("frontend.common.cancel", "Cancel");
    const save = document.createElement("ha-button");
    save.slot = "primaryAction";
    save.variant = "brand";
    save.textContent = this._t("frontend.common.save", "Save");
    cancel.addEventListener("click", () => {
      dialog.open = false;
    });
    save.addEventListener("click", async () => {
      const name = (nameInput.value || "").trim();
      if (!name) {
        nameInput.reportValidity?.();
        return;
      }
      dialog.open = false;
      await onSave(name);
    });
    footer.append(cancel, save);
    dialog.appendChild(footer);
    dialog.addEventListener("closed", () => dialog.remove());
    this.shadowRoot.appendChild(dialog);
  },

  _moveDeletedArea(area) {
    this.shadowRoot.querySelector("ha-dialog.deleted-area-dialog")?.remove();
    const choices = (this._floors || []).flatMap((floor) =>
      (floor.areas || []).filter((item) => !item.deleted && item.id !== area.id)
    );
    const dialog = document.createElement("ha-dialog");
    dialog.className = "deleted-area-dialog";
    dialog.setAttribute("header-title", this._t("frontend.areas.move_title", "Move scenes"));
    dialog.open = true;
    const field = document.createElement("ha-selector");
    field.hass = this._hass;
    field.label = this._t("frontend.areas.target", "Target area");
    field.selector = { select: { mode: "dropdown", options: choices.map((item) => ({ value: item.id, label: item.name })) } };
    let targetId = null;
    field.addEventListener("value-changed", (event) => { targetId = event.detail?.value || null; });
    const errorText = document.createElement("p");
    errorText.style.color = "var(--error-color)";
    errorText.setAttribute("role", "alert");
    const footer = document.createElement("ha-dialog-footer");
    footer.slot = "footer";
    const cancel = document.createElement("ha-button");
    cancel.slot = "secondaryAction";
    cancel.appearance = "plain";
    cancel.textContent = this._loc("ui.common.cancel", "Cancel");
    cancel.addEventListener("click", () => { dialog.open = false; });
    const move = document.createElement("ha-button");
    move.slot = "primaryAction";
    move.variant = "brand";
    move.textContent = this._t("frontend.areas.move", "Move");
    move.addEventListener("click", async () => {
      if (!targetId) return;
      move.disabled = true;
      try {
        const payload = await this._hass.callWS({ type: `${DOMAIN}/move_deleted_area`, area_id: area.id, target_area_id: targetId });
        dialog.open = false;
        if (this._view === "edit" && this._formData?.area === area.id) {
          this._formData.area = targetId;
          this._formData.membership = { exclude: [], include: [] };
          this._clearPreviewCache();
          this._schedulePreview();
        }
        this._applyAreaCatalog(payload);
      } catch (error) {
        errorText.textContent = error.message || String(error);
        move.disabled = false;
      }
    });
    footer.append(cancel, move);
    dialog.append(field, errorText, footer);
    dialog.addEventListener("closed", () => dialog.remove());
    this.shadowRoot.appendChild(dialog);
  },

  _deleteDeletedArea(area, count) {
    this.shadowRoot.querySelector("ha-dialog.deleted-area-dialog")?.remove();
    const dialog = document.createElement("ha-dialog");
    dialog.className = "deleted-area-dialog";
    dialog.setAttribute("header-title", this._t("frontend.areas.delete_title", "Delete scenes?"));
    dialog.open = true;
    const detail = document.createElement("p");
    detail.textContent = this._t("frontend.areas.delete_confirm", "Delete all {count} scenes in {name}?", { count, name: area.name || `${this._t("frontend.areas.unknown", "Deleted area")} (${area.id})` });
    const errorText = document.createElement("p");
    errorText.style.color = "var(--error-color)";
    errorText.setAttribute("role", "alert");
    const footer = document.createElement("ha-dialog-footer");
    footer.slot = "footer";
    const cancel = document.createElement("ha-button");
    cancel.slot = "secondaryAction";
    cancel.appearance = "plain";
    cancel.textContent = this._loc("ui.common.cancel", "Cancel");
    cancel.addEventListener("click", () => { dialog.open = false; });
    const remove = document.createElement("ha-button");
    remove.slot = "primaryAction";
    remove.variant = "danger";
    remove.textContent = this._loc("ui.common.delete", "Delete");
    remove.addEventListener("click", async () => {
      remove.disabled = true;
      try {
        const payload = await this._hass.callWS({ type: `${DOMAIN}/delete_deleted_area`, area_id: area.id });
        dialog.open = false;
        if (this._view === "edit" && this._formData?.area === area.id) {
          this._go("");
        }
        this._applyAreaCatalog(payload);
      } catch (error) {
        errorText.textContent = error.message || String(error);
        remove.disabled = false;
      }
    });
    footer.append(cancel, remove);
    dialog.append(detail, errorText, footer);
    dialog.addEventListener("closed", () => dialog.remove());
    this.shadowRoot.appendChild(dialog);
  },

  _haInput(label, value, { type, min, max } = {}) {
    const field = customElements.get("ha-input")
      ? document.createElement("ha-input")
      : document.createElement("ha-selector");
    field.label = label;
    field.value = value;
    if (field.localName === "ha-selector") {
      field.hass = this._hass;
      field.selector =
        type === "number"
          ? {
              number: {
                min: min ?? 0,
                max: max ?? 8000,
                step: 1,
                mode: "box",
              },
            }
          : { text: {} };
    } else if (type === "number") {
      field.type = "number";
      if (min != null) {
        field.min = min;
      }
      if (max != null) {
        field.max = max;
      }
    }
    return field;
  },

  _chooseSceneTheme({ themeId, allowNone } = {}) {
    return new Promise((resolve) => {
      this.shadowRoot.querySelector("ha-dialog.scene-theme-dialog")?.remove();
      const dialog = document.createElement("ha-dialog");
      dialog.className = "scene-theme-dialog";
      dialog.setAttribute(
        "header-title",
        this._t("frontend.dialogs.scene_theme_select", "Select a circadian preset")
      );
      dialog.open = true;
      let settled = false;
      const finish = (value) => {
        if (settled) {
          return;
        }
        settled = true;
        dialog.open = false;
        resolve(value);
      };
      const list = document.createElement("div");
      list.className = "scene-theme-list";
      const addRow = (id, label, swatch) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "scene-theme-row";
        if ((id || null) === (themeId || null)) {
          button.classList.add("selected");
        }
        if (swatch) {
          button.appendChild(swatch);
        }
        const name = document.createElement("span");
        name.textContent = label;
        button.appendChild(name);
        button.addEventListener("click", () => finish({ themeId: id }));
        list.appendChild(button);
      };
      if (allowNone) {
        addRow(null, this._t("frontend.dialogs.scene_palette_none", "None"), null);
      }
      for (const theme of this._themes || []) {
        const swatch = document.createElement("span");
        swatch.className = "scene-used-swatch";
        paintThemeDial(swatch, theme, this._variables || []);
        addRow(theme.id, theme.name || theme.id, swatch);
      }
      dialog.appendChild(list);
      dialog.addEventListener("closed", () => {
        dialog.remove();
        finish(null);
      });
      this.shadowRoot.appendChild(dialog);
    });
  },

  _chooseScenePalette({ areaId, mode, paletteId } = {}) {
    return new Promise((resolve) => {
      this.shadowRoot.querySelector("ha-dialog.scene-palette-dialog")?.remove();
      const palettes = (this._variables || []).filter((item) =>
        variableIsPalette(item)
      );
      const areaLights = this._areaLightIds(areaId);
      const dialog = document.createElement("ha-dialog");
      dialog.className = "scene-palette-dialog";
      dialog.setAttribute(
        "header-title",
        mode === "edit"
          ? this._t("frontend.dialogs.scene_palette_select", "Select a scene preset")
          : this._t("frontend.dialogs.scene_palette_title", "New scene")
      );
      dialog.open = true;
      let settled = false;
      let selectedKind = mode === "edit" && paletteId ? "user" : null;
      let selectedId = mode === "edit" ? paletteId || null : null;
      let seed = (Math.random() * 0xffffffff) >>> 0;
      let snaps = null;
      const finish = (value) => {
        if (settled) {
          return;
        }
        settled = true;
        dialog.open = false;
        resolve(value);
      };
      const restoreSnaps = async () => {
        if (!snaps) {
          return;
        }
        const prior = snaps;
        snaps = null;
        await Promise.all(
          Object.entries(prior).map(([entityId, stored]) =>
            this._applyLightState(entityId, stored, { transition: 0.4 })
          )
        );
      };
      const selectedPalette = () =>
        selectedKind === "gallery"
          ? galleryAsPalette(selectedId)
          : palettes.find((item) => item.id === selectedId);
      const applyPreview = async () => {
        const palette = selectedPalette();
        if (!this._readRoomPreviewPref() || !palette) {
          await restoreSnaps();
          return;
        }
        if (!snaps) {
          snaps = {};
          for (const entityId of areaLights) {
            snaps[entityId] = this._snapshotLight(entityId);
          }
        }
        await Promise.all(
          areaLights.map((entityId) => {
            const draft = { state: "on", brightness: 200 };
            applyVariableToDraft(draft, palette, {
              entityId,
              seed,
              catalog: this._variables,
            });
            return this._applyLightState(entityId, draft, { transition: 0.4 });
          })
        );
      };
      const hint = document.createElement("p");
      hint.className = "scene-palette-hint";
      hint.textContent = this._t(
        "frontend.dialogs.scene_palette_hint",
        "Create a scene from a preset or start from scratch (current lighting)"
      );
      const liveToggle = document.createElement("label");
      liveToggle.className = "live-edit-toggle";
      const liveLabel = document.createElement("span");
      liveLabel.textContent = this._t(
        "frontend.dialogs.scene_palette_live_preview",
        "Live preview"
      );
      const liveSwitch = document.createElement("ha-switch");
      liveSwitch.checked = this._readRoomPreviewPref();
      liveSwitch.addEventListener("change", () => {
        this._writeRoomPreviewPref(Boolean(liveSwitch.checked));
        this._syncRoomPreviewControl();
        void applyPreview();
      });
      liveToggle.slot = "headerActionItems";
      liveToggle.append(liveLabel, liveSwitch);
      const list = document.createElement("div");
      list.className = "scene-palette-list";
      const rows = [];
      const cards = [];
      const choose = (kind, id) => {
        selectedKind = kind;
        selectedId = id;
        paintSelection();
        void applyPreview();
      };
      const paletteChoiceCard = (name, paint, palette) =>
        createPresetSceneCard({
          name,
          paint,
          asButton: true,
          palette,
          catalog: this._variables,
        });
      const randomizeLabel = () => {
        const label = document.createElement("span");
        label.className = "scene-palette-randomize-label";
        label.hidden = true;
        const icon = document.createElement("ha-icon");
        icon.setAttribute("icon", PALETTE_RANDOMIZE_ICON);
        icon.setAttribute("aria-hidden", "true");
        label.append(
          icon,
          document.createTextNode(
            this._t("frontend.dialogs.scene_palette_randomize", "Randomize")
          )
        );
        return label;
      };
      const randomizeSeed = () => {
        seed = (Math.random() * 0xffffffff) >>> 0;
        void applyPreview();
      };
      const markChoice = (row, on) => {
        row.card.classList.toggle("selected", on);
        row.slot.classList.toggle("glow-on", on);
        if (row.label) {
          row.label.hidden = !on;
        }
      };
      const paintSelection = () => {
        for (const row of rows) {
          markChoice(row, selectedKind === "user" && row.id === selectedId);
        }
        for (const card of cards) {
          markChoice(card, selectedKind === "gallery" && card.id === selectedId);
        }
        const hasPreset = Boolean(selectedKind && selectedPalette());
        if (mode === "edit") {
          useBtn.textContent = hasPreset
            ? this._t("frontend.dialogs.scene_palette_use", "Use this preset")
            : this._t("frontend.dialogs.scene_palette_clear", "Clear preset");
          scratchBtn.textContent = this._t(
            "frontend.dialogs.scene_palette_clear",
            "Clear preset"
          );
        } else {
          useBtn.textContent = this._t(
            "frontend.dialogs.scene_palette_from_preset",
            "Create from this preset"
          );
          useBtn.hidden = !hasPreset;
          scratchBtn.textContent = this._t(
            "frontend.dialogs.scene_palette_start_scratch",
            "Start from scratch"
          );
          scratchBtn.slot = hasPreset ? "secondaryAction" : "primaryAction";
          scratchBtn.appearance = hasPreset ? "plain" : "filled";
          scratchBtn.variant = hasPreset ? "neutral" : "brand";
        }
        scratchBtn.hidden = mode === "edit" && !hasPreset;
        useBtn.disabled = false;
        useBtn.toggleAttribute("disabled", false);
      };
      if (palettes.length) {
        const yours = document.createElement("p");
        yours.className = "scene-gallery-label";
        yours.textContent = this._t(
          "frontend.dialogs.scene_palette_yours",
          "Your scene presets"
        );
        list.appendChild(yours);
      }
      const pictured = palettes.filter((palette) => galleryPalette(palette?.builtin_id));
      const plain = palettes.filter((palette) => !galleryPalette(palette?.builtin_id));
      const onUserPalette = (palette) => {
        if (selectedKind === "user" && selectedId === palette.id) {
          randomizeSeed();
          return;
        }
        choose("user", palette.id);
      };
      const appendPaletteCards = (palettesToShow, paintFor) => {
        if (!palettesToShow.length) {
          return;
        }
        const grid = document.createElement("div");
        grid.className = "scene-cards";
        for (const palette of palettesToShow) {
          const choice = paletteChoiceCard(palette.name, paintFor(palette), palette);
          const label = randomizeLabel();
          choice.card.appendChild(label);
          choice.card.addEventListener("click", () => onUserPalette(palette));
          grid.appendChild(choice.slot);
          rows.push({ id: palette.id, ...choice, label });
        }
        list.appendChild(grid);
      };
      appendPaletteCards(pictured, (palette) => (bg) => {
        const cover = galleryPalette(palette.builtin_id);
        bg.classList.add("is-cover");
        bg.style.backgroundImage = `url("${galleryCoverUrl(cover.id)}")`;
      });
      appendPaletteCards(plain, (palette) => (bg) => {
        bg.style.background = paletteSwatchCss(
          palette,
          this._variables,
          draftRgb
        );
      });
      const adoptedPalettes = new Set(
        (this._variables || []).map((item) => item.builtin_id).filter(Boolean)
      );
      for (const section of gallerySections()) {
        const visible = section.palettes.filter((item) => !adoptedPalettes.has(item.id));
        if (!visible.length) {
          continue;
        }
        const label = document.createElement("p");
        label.className = "scene-gallery-label";
        label.textContent = this._t(section.nameKey, section.name);
        const grid = document.createElement("div");
        grid.className = "scene-cards";
        for (const item of visible) {
          const choice = paletteChoiceCard(
            this._t(item.nameKey, item.name),
            (bg) => {
              bg.classList.add("is-cover");
              bg.style.backgroundImage = `url("${galleryCoverUrl(item.id)}")`;
            },
            galleryAsPalette(item.id)
          );
          const randomLabel = randomizeLabel();
          choice.card.appendChild(randomLabel);
          choice.card.addEventListener("click", () => {
            if (selectedKind === "gallery" && selectedId === item.id) {
              randomizeSeed();
              return;
            }
            choose("gallery", item.id);
          });
          grid.appendChild(choice.slot);
          cards.push({ id: item.id, ...choice, label: randomLabel });
        }
        list.append(label, grid);
      }
      const body = document.createElement("div");
      body.className = "scene-palette-body";
      list.prepend(hint);
      body.append(list);
      dialog.append(liveToggle, body);
      const footer = customElements.get("ha-dialog-footer")
        ? document.createElement("ha-dialog-footer")
        : document.createElement("div");
      footer.slot = "footer";
      const finishScratch = () => {
        void restoreSnaps().then(() => finish({ palette: null }));
      };
      const scratchBtn = document.createElement("ha-button");
      scratchBtn.slot = mode === "edit" ? "secondaryAction" : "primaryAction";
      scratchBtn.appearance = mode === "edit" ? "plain" : "filled";
      scratchBtn.variant = "brand";
      scratchBtn.hidden = mode === "edit";
      scratchBtn.addEventListener("click", () => finishScratch());
      const useBtn = document.createElement("ha-button");
      useBtn.slot = "primaryAction";
      useBtn.variant = "brand";
      useBtn.textContent = mode === "edit"
        ? this._t("frontend.dialogs.scene_palette_clear", "Clear preset")
        : this._t("frontend.dialogs.scene_palette_from_preset", "Create from this preset");
      useBtn.hidden = mode !== "edit";
      useBtn.addEventListener("click", () => {
        if (!selectedKind) {
          finishScratch();
          return;
        }
        const picked = selectedPalette();
        if (!picked) {
          return;
        }
        const done = (palette) => {
          if (mode === "edit") {
            void restoreSnaps().then(() => finish({ palette, seed }));
            return;
          }
          const keepPreview = this._readRoomPreviewPref() && Boolean(snaps);
          finish({
            palette,
            seed,
            snapshots: keepPreview ? snaps : null,
            keepPreview,
          });
          snaps = null;
        };
        if (selectedKind !== "gallery") {
          done(picked);
          return;
        }
        const source = galleryPalette(selectedId);
        void this._hass
          .callWS({
            type: `${DOMAIN}/save_variable`,
            data: {
              name: galleryCopyName(
                this._t(source.nameKey, source.name),
                (this._variables || []).map((item) => item.name)
              ),
              kind: "palette",
              slots: source.slots,
              builtin_id: source.id,
            },
          })
          .then((saved) => {
            const list = [...(this._variables || [])];
            const index = list.findIndex((item) => item.id === saved.id);
            if (index >= 0) {
              list[index] = saved;
            } else {
              list.push(saved);
            }
            this._variables = list;
            done(saved);
          })
          .catch((err) => {
            this._error = err.message || String(err);
          });
      });
      footer.append(scratchBtn, useBtn);
      dialog.appendChild(footer);
      paintSelection();
      dialog.addEventListener("closed", () => {
        dialog.remove();
        if (!settled) {
          void restoreSnaps().then(() => finish(null));
        }
      });
      this.shadowRoot.appendChild(dialog);
    });
  },

  _confirmResetPreset(kind) {
    this.shadowRoot.querySelector("ha-dialog.confirm-dialog")?.remove();
    const dialog = document.createElement("ha-dialog");
    dialog.className = "confirm-dialog";
    dialog.setAttribute(
      "header-title",
      this._t("frontend.library.reset_preset_title", "Reset to preset default?")
    );
    dialog.open = true;
    const text = document.createElement("p");
    text.textContent = this._t(
      "frontend.library.reset_preset_text",
      "This replaces your edits with the original preset. You can undo it afterward."
    );
    dialog.appendChild(text);
    const footer = customElements.get("ha-dialog-footer")
      ? document.createElement("ha-dialog-footer")
      : document.createElement("div");
    footer.slot = "footer";
    const cancel = document.createElement("ha-button");
    cancel.slot = "secondaryAction";
    cancel.appearance = "plain";
    cancel.textContent = this._loc("ui.common.cancel", "Cancel");
    cancel.addEventListener("click", () => {
      dialog.open = false;
    });
    const confirm = document.createElement("ha-button");
    confirm.slot = "primaryAction";
    confirm.textContent = this._t("frontend.library.reset_preset", "Reset to preset default");
    confirm.addEventListener("click", () => {
      dialog.open = false;
      if (kind === "theme") {
        void this._resetThemeToPresetDefault();
        return;
      }
      this._resetPaletteToPresetDefault();
    });
    footer.append(cancel, confirm);
    dialog.appendChild(footer);
    dialog.addEventListener("closed", () => dialog.remove());
    this.shadowRoot.appendChild(dialog);
  },

  _chooseCircadianTheme({ areaId } = {}) {
    return new Promise((resolve) => {
      this.shadowRoot.querySelector("ha-dialog.scene-theme-create-dialog")?.remove();
      const dialog = document.createElement("ha-dialog");
      dialog.className = "scene-palette-dialog scene-theme-create-dialog";
      dialog.setAttribute(
        "header-title",
        this._t("frontend.dialogs.scene_theme_title", "New circadian scene")
      );
      dialog.open = true;
      let settled = false;
      let selectedKind = null;
      let selectedId = null;
      let snaps = null;
      const areaLights = this._areaLightIds(areaId);
      const finish = (value) => {
        if (settled) {
          return;
        }
        settled = true;
        dialog.open = false;
        resolve(value);
      };
      const restoreSnaps = async () => {
        if (!snaps) {
          return;
        }
        const prior = snaps;
        snaps = null;
        await Promise.all(
          Object.entries(prior).map(([entityId, stored]) =>
            this._applyLightState(entityId, stored, { transition: 0.4 })
          )
        );
      };
      const selectedRecord = () =>
        selectedKind === "preset"
          ? galleryTheme(selectedId)
          : (this._themes || []).find((item) => item.id === selectedId);
      const noonDraft = (theme) => {
        const ev = theme?.events?.noon;
        if (!ev) {
          return null;
        }
        const draft = { state: "on", brightness: ev.brightness ?? 200 };
        if (ev.palette) {
          const palette = galleryAsPalette(ev.palette);
          if (!palette) {
            return null;
          }
          applyVariableToDraft(draft, palette, { catalog: this._variables });
          return draft;
        }
        const color = ev.color || {};
        if (color.variable_ref) {
          const variable = (this._variables || []).find(
            (item) => item.id === color.variable_ref
          );
          if (variable) {
            applyVariableToDraft(draft, variable, { catalog: this._variables });
            return draft;
          }
        }
        return { ...draft, ...color };
      };
      const applyPreview = async () => {
        const theme = selectedRecord();
        const draft = noonDraft(theme);
        if (!this._readRoomPreviewPref() || !draft || !areaLights.length) {
          await restoreSnaps();
          return;
        }
        if (!snaps) {
          snaps = {};
          for (const entityId of areaLights) {
            snaps[entityId] = this._snapshotLight(entityId);
          }
        }
        await Promise.all(
          areaLights.map((entityId) =>
            this._applyLightState(entityId, draft, { transition: 0.4 })
          )
        );
      };
      const hint = document.createElement("p");
      hint.className = "scene-palette-hint";
      hint.textContent = this._t(
        "frontend.dialogs.scene_theme_hint",
        "Create a circadian scene from a preset or start from scratch"
      );
      const liveToggle = document.createElement("label");
      liveToggle.className = "live-edit-toggle";
      const liveLabel = document.createElement("span");
      liveLabel.textContent = this._t(
        "frontend.dialogs.scene_palette_live_preview",
        "Live preview"
      );
      const liveSwitch = document.createElement("ha-switch");
      liveSwitch.checked = this._readRoomPreviewPref();
      liveSwitch.addEventListener("change", () => {
        this._writeRoomPreviewPref(Boolean(liveSwitch.checked));
        this._syncRoomPreviewControl();
        void applyPreview();
      });
      liveToggle.slot = "headerActionItems";
      liveToggle.append(liveLabel, liveSwitch);
      const list = document.createElement("div");
      list.className = "scene-palette-list";
      const themes = this._themes || [];
      const rows = [];
      const cards = [];
      const paintCard = (theme) => (bg) => {
        bg.classList.add("theme-dial");
        paintThemeDial(bg, theme, this._variables || []);
      };
      if (themes.length) {
        const yours = document.createElement("p");
        yours.className = "scene-gallery-label";
        yours.textContent = this._t(
          "frontend.dialogs.scene_theme_yours",
          "Your circadian presets"
        );
        const yoursGrid = document.createElement("div");
        yoursGrid.className = "scene-cards";
        for (const theme of themes) {
          const choice = createPresetSceneCard({
            name: theme.name || theme.id,
            paint: paintCard(theme),
            asButton: true,
          });
          choice.card.addEventListener("click", () => choose("user", theme.id));
          yoursGrid.appendChild(choice.slot);
          rows.push({ id: theme.id, ...choice });
        }
        list.append(yours, yoursGrid);
      }
      const adopted = new Set(themes.map((item) => item.builtin_id).filter(Boolean));
      if (themes.some((item) => item.id === "default")) {
        adopted.add("default");
      }
      const presets = galleryThemes().filter((item) => !adopted.has(item.id));
      if (presets.length) {
        const presetsLabel = document.createElement("p");
        presetsLabel.className = "scene-gallery-label";
        presetsLabel.textContent = this._t(
          "frontend.dialogs.scene_theme_presets",
          "Starter presets"
        );
        const grid = document.createElement("div");
        grid.className = "scene-cards";
        for (const preset of presets) {
          const choice = createPresetSceneCard({
            name: this._t(preset.nameKey, preset.name),
            paint: paintCard(preset),
            asButton: true,
          });
          choice.card.addEventListener("click", () => choose("preset", preset.id));
          grid.appendChild(choice.slot);
          cards.push({ id: preset.id, ...choice });
        }
        list.append(presetsLabel, grid);
      }
      const body = document.createElement("div");
      body.className = "scene-palette-body";
      list.prepend(hint);
      body.append(list);
      dialog.append(liveToggle, body);
      const footer = customElements.get("ha-dialog-footer")
        ? document.createElement("ha-dialog-footer")
        : document.createElement("div");
      footer.slot = "footer";
      const finishScratch = () => {
        void restoreSnaps().then(() => finish({ custom: true }));
      };
      const scratchBtn = document.createElement("ha-button");
      scratchBtn.slot = "primaryAction";
      scratchBtn.appearance = "filled";
      scratchBtn.variant = "brand";
      scratchBtn.textContent = this._t(
        "frontend.dialogs.scene_theme_start_scratch",
        "Start from scratch"
      );
      scratchBtn.addEventListener("click", () => finishScratch());
      const useBtn = document.createElement("ha-button");
      useBtn.slot = "primaryAction";
      useBtn.variant = "brand";
      useBtn.textContent = this._t(
        "frontend.dialogs.scene_theme_from_preset",
        "Create from this preset"
      );
      useBtn.hidden = true;
      const markChoice = (row, on) => {
        row.card.classList.toggle("selected", on);
        row.slot.classList.toggle("glow-on", on);
      };
      const choose = (kind, id) => {
        selectedKind = kind;
        selectedId = id;
        paintSelection();
        void applyPreview();
      };
      const paintSelection = () => {
        for (const row of rows) {
          markChoice(row, selectedKind === "user" && row.id === selectedId);
        }
        for (const card of cards) {
          markChoice(card, selectedKind === "preset" && card.id === selectedId);
        }
        const hasPreset = Boolean(selectedKind && selectedRecord());
        useBtn.hidden = !hasPreset;
        scratchBtn.slot = hasPreset ? "secondaryAction" : "primaryAction";
        scratchBtn.appearance = hasPreset ? "plain" : "filled";
        scratchBtn.variant = hasPreset ? "neutral" : "brand";
      };
      useBtn.addEventListener("click", () => {
        if (!selectedKind) {
          finishScratch();
          return;
        }
        const deliver = (value) => {
          const keepPreview = this._readRoomPreviewPref() && Boolean(snaps);
          if (!keepPreview) {
            void restoreSnaps().then(() => finish(value));
            return;
          }
          snaps = null;
          finish(value);
        };
        if (selectedKind === "user") {
          const theme = themes.find((item) => item.id === selectedId);
          if (theme) {
            deliver({ theme });
          }
          return;
        }
        const preset = galleryTheme(selectedId);
        if (preset) {
          deliver({ preset });
        }
      });
      footer.append(scratchBtn, useBtn);
      dialog.appendChild(footer);
      paintSelection();
      dialog.addEventListener("closed", () => {
        dialog.remove();
        if (!settled) {
          void restoreSnaps().then(() => finish(null));
        }
      });
      this.shadowRoot.appendChild(dialog);
    });
  },

  _chooseConflictValues(conflict, localValue) {
    return new Promise((resolve) => {
    this.shadowRoot.querySelector("ha-dialog.scene-conflict-dialog")?.remove();
    const dialog = document.createElement("ha-dialog");
    dialog.className = "scene-conflict-dialog";
    dialog.setAttribute("header-title", this._t("frontend.conflict.title", "Another editor changed this item"));
    const detail = document.createElement("p");
    const mine = document.createElement("pre");
    const theirs = document.createElement("pre");
    let resolved = mergeFields(conflict.base, localValue, conflict.current).value;
    let index = 0;
    const fieldValue = (object, field) => field.split(".").reduce((value, key) => value?.[key], object);
    const show = () => {
      const field = conflict.fields[index];
      detail.textContent = this._t("frontend.conflict.field", "Choose a value for {field}", { field });
      mine.textContent = `${this._t("frontend.conflict.mine", "Your value")}: ${JSON.stringify(fieldValue(resolved, field))}`;
      theirs.textContent = `${this._t("frontend.conflict.saved", "Newly saved value")}: ${JSON.stringify(fieldValue(conflict.current, field))}`;
    };
    let finished = false;
    const finish = () => {
      index += 1;
      if (index < conflict.fields.length) { show(); return; }
      finished = true;
      dialog.open = false;
      resolve(resolved);
    };
    const footer = document.createElement("ha-dialog-footer");
    footer.slot = "footer";
    const local = document.createElement("ha-button");
    local.slot = "secondaryAction";
    local.appearance = "plain";
    local.textContent = this._t("frontend.conflict.use_mine", "Use my value");
    local.addEventListener("click", finish);
    const saved = document.createElement("ha-button");
    saved.slot = "primaryAction";
    saved.variant = "brand";
    saved.textContent = this._t("frontend.conflict.use_saved", "Use newly saved value");
    saved.addEventListener("click", () => {
      resolved = useSavedField(resolved, conflict.current, conflict.fields[index]);
      finish();
    });
    footer.append(local, saved);
    dialog.append(detail, mine, theirs, footer);
    dialog.addEventListener("closed", () => {
      if (!finished && dialog.isConnected) {
        dialog.open = true;
      } else {
        dialog.remove();
      }
    });
    this.shadowRoot.appendChild(dialog);
    show();
    dialog.open = true;
    });
  },

  async _openAddLightPicker(anchor, { simple = false } = {}) {
    const listed = new Set(
      simple
        ? this._simpleMembers || []
        : (this._sunPath?.lights || [])
            .filter((light) => !light.suggested)
            .map((light) => light.entity_id)
    );
    this.shadowRoot.querySelector(".light-add-picker-host")?.remove();
    const host = document.createElement("div");
    host.className = "light-add-picker-host is-menu";
    const search = document.createElement("input");
    search.type = "search";
    search.className = "light-add-menu-search";
    search.placeholder = this._t("frontend.common.search", "Search");
    search.setAttribute(
      "aria-label",
      this._t("frontend.lights.add_light", "Add light")
    );
    const list = document.createElement("div");
    list.className = "light-add-menu-list";
    const choices = this._addLightChoices(listed);
    const paint = () => {
      const query = (search.value || "").trim().toLocaleLowerCase();
      list.replaceChildren();
      let lastArea = null;
      let shown = 0;
      for (const row of choices) {
        const haystack = [row.name, row.friendly, row.deviceName, row.areaName, row.entityId]
          .join(" ")
          .toLocaleLowerCase();
        if (query && !haystack.includes(query)) {
          continue;
        }
        const areaKey = row.areaName || "";
        if (areaKey !== lastArea) {
          lastArea = areaKey;
          const heading = document.createElement("div");
          heading.className = "light-add-menu-area";
          heading.textContent =
            row.areaName || this._t("frontend.common.no_area", "No area");
          list.appendChild(heading);
        }
        const button = document.createElement("button");
        button.type = "button";
        button.className = "light-add-menu-item";
        button.textContent = row.name;
        button.addEventListener("click", () => {
          cleanup();
          if (simple) {
            this._addLightToSimpleMembers(row.entityId);
            return;
          }
          void this._addLightToAssignedScenes(row.entityId);
        });
        list.appendChild(button);
        shown += 1;
      }
      if (!shown) {
        const empty = document.createElement("div");
        empty.className = "light-add-menu-area";
        empty.textContent = this._t("frontend.lights.none", "No lights");
        list.appendChild(empty);
      }
    };
    const cleanup = () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
      host.remove();
    };
    const onPointerDown = (ev) => {
      if (!host.contains(ev.target)) {
        cleanup();
      }
    };
    const onKey = (ev) => {
      if (ev.key === "Escape") {
        cleanup();
      }
    };
    search.addEventListener("input", paint);
    host.append(search, list);
    paint();
    if (anchor?.parentElement) {
      anchor.parentElement.appendChild(host);
    } else {
      this.shadowRoot.appendChild(host);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    search.focus();
  },

  async _openListSceneMetaDialog(scene, { focus } = {}) {
    const form = { ...(scene.form || {}) };
    this.shadowRoot.querySelector("ha-dialog.save-dialog")?.remove();
    const data = {
      scene_name: this._nameIsPlaceholder(form.scene_name || scene.scene_name)
        ? this._suggestedSceneName(scene)
        : form.scene_name || scene.scene_name || this._suggestedSceneName(scene),
      description: form.description || "",
      labels: [...(form.labels || scene.labels || [])],
      category: form.category || scene.category || "",
      icon:
        form.icon ||
        scene.icon ||
        this._hass?.entities?.[scene.entity_id]?.icon ||
        "",
    };
    const dialog = document.createElement("ha-dialog");
    dialog.className = "save-dialog";
    dialog.setAttribute(
      "header-title",
      this._loc("ui.panel.config.scene.editor.rename", "Rename")
    );
    dialog.open = true;
    const nameInput = await this._appendSceneRenameFields(dialog, data, {
      focus,
    });
    const footer = customElements.get("ha-dialog-footer")
      ? document.createElement("ha-dialog-footer")
      : document.createElement("div");
    footer.slot = "footer";
    const cancel = document.createElement("ha-button");
    cancel.slot = "secondaryAction";
    cancel.appearance = "plain";
    cancel.textContent = this._t("frontend.common.cancel", "Cancel");
    const save = document.createElement("ha-button");
    save.slot = "primaryAction";
    save.variant = "brand";
    save.textContent = this._t("frontend.common.save", "Save");
    cancel.addEventListener("click", () => {
      dialog.open = false;
    });
    save.addEventListener("click", async () => {
      const name = (nameInput.value || data.scene_name || "").trim();
      if (!name) {
        nameInput.reportValidity?.();
        return;
      }
      try {
        const saved = await this._saveSceneItem(scene, {
            ...form,
            scene_name: name,
            description: data.description,
            labels: data.labels,
            category: data.category || null,
            icon: data.icon || null,
        });
        dialog.open = false;
        if (this._editId === scene.id && this._formData) {
          this._formData.scene_name = name;
          this._formData.description = data.description;
          this._formData.labels = data.labels;
          this._formData.category = data.category || null;
          this._formData.icon = data.icon || null;
        }
        this._upsertSceneInList(saved);
        this._refreshVisibleSceneList();
        await this._loadList();
      } catch (err) {
        this._error = err.message || String(err);
        dialog.open = false;
        this._renderList();
      }
    });
    footer.append(cancel, save);
    dialog.appendChild(footer);
    dialog.addEventListener("closed", () => dialog.remove());
    this.shadowRoot.appendChild(dialog);
  },

  _confirmDeleteScene(scene) {
    this.shadowRoot.querySelector("ha-dialog.confirm-dialog")?.remove();
    const dialog = document.createElement("ha-dialog");
    dialog.className = "confirm-dialog";
    dialog.setAttribute(
      "header-title",
      this._loc(
        "ui.panel.config.scene.picker.delete_confirm_title",
        "Delete scene?"
      )
    );
    dialog.open = true;
    const displayName = scene.scene_name || scene.name || "Scene";
    const text = document.createElement("p");
    text.textContent = this._loc(
      "ui.panel.config.scene.picker.delete_confirm_text",
      `Are you sure you want to delete ${displayName}?`,
      { name: displayName }
    );
    dialog.appendChild(text);
    const footer = customElements.get("ha-dialog-footer")
      ? document.createElement("ha-dialog-footer")
      : document.createElement("div");
    footer.slot = "footer";
    const cancel = document.createElement("ha-button");
    cancel.slot = "secondaryAction";
    cancel.appearance = "plain";
    cancel.textContent = this._loc("ui.common.cancel", "Cancel");
    cancel.addEventListener("click", () => {
      dialog.open = false;
    });
    const confirm = document.createElement("ha-button");
    confirm.slot = "primaryAction";
    confirm.variant = "danger";
    confirm.textContent = this._loc("ui.common.delete", "Delete");
    confirm.addEventListener("click", async () => {
      dialog.open = false;
      try {
        this._captureAreaRailScroll();
        this._areaRailSkipReveal = true;
        this._invalidatePanelLoads();
        await this._hass.callWS({
          type: `${DOMAIN}/delete`,
          scene_id: scene.id,
        });
        this._dropSceneFromList(scene.id);
        if (this._editId === scene.id) {
          await this._go("");
        } else {
          this._refreshVisibleSceneList();
        }
        await this._loadList();
      } catch (err) {
        this._error = err.message || String(err);
        this._renderList();
      }
    });
    footer.append(cancel, confirm);
    dialog.appendChild(footer);
    dialog.addEventListener("closed", () => dialog.remove());
    this.shadowRoot.appendChild(dialog);
  },

  _renameLibraryItem(kind, item) {
    if (!item?.id || (kind !== "variable" && kind !== "palette")) {
      return;
    }
    this.shadowRoot.querySelector("ha-dialog.confirm-dialog")?.remove();
    const dialog = document.createElement("ha-dialog");
    dialog.className = "confirm-dialog";
    dialog.setAttribute(
      "header-title",
      this._t("frontend.common.rename", "Rename")
    );
    dialog.open = true;
    const field = document.createElement("ha-textfield");
    field.label = this._t("frontend.common.name", "Name");
    field.value = item.name || "";
    dialog.appendChild(field);
    const footer = customElements.get("ha-dialog-footer")
      ? document.createElement("ha-dialog-footer")
      : document.createElement("div");
    footer.slot = "footer";
    const cancel = document.createElement("ha-button");
    cancel.slot = "secondaryAction";
    cancel.appearance = "plain";
    cancel.textContent = this._t("frontend.common.cancel", "Cancel");
    cancel.addEventListener("click", () => {
      dialog.open = false;
    });
    const save = document.createElement("ha-button");
    save.slot = "primaryAction";
    save.variant = "brand";
    save.textContent = this._t("frontend.common.rename", "Rename");
    save.addEventListener("click", async () => {
      const name = String(field.value || "").trim();
      if (!name || name === item.name) {
        dialog.open = false;
        return;
      }
      save.disabled = true;
      try {
        const saved = await this._saveLibraryItem("variable", { ...item, name }, item);
        this._variables = (this._variables || []).map((row) =>
          row.id === saved.id ? saved : row
        );
        if (this._variableId === saved.id && this._variableDraft) {
          this._variableDraft = { ...this._variableDraft, name: saved.name };
        }
        dialog.open = false;
        this._render();
      } catch (err) {
        save.disabled = false;
        let note = dialog.querySelector(".error");
        if (!note) {
          note = document.createElement("p");
          note.className = "error";
          field.insertAdjacentElement("afterend", note);
        }
        note.textContent = err.message || String(err);
      }
    });
    footer.append(cancel, save);
    dialog.appendChild(footer);
    dialog.addEventListener("closed", () => dialog.remove());
    this.shadowRoot.appendChild(dialog);
    requestAnimationFrame(() => field.focus?.());
  },

  _confirmDeleteLibraryItem(kind, item) {
    if (!item?.id) {
      return;
    }
    this.shadowRoot.querySelector("ha-dialog.confirm-dialog")?.remove();
    const dialog = document.createElement("ha-dialog");
    dialog.className = "confirm-dialog";
    const titleKey =
      kind === "theme"
        ? "frontend.library.delete_theme"
        : kind === "palette"
          ? "frontend.library.delete_palette"
          : "frontend.library.delete_variable";
    const titleFallback =
      kind === "theme"
        ? "Delete circadian preset?"
        : kind === "palette"
          ? "Delete scene preset?"
          : "Delete color preset?";
    dialog.setAttribute("header-title", this._t(titleKey, titleFallback));
    dialog.open = true;
    const name = item.name || "";
    const text = document.createElement("p");
    text.textContent = this._t(
      "frontend.library.delete_confirm",
      "Are you sure you want to delete {name}?",
      { name }
    );
    dialog.appendChild(text);
    const footer = customElements.get("ha-dialog-footer")
      ? document.createElement("ha-dialog-footer")
      : document.createElement("div");
    footer.slot = "footer";
    const cancel = document.createElement("ha-button");
    cancel.slot = "secondaryAction";
    cancel.appearance = "plain";
    cancel.textContent = this._t("frontend.common.cancel", "Cancel");
    cancel.addEventListener("click", () => {
      dialog.open = false;
    });
    const confirm = document.createElement("ha-button");
    confirm.slot = "primaryAction";
    confirm.variant = "danger";
    confirm.textContent = this._t("frontend.common.delete", "Delete");
    confirm.addEventListener("click", async () => {
      confirm.disabled = true;
      try {
        await this._deleteLibraryItem(kind, item);
        dialog.open = false;
      } catch (err) {
        confirm.disabled = false;
        let note = dialog.querySelector(".error");
        if (!note) {
          note = document.createElement("p");
          note.className = "error";
          text.insertAdjacentElement("afterend", note);
        }
        note.textContent = err.message || String(err);
      }
    });
    footer.append(cancel, confirm);
    dialog.appendChild(footer);
    dialog.addEventListener("closed", () => dialog.remove());
    this.shadowRoot.appendChild(dialog);
  },

  async _appendSceneRenameFields(dialog, data, { focus } = {}) {
    const chipsAvailable = Boolean(customElements.get("ha-assist-chip"));
    const visible = new Set();
    if (focus === "category") {
      visible.add("category");
    }
    if (!chipsAvailable || data.description) {
      visible.add("description");
    }
    if (!chipsAvailable || data.category) {
      visible.add("category");
    }
    if (!chipsAvailable || (data.labels || []).length) {
      visible.add("labels");
    }
    let categories = [];
    try {
      categories = await this._hass.callWS({
        type: "config/category_registry/list",
        scope: "scene",
      });
    } catch (_err) {
      categories = [];
    }
    const bindValue = (el, onValue) => {
      el.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        onValue(ev.detail?.value);
      });
      el.addEventListener("input", () => onValue(el.value));
    };
    const nameInput = customElements.get("ha-input")
      ? document.createElement("ha-input")
      : document.createElement("ha-selector");
    nameInput.label = this._t("frontend.common.name", "Name");
    nameInput.required = true;
    nameInput.value = data.scene_name;
    if (nameInput.localName === "ha-selector") {
      nameInput.hass = this._hass;
      nameInput.selector = { text: {} };
    }
    nameInput.setAttribute("autofocus", "");
    bindValue(nameInput, (value) => {
      data.scene_name = value ?? "";
    });
    const iconPicker = customElements.get("ha-icon-picker")
      ? document.createElement("ha-icon-picker")
      : document.createElement("ha-selector");
    iconPicker.hass = this._hass;
    iconPicker.label = this._t("frontend.common.icon", "Icon");
    iconPicker.value = data.icon || "";
    if (iconPicker.localName === "ha-selector") {
      iconPicker.selector = { icon: {} };
    }
    bindValue(iconPicker, (value) => {
      data.icon = value || "";
    });
    dialog.append(nameInput, iconPicker);

    const optional = document.createElement("div");
    const chips = document.createElement(
      customElements.get("ha-chip-set") ? "ha-chip-set" : "div"
    );
    const addChip = (id, label, build) => {
      if (visible.has(id)) {
        optional.appendChild(build());
        return;
      }
      const chip = document.createElement("ha-assist-chip");
      chip.id = id;
      chip.label = label;
      const plus = document.createElement("ha-icon");
      plus.setAttribute("icon", "mdi:plus");
      plus.slot = "icon";
      chip.appendChild(plus);
      chip.addEventListener("click", () => {
        chip.remove();
        visible.add(id);
        optional.appendChild(build());
      });
      chips.appendChild(chip);
    };
    addChip(
      "description",
      this._t("frontend.common.add_description", "Add description"),
      () => {
        const field = customElements.get("ha-textarea")
          ? document.createElement("ha-textarea")
          : document.createElement("ha-selector");
        field.label = this._t("frontend.common.description", "Description");
        field.value = data.description;
        if (field.localName === "ha-selector") {
          field.hass = this._hass;
          field.selector = { text: { multiline: true } };
        }
        bindValue(field, (value) => {
          data.description = value ?? "";
        });
        return field;
      }
    );
    addChip(
      "category",
      this._t("frontend.common.add_category", "Add category"),
      () => {
        if (customElements.get("ha-category-picker")) {
          const picker = document.createElement("ha-category-picker");
          picker.hass = this._hass;
          picker.scope = "scene";
          picker.label = this._t("frontend.common.category", "Category");
          picker.value = data.category || "";
          bindValue(picker, (value) => {
            data.category = value || "";
          });
          return picker;
        }
        const picker = document.createElement("ha-selector");
        picker.hass = this._hass;
        picker.label = this._t("frontend.common.category", "Category");
        picker.value = data.category || "";
        picker.selector = {
          select: {
            mode: "dropdown",
            options: categories.map((item) => ({
              value: item.category_id,
              label: item.name,
            })),
          },
        };
        bindValue(picker, (value) => {
          data.category = value || "";
        });
        return picker;
      }
    );
    addChip("labels", this._t("frontend.common.add_labels", "Add labels"), () => {
      const picker = customElements.get("ha-labels-picker")
        ? document.createElement("ha-labels-picker")
        : document.createElement("ha-selector");
      picker.hass = this._hass;
      picker.value = data.labels;
      if (picker.localName === "ha-selector") {
        picker.label = this._t("frontend.common.labels", "Labels");
        picker.selector = { label: { multiple: true } };
      }
      bindValue(picker, (value) => {
        data.labels = value || [];
      });
      return picker;
    });
    dialog.append(optional, chips);
    return nameInput;
  },

  async _openSaveDialog({ rename = false, focus } = {}) {
    this.shadowRoot.querySelector("ha-dialog.save-dialog")?.remove();
    const data = {
      scene_name: this._nameIsPlaceholder(this._formData.scene_name)
        ? this._suggestedSceneName(this._formData)
        : this._formData.scene_name || this._suggestedSceneName(this._formData),
      description: this._formData.description || "",
      labels: [...(this._formData.labels || [])],
      category: this._formData.category || "",
      icon:
        this._formData.icon ||
        this._hass?.entities?.[this._entityId]?.icon ||
        "",
    };
    const dialog = document.createElement("ha-dialog");
    dialog.className = "save-dialog";
    dialog.setAttribute(
      "header-title",
      rename
        ? this._t("frontend.common.rename", "Rename")
        : this._t("frontend.common.save", "Save")
    );
    dialog.open = true;
    const nameInput = await this._appendSceneRenameFields(dialog, data, {
      focus,
    });

    const footer = customElements.get("ha-dialog-footer")
      ? document.createElement("ha-dialog-footer")
      : document.createElement("div");
    footer.slot = "footer";
    const cancel = document.createElement("ha-button");
    cancel.slot = "secondaryAction";
    cancel.appearance = "plain";
    cancel.textContent = "Cancel";
    cancel.setAttribute("data-dialog", "close");
    cancel.addEventListener("click", () => {
      dialog.open = false;
    });
    const save = document.createElement("ha-button");
    save.slot = "primaryAction";
    save.variant = "brand";
    save.textContent = rename ? "Rename" : "Save";
    save.addEventListener("click", async () => {
      const name = (nameInput.value || data.scene_name || "").trim();
      if (!name) {
        nameInput.reportValidity?.();
        return;
      }
      this._formData.scene_name = name;
      this._formData.description = data.description;
      this._formData.labels = data.labels;
      this._formData.category = data.category || null;
      this._formData.icon = data.icon || null;
      this._syncEditorSceneTitle();
      dialog.open = false;
      await this._save();
    });
    footer.append(cancel, save);
    dialog.appendChild(footer);
    dialog.addEventListener("closed", () => dialog.remove());
    this.shadowRoot.appendChild(dialog);
  },

  _confirmDelete() {
    if (!this._editId) {
      return;
    }
    this.shadowRoot.querySelector("ha-dialog.confirm-dialog")?.remove();
    const dialog = document.createElement("ha-dialog");
    dialog.className = "confirm-dialog";
    dialog.setAttribute(
      "header-title",
      this._loc(
        "ui.panel.config.scene.picker.delete_confirm_title",
        "Delete scene?"
      )
    );
    dialog.open = true;
    const text = document.createElement("p");
    const displayName = this._editorSceneTitle();
    text.textContent = this._loc(
      "ui.panel.config.scene.picker.delete_confirm_text",
      `Are you sure you want to delete ${displayName}?`,
      { name: displayName }
    );
    dialog.appendChild(text);
    const footer = customElements.get("ha-dialog-footer")
      ? document.createElement("ha-dialog-footer")
      : document.createElement("div");
    footer.slot = "footer";
    const cancel = document.createElement("ha-button");
    cancel.slot = "secondaryAction";
    cancel.appearance = "plain";
    cancel.textContent = this._loc("ui.common.cancel", "Cancel");
    cancel.addEventListener("click", () => {
      dialog.open = false;
    });
    const confirm = document.createElement("ha-button");
    confirm.slot = "primaryAction";
    confirm.variant = "danger";
    confirm.textContent = this._loc("ui.common.delete", "Delete");
    confirm.addEventListener("click", () => {
      dialog.open = false;
      this._delete();
    });
    footer.append(cancel, confirm);
    dialog.appendChild(footer);
    dialog.addEventListener("closed", () => dialog.remove());
    this.shadowRoot.appendChild(dialog);
  },

  _openPreviewDatePicker() {
    const picker = this._datePicker;
    if (!picker) {
      return;
    }
    const openFrom = (el) => {
      if (!el) {
        return false;
      }
      // HA’s date input opens ha-dialog-date-picker from this private helper.
      if (typeof el._openDialog === "function") {
        el._openDialog();
        return true;
      }
      el.click?.();
      return true;
    };
    const findDateInput = () =>
      picker.shadowRoot
        ?.querySelector("ha-selector-date")
        ?.shadowRoot?.querySelector("ha-date-input") ||
      picker.shadowRoot?.querySelector("ha-date-input");
    const run = () => {
      const dateInput = findDateInput();
      if (openFrom(dateInput)) {
        return;
      }
      // Selector may still be upgrading — click through known hosts.
      const selDate = picker.shadowRoot?.querySelector("ha-selector-date");
      if (openFrom(selDate) || openFrom(picker)) {
        return;
      }
    };
    if (!picker.shadowRoot?.querySelector("ha-selector-date")) {
      customElements.whenDefined("ha-selector").then(() => {
        requestAnimationFrame(run);
      });
      return;
    }
    run();
  },

  _openLocationDialog() {
    this.shadowRoot.querySelector("ha-dialog.location-dialog")?.remove();
    const home = this._homeLocation() || { latitude: 0, longitude: 0 };
    const data = {
      latitude: this._previewLocation?.latitude ?? home.latitude,
      longitude: this._previewLocation?.longitude ?? home.longitude,
    };
    const dialog = document.createElement("ha-dialog");
    dialog.className = "location-dialog";
    dialog.setAttribute("header-title", "Preview location");
    dialog.open = true;

    const help = document.createElement("p");
    help.textContent =
      "Sun times and light graphs use this place. The clock stays on your Home Assistant timezone.";

    const searchRow = document.createElement("div");
    searchRow.className = "location-search";
    const searchField = this._haInput("Search", "");
    searchField.placeholder = this._t(
      "frontend.location.search_placeholder",
      "City or address"
    );
    const searchBtn = document.createElement("ha-button");
    searchBtn.textContent = "Search";
    searchRow.append(searchField, searchBtn);
    const searchDisclosure = document.createElement("p");
    searchDisclosure.textContent = this._t(
      "frontend.location.search_disclosure",
      "Search sends your query and browser IP to Photon (Komoot) when you search."
    );

    const searchError = document.createElement("p");
    searchError.className = "error";
    searchError.hidden = true;
    const results = document.createElement("div");
    results.className = "location-search-results";

    const picker = document.createElement("ha-selector");
    picker.hass = this._hass;
    picker.label = "Location";
    picker.selector = { location: { radius: false } };
    picker.value = { latitude: data.latitude, longitude: data.longitude };
    const applyCoords = (latitude, longitude) => {
      data.latitude = latitude;
      data.longitude = longitude;
      picker.value = { latitude, longitude };
    };
    picker.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      const value = ev.detail?.value;
      if (value?.latitude == null || value?.longitude == null) {
        return;
      }
      data.latitude = value.latitude;
      data.longitude = value.longitude;
    });

    const runSearch = async () => {
      const query = (searchField.value || "").trim();
      searchError.hidden = true;
      results.replaceChildren();
      if (!query) {
        return;
      }
      searchBtn.disabled = true;
      try {
        const hits = await this._searchLocations(query);
        if (!hits.length) {
          searchError.textContent = "No matching places. Try a city name or move the map.";
          searchError.hidden = false;
          return;
        }
        if (hits.length === 1) {
          applyCoords(hits[0].latitude, hits[0].longitude);
          return;
        }
        for (const hit of hits) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = hit.label;
          btn.addEventListener("click", () => {
            applyCoords(hit.latitude, hit.longitude);
            results.replaceChildren();
          });
          results.appendChild(btn);
        }
      } catch (err) {
        searchError.textContent = err.message || String(err);
        searchError.hidden = false;
      } finally {
        searchBtn.disabled = false;
      }
    };
    searchBtn.addEventListener("click", () => {
      runSearch();
    });
    searchField.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        runSearch();
      }
    });

    dialog.append(help, searchRow, searchDisclosure, searchError, results, picker);

    const footer = customElements.get("ha-dialog-footer")
      ? document.createElement("ha-dialog-footer")
      : document.createElement("div");
    footer.slot = "footer";
    const cancel = document.createElement("ha-button");
    cancel.slot = "secondaryAction";
    cancel.appearance = "plain";
    cancel.textContent = this._loc("ui.common.cancel", "Cancel");
    cancel.addEventListener("click", () => {
      dialog.open = false;
    });
    const apply = document.createElement("ha-button");
    apply.slot = "primaryAction";
    apply.variant = "brand";
    apply.textContent = "Preview";
    apply.addEventListener("click", () => {
      this._setPreviewLocation(data);
      dialog.open = false;
    });
    footer.append(cancel, apply);
    dialog.appendChild(footer);
    dialog.addEventListener("closed", () => dialog.remove());
    this.shadowRoot.appendChild(dialog);
  },

  async _searchLocations(query) {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`Location search failed (${response.status})`);
    }
    const payload = await response.json();
    return (payload.features || []).map((feature) => {
      const [longitude, latitude] = feature.geometry.coordinates;
      const props = feature.properties || {};
      const label = [
        props.name,
        props.street,
        props.city || props.county,
        props.state,
        props.country,
      ]
        .filter(Boolean)
        .filter((part, index, all) => all.indexOf(part) === index)
        .join(", ");
      return { latitude, longitude, label: label || `${latitude.toFixed(3)}, ${longitude.toFixed(3)}` };
    });
  }
};
