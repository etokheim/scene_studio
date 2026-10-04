/* library editor owns these panel methods.
 * The receiver is the panel: navigation, rendering and saving remain host hooks.
 * Keep closures bound to that receiver; do not bind methods to a separate object. */
import { DOMAIN } from "./panel_constants.js";
import { libraryItemRoute } from "./editor_routes.js";
import { createSceneColorWheel, colorPayloadFromDraft } from "./color_ui.js";
import {
  galleryCopyName,
  galleryPalette,
  galleryTheme,
  paletteMatchesGallery,
  seedThemeEvents,
  themeMatchesGallery,
} from "./gallery.js";
import { defaultPaletteSlots, variableIsPalette } from "./palette.js";
import { renderLanding } from "./landing.js";
import { renderPaletteEditor } from "./simple_editor.js";

export const libraryEditorMethods = {
  _variableEditorDraft(variable) {
    if (variable) {
      return {
        ...(variable.color || {}),
        brightness: variable.brightness ?? 255,
        state: "on",
      };
    }
    return {
      color_mode: "color_temp",
      color_temp_kelvin: 3000,
      brightness: 255,
      state: "on",
    };
  },

  _wheelPalette() {
    return {
      getPalette: () => this._variables || [],
      onAddPalette: (draft) => this._addVariableFromCurrentDraft(draft),
      addVariableLabel: this._t("frontend.library.add_variable", "Add color preset"),
      onEditVariable: (id) => this._go(`variable/${id}`),
    };
  },

  _openCreateVariableDialog() {
    void this._createLibraryItem("variable");
  },

  _openCreatePaletteDialog() {
    void this._createLibraryItem("palette");
  },

  _addVariableFromCurrentDraft(draft) {
    this._pendingVariableFromDraft = draft ? { ...draft } : null;
    void this._createLibraryItem("variable", { fromDraft: draft });
    return Promise.resolve(null);
  },

  _openCreateThemeDialog() {
    void this._createLibraryItem("theme");
  },

  async _copyGalleryPalette(paletteId) {
    const source = galleryPalette(paletteId);
    if (!source) {
      throw new Error(`Palette ${paletteId} not found`);
    }
    const saved = await this._hass.callWS({
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
    });
    const list = [...(this._variables || [])];
    const index = list.findIndex((item) => item.id === saved.id);
    if (index >= 0) {
      list[index] = saved;
    } else {
      list.push(saved);
    }
    this._variables = list;
    return saved;
  },

  async _ensureDefaultTheme({ adoptDraft = true } = {}) {
    const result = await this._hass.callWS({
      type: `${DOMAIN}/ensure_default_theme`,
    });
    if (Array.isArray(result?.variables)) {
      this._variables = result.variables;
    }
    const theme = result?.theme;
    if (!theme) {
      throw new Error("Default circadian preset was not created");
    }
    if (adoptDraft) {
      this._adoptSavedTheme(theme);
    } else {
      const themes = [...(this._themes || [])];
      const index = themes.findIndex((item) => item.id === theme.id);
      if (index >= 0) {
        themes[index] = structuredClone(theme);
      } else {
        themes.push(structuredClone(theme));
      }
      this._themes = themes;
    }
    return theme;
  },

  async _copyThemePreset(preset) {
    if (preset?.seed) {
      return this._ensureDefaultTheme();
    }
    const events = {};
    const copied = new Map();
    for (const eventId of ["dawn", "sunrise", "noon", "sunset", "dusk"]) {
      const spec = preset.events[eventId];
      if (spec.palette) {
        let paletteId = copied.get(spec.palette);
        if (!paletteId) {
          const palette = await this._copyGalleryPalette(spec.palette);
          paletteId = palette.id;
          copied.set(spec.palette, paletteId);
        }
        events[eventId] = {
          color: { variable_ref: paletteId },
          brightness: spec.brightness,
          assignment_seed: 0,
        };
      } else {
        events[eventId] = {
          color: structuredClone(spec.color),
          brightness: spec.brightness,
        };
      }
    }
    const saved = await this._hass.callWS({
      type: `${DOMAIN}/save_theme`,
      data: {
        name: galleryCopyName(
          this._t(preset.nameKey, preset.name),
          (this._themes || []).map((item) => item.name)
        ),
        builtin_id: preset.id,
        events,
      },
    });
    this._adoptSavedTheme(saved);
    return saved;
  },

  async _draftFromThemePresetEvent(spec, current) {
    if (spec?.palette) {
      const currentVar = (this._variables || []).find(
        (item) => item.id === current?.variable_ref
      );
      const keep =
        variableIsPalette(currentVar) && currentVar.builtin_id === spec.palette
          ? currentVar
          : (this._variables || []).find(
              (item) =>
                variableIsPalette(item) && item.builtin_id === spec.palette
            );
      const palette = keep || (await this._copyGalleryPalette(spec.palette));
      return {
        state: "on",
        brightness: spec.brightness,
        variable_ref: palette.id,
        assignment_seed: 0,
      };
    }
    return {
      state: "on",
      brightness: spec.brightness,
      ...structuredClone(spec.color),
    };
  },

  _resetPaletteToPresetDefault() {
    const draft = this._variableDraft;
    const source = galleryPalette(draft?.builtin_id);
    if (!source || this._view !== "palette") {
      return;
    }
    this._commitUndo();
    this._variableDraft = {
      ...draft,
      slots: structuredClone(source.slots),
    };
    this._saveSoon();
    this._render();
  },

  async _resetThemeToPresetDefault() {
    const draft = this._themeDraft;
    const preset = galleryTheme(draft?.builtin_id);
    if (!preset || this._view !== "theme") {
      return;
    }
    this._commitUndo();
    if (preset.seed) {
      await this._ensureDefaultTheme({ adoptDraft: false });
      this._themeDraft = {
        ...this._themeDraft,
        builtin_id: preset.id,
        events: seedThemeEvents(preset),
      };
      this._saveSoon();
      this._rebuildThemeDial();
      this._render();
      return;
    }
    const events = {};
    for (const eventId of ["dawn", "sunrise", "noon", "sunset", "dusk"]) {
      const spec = preset.events?.[eventId];
      if (!spec) {
        continue;
      }
      if (spec.palette) {
        const current = draft.events?.[eventId]?.color;
        const currentVar = (this._variables || []).find(
          (item) => item.id === current?.variable_ref
        );
        const keep =
          variableIsPalette(currentVar) && currentVar.builtin_id === spec.palette
            ? currentVar
            : (this._variables || []).find(
                (item) =>
                  variableIsPalette(item) && item.builtin_id === spec.palette
              );
        const palette = keep || (await this._copyGalleryPalette(spec.palette));
        events[eventId] = {
          color: { variable_ref: palette.id },
          brightness: spec.brightness,
          assignment_seed: 0,
        };
      } else {
        events[eventId] = {
          color: structuredClone(spec.color),
          brightness: spec.brightness,
        };
      }
    }
    this._themeDraft = { ...this._themeDraft, events };
    this._saveSoon();
    this._rebuildThemeDial();
    this._render();
  },

  async _createLibraryItem(kind, { fromDraft, areaId, areaName } = {}) {
    if (this._creatingLibrary) {
      return;
    }
    if (!(await this._confirmLeaveEditor())) {
      return;
    }
    this._creatingLibrary = true;
    const beforeTarget = this._historyTarget();
    try {
      if (kind === "scene") {
        const choice = await this._chooseCircadianTheme({ areaId });
        if (!choice) {
          return;
        }
        const theme = choice.custom
          ? await this._ensureDefaultTheme({ adoptDraft: false })
          : choice.preset
            ? await this._copyThemePreset(choice.preset)
            : choice.theme;
        const saved = await this._hass.callWS({
          type: `${DOMAIN}/save`,
          data: {
            kind: "circadian",
            scene_name: choice.custom
              ? this._sceneNameInArea(areaId, this._untitledLabel())
              : this._sceneNameInArea(areaId, theme?.name),
            area: areaId || null,
            theme_id: theme.id,
            membership: { exclude: [], include: [] },
            overrides: {},
            lights: {},
          },
        });
        this._upsertSceneInList(saved);
        this._commitCreatedUndo({
          kind: "scene",
          id: saved.id,
          record: saved,
          beforeTarget,
        });
        this._refreshVisibleSceneList();
        this._go(`edit/${saved.id}`);
        return;
      }
      if (kind === "simple") {
        const choice = await this._chooseScenePalette({ areaId });
        if (!choice) {
          return;
        }
        const lights = {};
        let paletteId = null;
        let assignmentSeed = 0;
        if (choice.palette) {
          paletteId = choice.palette.id;
          assignmentSeed = choice.seed || 0;
          for (const entityId of this._areaLightIds(areaId)) {
            lights[entityId] = { variable_ref: paletteId };
          }
        } else {
          for (const entityId of this._areaLightIds(areaId)) {
            const prior = choice.room?.[entityId];
            lights[entityId] = prior
              ? structuredClone(prior)
              : this._snapshotLight(entityId);
          }
        }
        const saved = await this._hass.callWS({
          type: `${DOMAIN}/save`,
          data: {
            kind: "simple",
            scene_name: choice.palette
              ? this._sceneNameFromPalette(areaId, choice.palette)
              : this._untitledLabel(),
            area: areaId || null,
            membership: { exclude: [], include: [] },
            lights,
            palette_id: paletteId,
            assignment_seed: assignmentSeed,
          },
        });
        if (choice.keepPreview && choice.snapshots) {
          this._roomPreview = true;
          this._roomPreviewSnapshots = choice.snapshots;
          this._scenePreviewOwnerId = saved.id;
          // The dialog already painted these lights. A second apply with a
          // transition flashes the room back and forth.
          this._roomPreviewHoldApply = true;
        }
        this._upsertSceneInList(saved);
        this._commitCreatedUndo({
          kind: "scene",
          id: saved.id,
          record: saved,
          beforeTarget,
        });
        this._refreshVisibleSceneList();
        this._go(`edit/${saved.id}`);
        return;
      }
      if (kind === "theme") {
        const choice = await this._chooseCircadianTheme();
        if (!choice) {
          return;
        }
        const source = choice.theme || galleryTheme("default");
        const saved = choice.preset
          ? await this._copyThemePreset(choice.preset)
          : await this._hass.callWS({
              type: `${DOMAIN}/save_theme`,
              data: {
                name: choice.theme
                  ? galleryCopyName(source.name, (this._themes || []).map((item) => item.name))
                  : this._untitledLabel(),
                events: structuredClone(source.events),
              },
            });
        this._commitCreatedUndo({
          kind: "theme",
          id: saved.id,
          record: saved,
          beforeTarget,
        });
        this._adoptSavedTheme(saved);
        this._go(`theme/${saved.id}`);
        return;
      }
      const isPalette = kind === "palette";
      const from = fromDraft || this._pendingVariableFromDraft;
      this._pendingVariableFromDraft = null;
      const data = isPalette
        ? {
            name: this._untitledLabel(),
            kind: "palette",
            slots: defaultPaletteSlots(),
          }
        : {
            name: this._untitledLabel(),
            kind: "color",
            brightness: Number(from?.brightness) || 255,
            color: colorPayloadFromDraft(from || this._variableEditorDraft(null)),
          };
      const saved = await this._hass.callWS({
        type: `${DOMAIN}/save_variable`,
        data,
      });
      this._commitCreatedUndo({
        kind: isPalette ? "palette" : "variable",
        id: saved.id,
        record: saved,
        beforeTarget,
      });
      const list = [...(this._variables || [])];
      const index = list.findIndex((item) => item.id === saved.id);
      if (index >= 0) {
        list[index] = saved;
      } else {
        list.push(saved);
      }
      this._variables = list;
      this._go(isPalette ? `palette/${saved.id}` : `variable/${saved.id}`);
    } catch (err) {
      this._error = err.message || String(err);
      this._render();
    } finally {
      this._creatingLibrary = false;
    }
  },

  _openVariableEditor(variable) {
    if (variable?.id) {
      this._go(
        libraryItemRoute(variableIsPalette(variable) ? "palette" : "variable", this._view, this._variableId, variable.id)
      );
      return;
    }
    void this._createLibraryItem("variable");
  },

  _openPaletteEditor(palette) {
    if (palette?.id) {
      this._go(libraryItemRoute("palette", this._view, this._variableId, palette.id));
      return;
    }
    void this._createLibraryItem("palette");
  },

  _variableWorkingCopy(variable) {
    const paletteEditor = this._view === "palette";
    if (!variable) {
      if (paletteEditor) {
        this._pendingVariableFromDraft = null;
        return {
          kind: "palette",
          name: "",
          colorDraft: this._variableEditorDraft(null),
          slots: defaultPaletteSlots(),
        };
      }
      const from = this._pendingVariableFromDraft;
      this._pendingVariableFromDraft = null;
      const colorDraft = from
        ? {
            ...colorPayloadFromDraft(from),
            brightness: Number(from.brightness) || 255,
            state: "on",
          }
        : this._variableEditorDraft(null);
      return {
        kind: "color",
        name: "",
        colorDraft,
        slots: defaultPaletteSlots(),
      };
    }
    return {
      kind: paletteEditor || variableIsPalette(variable) ? "palette" : "color",
      name: variable.name || "",
      builtin_id: variable.builtin_id || null,
      colorDraft: this._variableEditorDraft(variable),
      slots: variableIsPalette(variable)
        ? structuredClone(variable.slots || defaultPaletteSlots())
        : defaultPaletteSlots(),
    };
  },

  _canonicalLibraryHash(item) {
    const prefix = variableIsPalette(item) ? "palette" : "variable";
    return `${prefix}/${item.id}`;
  },

  _alignLibraryView(item) {
    const want = variableIsPalette(item) ? "palette" : "variable";
    if (this._view === want) {
      return;
    }
    this._view = want;
    const hash = this._canonicalLibraryHash(item);
    if (this._currentHash() !== hash) {
      history.replaceState(null, "", this._hashHref(hash));
    }
  },

  async _loadVariable(variableId) {
    const token = this._startPanelLoad();
    await this._ensureChangeSubscription();
    if (!this._panelLoadIsCurrent(token)) return;
    this._sharedDeleted = false;
    try {
      const payload = await this._hass.callWS({ type: `${DOMAIN}/list` });
      if (!this._panelLoadIsCurrent(token)) {
        return;
      }
      this._items = payload?.scenes || [];
      this._variables = payload?.variables || [];
      this._themes = payload?.themes || [];
      this._floors = payload?.floors || [];
      this._areaCatalogLoaded = Array.isArray(payload?.floors);
      this._adoptSettings(payload?.settings);
      if (variableId === "new") {
        this._variableId = null;
        this._variableBase = null;
        this._variableDraft = this._variableWorkingCopy(null);
        this._error = null;
        this._resetSession();
        this._render();
        return;
      }
      const variable = (this._variables || []).find((item) => item.id === variableId);
      if (!variable) {
        const missing =
          this._view === "palette"
            ? this._t("frontend.library.palette_missing", "Scene preset not found")
            : this._t("frontend.library.variable_missing", "Color preset not found");
        this._error = missing;
        this._view = "list";
        this._variableId = null;
        this._variableDraft = null;
        this._render();
        return;
      }
      this._variableId = variable.id;
      this._variableBase = structuredClone(variable);
      this._alignLibraryView(variable);
      this._variableDraft = this._variableWorkingCopy(variable);
      this._error = null;
      this._resetSession();
      this._render();
      return;
    } catch (err) {
      if (!this._panelLoadIsCurrent(token)) {
        return;
      }
      this._error = err.message || String(err);
      this._variableDraft = null;
    }
    if (!this._panelLoadIsCurrent(token)) {
      return;
    }
    this._render();
  },

  _variableSavePayload() {
    const working = this._variableDraft;
    if (!working) {
      return null;
    }
    const name = (working.name || "").trim();
    if (!name) {
      return null;
    }
    if (working.kind === "palette") {
      return {
        id: this._variableId || undefined,
        name,
        kind: "palette",
        slots: working.slots,
        ...(working.builtin_id ? { builtin_id: working.builtin_id } : {}),
      };
    }
    const brightness = Number(working.colorDraft?.brightness);
    if (!Number.isFinite(brightness)) {
      return null;
    }
    return {
      id: this._variableId || undefined,
      name,
      kind: "color",
      brightness,
      color: colorPayloadFromDraft(working.colorDraft),
    };
  },

  _libraryRailCanStay(page) {
    const rail = page?.querySelector(":scope > .area-rail");
    const stage = page?.querySelector(":scope > .stage-col");
    if (!rail || !stage || this._railTab !== "library") {
      return false;
    }
    const id = this._view === "theme" ? this._themeId : this._variableId;
    if (!id || (this._view !== "variable" && this._view !== "palette" && this._view !== "theme")) {
      return false;
    }
    // The open item is already a card in this rail. Rebuilding would start
    // the list at scroll 0 and the reveal would treat it as off-screen.
    return Boolean(rail.querySelector(`[data-item-id="${CSS.escape(id)}"]`));
  },

  _paintVariableEditorInPlace() {
    const page = this._contentEl?.querySelector(":scope > .workspace");
    if (!this._libraryRailCanStay(page) || (this._view !== "variable" && this._view !== "palette")) {
      return false;
    }
    const stage = page.querySelector(":scope > .stage-col");
    const isPalette = this._view === "palette";
    const working = this._variableDraft || this._variableWorkingCopy(null);
    working.kind = isPalette ? "palette" : "color";
    this._variableDraft = working;
    this._parkSunPath();
    const scroll = this._stageScrollEl(stage);
    if (scroll) {
      scroll.scrollTop = 0;
    }
    const host = document.createElement("div");
    host.className = isPalette ? "simple-editor-host" : "library-editor";
    if (this._error) {
      const error = document.createElement("p");
      error.className = "error";
      error.textContent = this._error;
      host.appendChild(error);
    }
    scroll?.replaceChildren(host);
    this._mountPageBanners(stage);
    if (isPalette) {
      renderPaletteEditor(this, host, { glowHost: null });
      this._syncSceneUsed();
    } else {
      this._fillVariableEditor(host);
      this._syncLibraryUsedBy();
    }
    this._syncWorkspaceScrollport();
    this._playSimpleEnterIfNeeded(host);
    this._syncRailSelection();
    return true;
  },

  _paintThemeEditorInPlace() {
    const page = this._contentEl?.querySelector(":scope > .workspace");
    if (!this._libraryRailCanStay(page) || this._view !== "theme") {
      return false;
    }
    const stage = page.querySelector(":scope > .stage-col");
    const scroll = this._stageScrollEl(stage);
    this._parkSunPath();
    if (scroll) {
      for (const child of [...scroll.children]) {
        child.remove();
      }
      scroll.scrollTop = 0;
    }
    if (this._error && scroll) {
      const error = document.createElement("p");
      error.className = "error";
      error.textContent = this._error;
      scroll.appendChild(error);
    }
    this._mountSunPath(stage);
    this._syncWorkspaceScrollport();
    this._syncSceneUsed();
    this._syncRailSelection();
    return true;
  },

  _renderVariableEditor({ keepRail = false } = {}) {
    this._syncAppBarTitle();
    this._setNavigationIcon(this._narrow ? this._backButton() : this._menuButton());
    this._setListActions();
    this._syncEditorChrome();
    this._syncSaveFab();
    this._contentEl.classList.add("wide");
    const split = !this._narrow;
    this._contentEl.classList.toggle("workspace-split", split);
    if (keepRail && this._paintVariableEditorInPlace()) {
      return;
    }
    this._parkSunPath();
    const isPalette = this._view === "palette";
    const working = this._variableDraft || this._variableWorkingCopy(null);
    working.kind = isPalette ? "palette" : "color";
    this._variableDraft = working;
    const page = renderLanding(this, { includeStage: true });
    const stage = page.querySelector(".stage-col");
    const host = document.createElement("div");
    host.className = isPalette ? "simple-editor-host" : "library-editor";
    if (this._error) {
      const error = document.createElement("p");
      error.className = "error";
      error.textContent = this._error;
      host.appendChild(error);
    }
    if (isPalette) {
      if (this._narrow) {
        this._contentEl.classList.remove("workspace-split");
        this._contentEl.replaceChildren(host);
        renderPaletteEditor(this, host, { glowHost: null });
      } else {
        const scroll = this._stageScrollEl(stage);
        scroll?.replaceChildren(host);
        this._mountWorkspacePage(page);
        this._mountPageBanners(stage);
        renderPaletteEditor(this, host, { glowHost: null });
      }
      this._syncWorkspaceScrollport();
      this._playSimpleEnterIfNeeded(host);
      this._syncSceneUsed();
      this._syncRailSelection();
      return;
    }
    this._fillVariableEditor(host);
    if (this._narrow) {
      this._contentEl.classList.remove("workspace-split");
      this._contentEl.replaceChildren(host);
    } else {
      const scroll = this._stageScrollEl(stage);
      scroll?.replaceChildren(host);
      this._mountWorkspacePage(page);
      this._mountPageBanners(stage);
    }
    this._syncWorkspaceScrollport();
    this._playSimpleEnterIfNeeded(host);
    this._syncLibraryUsedBy();
    this._syncRailSelection();
  },

  _fillVariableEditor(host) {
    const working = this._variableDraft || this._variableWorkingCopy(null);
    working.kind = "color";
    this._variableDraft = working;
    const hint = document.createElement("p");
    hint.className = "library-hint";
    hint.textContent = this._t(
      "frontend.library.variable_edit_hint",
      "Color and brightness are shared by every circadian preset or light that still uses this color preset."
    );
    host.append(hint);
    const draft = working.colorDraft;
    const briInput = this._haInput(
      this._t("frontend.lights.brightness", "Brightness"),
      String(draft.brightness ?? 255),
      { type: "number", min: 0, max: 255 }
    );
    const bindBri = (value) => {
      if (Number.isFinite(value)) {
        this._beginSimpleUndo();
        draft.brightness = value;
        this._saveSoon();
      }
    };
    briInput.addEventListener("value-changed", (ev) => {
      bindBri(Number(ev.detail?.value ?? briInput.value));
    });
    briInput.addEventListener("change", () => bindBri(Number(briInput.value)));
    const wheel = createSceneColorWheel({
      t: (key, fallback, vars) => this._t(key, fallback, vars),
      pinFlip: this._wheelPinFlip || null,
      hasColor: true,
      hasTemp: true,
      tempMin: 2000,
      tempMax: 6500,
      getState: () => ({
        scenes: [{ id: "variable", index: 1, draft }],
        sequence: ["variable"],
        activeId: "variable",
      }),
      onChange: ({ dragging } = {}) => {
        if (dragging) {
          this._holdSimpleUndo(true);
        }
        try {
          this._beginSimpleUndo();
          delete draft.variable_ref;
          wheel.sync();
          this._saveSoon();
        } finally {
          if (!dragging) {
            this._holdSimpleUndo(false);
          }
        }
      },
    });
    this._variableWheel = wheel;
    host.append(briInput, wheel.el);
    wheel.sync();
  },

  _openThemeEditor(theme) {
    if (theme?.id) {
      this._go(libraryItemRoute("theme", this._view, this._themeId, theme.id));
    }
  },

  async _loadTheme(themeId) {
    const token = this._startPanelLoad();
    await this._ensureChangeSubscription();
    if (!this._panelLoadIsCurrent(token)) return;
    this._sharedDeleted = false;
    try {
      const payload = await this._hass.callWS({ type: `${DOMAIN}/list` });
      if (!this._panelLoadIsCurrent(token)) {
        return;
      }
      this._items = payload?.scenes || [];
      this._variables = payload?.variables || [];
      this._themes = payload?.themes || [];
      this._floors = payload?.floors || [];
      this._areaCatalogLoaded = Array.isArray(payload?.floors);
      this._adoptSettings(payload?.settings);
      if (themeId === "new") {
        const source = (this._themes || [])[0] || galleryTheme("default");
        this._themeId = null;
        this._themeBase = null;
        this._themeDraft = {
          name: "",
          events: structuredClone(source.events),
        };
        this._error = null;
        this._resetSession();
        this._render();
        return;
      }
      const theme = (this._themes || []).find((item) => item.id === themeId);
      if (!theme) {
        this._error = this._t("frontend.library.theme_missing", "Circadian preset not found");
        this._view = "list";
        this._themeId = null;
        this._render();
        return;
      }
      this._themeDraft = structuredClone(theme);
      delete this._themeDraft.revision;
      this._themeBase = structuredClone(theme);
      this._error = null;
    } catch (err) {
      if (!this._panelLoadIsCurrent(token)) {
        return;
      }
      this._error = err.message || String(err);
      this._themeDraft = null;
    }
    if (!this._panelLoadIsCurrent(token)) {
      return;
    }
    this._resetSession();
    this._render();
  },

  _renderThemeEditor({ keepRail = false } = {}) {
    if (!this._headerEl) {
      return;
    }
    this._syncAppBarTitle();
    this._setNavigationIcon(this._narrow ? this._backButton() : this._menuButton());
    this._setEditorActions();
    this._syncEditorChrome();
    this._syncSaveFab();
    this._contentEl.classList.add("wide");
    const split = !this._narrow;
    this._contentEl.classList.toggle("workspace-split", split);
    if (keepRail && this._paintThemeEditorInPlace()) {
      return;
    }
    this._parkSunPath();
    const page = renderLanding(this, { includeStage: true });
    const stage = page.querySelector(".stage-col");
    if (this._error) {
      const error = document.createElement("p");
      error.className = "error";
      error.textContent = this._error;
      this._stageScrollEl(stage)?.replaceChildren(error);
    }
    if (this._narrow) {
      this._contentEl.replaceChildren();
      this._contentEl.classList.remove("workspace-split");
      if (this._sunPathHome) {
        this._sunPathHome.appendChild(this._sunPathEl);
      }
      if (this._sunPathEl) {
        this._sunPathEl.hidden = false;
      }
    } else {
      this._mountWorkspacePage(page);
      if (stage) {
        this._mountSunPath(stage);
      }
    }
    this._syncWorkspaceScrollport();
    this._syncSceneUsed();
  },

  _adoptSavedTheme(saved, { adoptDraft = true } = {}) {
    if (adoptDraft) {
      this._themeDraft = structuredClone(saved);
      delete this._themeDraft.revision;
      this._themeBase = structuredClone(saved);
    }
    const themes = [...(this._themes || [])];
    const index = themes.findIndex((item) => item.id === saved.id);
    if (index >= 0) {
      themes[index] = structuredClone(saved);
    } else {
      themes.push(structuredClone(saved));
    }
    this._themes = themes;
    if (this._view === "edit" && this._sessionBaseline) {
      this._sessionBaseline = {
        ...this._sessionBaseline,
        theme: structuredClone(saved),
      };
    }
  },

  async _ensureThemeDraft() {
    if (this._view === "theme") {
      return Boolean(this._themeDraft);
    }
    if (this._formData?.kind === "simple") {
      return false;
    }
    const themeId = this._formData?.theme_id || "default";
    if (this._themeDraft?.id === themeId) {
      return true;
    }
    const theme = (this._themes || []).find((item) => item.id === themeId);
    if (!theme) {
      return false;
    }
    this._themeDraft = structuredClone(theme);
    delete this._themeDraft.revision;
    this._themeBase = structuredClone(theme);
    if (!this._themeDraft.id) {
      this._themeDraft.id = themeId;
    }
    if (this._sessionBaseline) {
      this._sessionBaseline = {
        ...this._sessionBaseline,
        theme: structuredClone(this._themeDraft),
      };
    }
    return true;
  },

  _themeEventDraft(eventId) {
    const ev = this._themeDraft?.events?.[eventId] || {};
    let color = { ...(ev.color || {}) };
    const ref = color.variable_ref;
    let brightness = ev.brightness ?? 200;
    if (ref) {
      const variable = (this._variables || []).find((item) => item.id === ref);
      if (variableIsPalette(variable)) {
        return {
          state: "on",
          brightness,
          variable_ref: ref,
          palette_t: color.palette_t,
          palette_r: color.palette_r,
          assignment_seed: ev.assignment_seed,
        };
      }
      color = { ...(variable?.color || {}), variable_ref: ref };
      if (variable?.brightness != null) {
        brightness = variable.brightness;
      }
    }
    return {
      state: "on",
      brightness,
      ...color,
    };
  },

  _writeThemeEventFromDraft(eventId, draft) {
    if (!this._themeDraft) {
      return;
    }
    const brightness = Number(draft.brightness);
    const value = Number.isFinite(brightness) ? brightness : 0;
    const prev = this._themeDraft.events[eventId] || {};
    if (draft.variable_ref) {
      const color = { variable_ref: draft.variable_ref };
      if (draft.palette_t != null) {
        color.palette_t = draft.palette_t;
      }
      if (draft.palette_r != null) {
        color.palette_r = draft.palette_r;
      }
      this._themeDraft.events[eventId] = {
        color,
        brightness: value,
        assignment_seed: draft.assignment_seed ?? prev.assignment_seed ?? 0,
      };
      this._syncPresetReset();
      return;
    }
    const color = {};
    if (draft.color_mode) {
      color.color_mode = draft.color_mode;
    }
    if (draft.color_temp_kelvin != null) {
      color.color_temp_kelvin = draft.color_temp_kelvin;
    }
    if (draft.hs_color) {
      color.hs_color = draft.hs_color;
    }
    if (draft.rgb_color) {
      color.rgb_color = draft.rgb_color;
    }
    this._themeDraft.events[eventId] = {
      color,
      brightness: value,
      assignment_seed: prev.assignment_seed ?? 0,
    };
    this._syncPresetReset();
  },

  _syncPresetReset() {
    const reset = this.shadowRoot?.querySelector(".scene-used-reset");
    if (!reset) {
      return;
    }
    const clean =
      this._view === "theme"
        ? themeMatchesGallery(this._themeDraft, this._variables)
        : this._view === "palette"
          ? paletteMatchesGallery(this._variableDraft)
          : true;
    reset.hidden = clean;
  }
};
