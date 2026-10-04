/* panel catalog owns these panel methods.
 * The receiver is the panel: navigation, rendering and saving remain host hooks.
 * Keep closures bound to that receiver; do not bind methods to a separate object. */
import { DOMAIN } from "./panel_constants.js";
import {
  createCatalogRefresher,
  mergeCatalogPatch,
  mergeFields,
  patchInPlace,
  railCatalogChanges,
  reconcileSaveResponse,
} from "./collaboration.js";
import {
  renderLanding,
  renderSceneCard,
  applyCircularRamp,
  previewRampsForTheme,
  paintThemeDial,
} from "./landing.js";
import { paintSimpleCardMesh } from "./card_mesh.js";

export const panelCatalogMethods = {
  _applyAreaCatalog(payload) {
    const before = {
      scenes: this._items,
      floors: this._floors,
      themes: this._themes,
      variables: this._variables,
    };
    this._items = payload?.scenes || this._items;
    this._floors = payload?.floors || this._floors;
    if (Array.isArray(payload?.floors)) this._areaCatalogLoaded = true;
    this._themes = payload?.themes || this._themes;
    this._variables = payload?.variables || this._variables;
    const changes = railCatalogChanges(before, {
      scenes: this._items,
      floors: this._floors,
      themes: this._themes,
      variables: this._variables,
    });
    const rail = this._contentEl?.querySelector(":scope > .workspace > .area-rail");
    if (!rail) {
      if (this._view === "list" || this._view === "variables") this._render();
      return;
    }
    const scroll = rail.querySelector('.area-rail-body:not([hidden])');
    const scrollTab = scroll?.dataset.tab || "scenes";
    const scrollTop = scroll?.scrollTop || 0;
    const replacement = changes.rebuild || changes.sharedChanged
      ? renderLanding(this, { includeStage: false }).querySelector(".area-rail") : null;
    if (!changes.rebuild) {
      // Keep the rail, its scroll container, and any focused control mounted.
      this._roomPreviewSwitch = rail.querySelector(".area-rail-body[data-tab=\"scenes\"] ha-switch");
      const selector = ".scene-card[data-scene-id], .scene-card[data-item-id], .var-chip[data-item-id]";
      const existingCards = [...rail.querySelectorAll(selector)];
      const updatedCards = replacement ? [...replacement.querySelectorAll(selector)] : [];
      for (let index = 0; index < existingCards.length; index += 1) {
        const oldCard = existingCards[index];
        const sceneId = oldCard.dataset.sceneId;
        const newCard = replacement ? updatedCards[index]
          : changes.sceneIds.has(sceneId)
            ? renderSceneCard(this, this._items.find(item => item.id === sceneId)).querySelector(".scene-card") : null;
        if (sceneId && !changes.sharedChanged && !changes.sceneIds.has(sceneId)) continue;
        if (!sceneId && !changes.sharedChanged) continue;
        const oldHost = oldCard.closest(".scene-card-slot") || oldCard.closest(".var-row > div");
        const newHost = newCard.closest(".scene-card-slot") || newCard.closest(".var-row > div");
        if (!oldHost || !newHost) continue;
        const focused = this.shadowRoot.activeElement;
        const focusInCard = focused && oldHost.contains(focused);
        const focusPath = [];
        if (focusInCard) {
          for (let node = focused; node !== oldHost; node = node.parentElement) {
            focusPath.unshift([...node.parentElement.children].indexOf(node));
          }
        }
        if (oldCard.classList.contains("selected")) newCard.classList.add("selected");
        if (oldHost.classList.contains("glow-on")) newHost.classList.add("glow-on");
        oldHost.replaceWith(newHost);
        if (focusInCard) {
          const target = focusPath.reduce((node, child) => node?.children[child], newHost);
          (target?.focus ? target : newCard).focus({ preventScroll: true });
        }
      }
      this._syncRailSelection();
      return;
    }
    rail.replaceWith(replacement);
    const nextScroll = replacement.querySelector(`.area-rail-body[data-tab="${scrollTab}"]`);
    if (nextScroll) {
      nextScroll.scrollTop = scrollTop;
      this._bindAreaRailScroll(nextScroll);
    }
    this._syncRailSelection();
  },

  _subscribeAreaRegistry() {
    if (!this._hass?.connection?.subscribeEvents || this._areaRegistrySubscription || this._areaRegistryUnsub) return;
    this._areaRegistrySubscription = this._hass.connection.subscribeEvents(
      () => { void this._refreshAreasFromRegistry(); },
      "area_registry_updated"
    ).then((unsubscribe) => {
      this._areaRegistrySubscription = null;
      if (!this.isConnected) {
        unsubscribe();
      } else {
        this._areaRegistryUnsub = unsubscribe;
      }
    }).catch((error) => {
      this._areaRegistrySubscription = null;
      this._error = error.message || String(error);
    });
  },

  async _ensureChangeSubscription() {
    const connection = this._hass?.connection;
    if (!connection?.subscribeMessage || !this.isConnected) return;
    if (this._changeConnection === connection && this._changeUnsub) return;
    if (this._changeConnection === connection && this._changeSubscription) {
      await this._changeSubscription;
      return;
    }
    const hadCatalog = Boolean(this._items?.length || this._themes?.length || this._variables?.length);
    this._changeConnection = connection;
    this._changeSubscription = connection.subscribeMessage(
      (event) => { void this._receiveSavedChange(event); },
      { type: `${DOMAIN}/subscribe_changes` }
    );
    try {
      const unsubscribe = await this._changeSubscription;
      if (!this.isConnected || this._changeConnection !== connection) {
        unsubscribe();
        return;
      }
      this._changeUnsub = unsubscribe;
      this._changeSubscription = null;
      if (hadCatalog) void this._receiveSavedChange({ kind: "catalog", action: "resync" });
    } catch (error) {
      if (this._changeConnection === connection) {
        this._changeSubscription = null;
        this._error = error.message || String(error);
      }
    }
  },

  async _applyRemoteLibrary(kind, itemId, item) {
    const isTheme = kind === "theme";
    const active = isTheme
      ? this._themeDraft?.id === itemId || this._themeId === itemId
      : this._variableId === itemId;
    if (!active) return;
    if (this._sharedConflict) return;
    if (!item) {
      this._sharedDeleted = true;
      window.clearTimeout(this._saveSoonTimer);
      this._saveSoonTimer = null;
      this._showDeletedDraftBanner();
      return;
    }
    const baseItem = isTheme ? this._themeBase : this._variableBase;
    if (!baseItem || baseItem.revision === item.revision) return;
    const base = structuredClone(baseItem);
    const current = structuredClone(item);
    delete base.revision;
    delete current.revision;
    const before = isTheme ? base : this._variableWorkingCopy(base);
    const after = isTheme ? current : this._variableWorkingCopy(current);
    const draft = isTheme ? this._themeDraft : this._variableDraft;
    if (!draft) return;
    const result = mergeFields(before, draft, after);
    let resolved = result.value;
    if (result.conflicts.length) {
      this._sharedConflict = true;
      window.clearTimeout(this._saveSoonTimer);
      this._saveSoonTimer = null;
      try {
        resolved = await this._chooseConflictValues(
          { base: before, current: after, fields: result.conflicts },
          draft
        );
      } finally {
        this._sharedConflict = false;
      }
    }
    this._rebaseLibraryHistory(kind, before, after);
    if (isTheme) {
      patchInPlace(this._themeDraft, resolved);
      this._themeBase = structuredClone(item);
      this._patchDialFromSession({ applyTheme: true });
      this._syncThemePreviewSurfaces();
    } else {
      patchInPlace(this._variableDraft, resolved);
      this._variableBase = structuredClone(item);
      this._variableWheel?.sync();
      const brightnessField = [...(this.shadowRoot?.querySelectorAll(".library-editor ha-input") || [])]
        .find((field) => field.label === this._t("frontend.lights.brightness", "Brightness"));
      if (brightnessField && this._view === "variable") {
        brightnessField.value = String(this._variableDraft.colorDraft?.brightness ?? 255);
      }
    }
    this._syncAppBarTitle();
    if (JSON.stringify(resolved) !== JSON.stringify(after)) this._saveSoon();
    else this._sessionBaseline = this._snapshotSession();
  },

  _showDeletedDraftBanner() {
    const stage = this._contentEl?.querySelector(".stage-col");
    const scroll = (stage && this._stageScrollEl(stage)) ||
      this._contentEl?.querySelector(".library-editor, .simple-editor-host") || this._contentEl;
    if (!scroll || scroll.querySelector(".deleted-draft-banner")) return;
    const banner = document.createElement("p");
    banner.className = "deleted-draft-banner error";
    banner.setAttribute("role", "alert");
    banner.textContent = this._t("frontend.conflict.deleted", "This item was deleted. Your unsaved draft remains here for copying.");
    scroll.prepend(banner);
  },

  _receiveSavedChange(event) {
    this._catalogRefresher ||= createCatalogRefresher(events => this._refreshSavedChanges(events));
    return this._catalogRefresher(event);
  },

  async _refreshSavedChanges(events) {
    const generation = ++this._collabRefreshGeneration;
    try {
      const scoped = events.every(event => event.id && ["scene", "theme", "variable"].includes(event.kind));
      const response = await this._hass.callWS(scoped
        ? { type: `${DOMAIN}/catalog_changes`, changes: events.map(({ kind, id }) => ({ kind, id })) }
        : { type: `${DOMAIN}/list` });
      const payload = mergeCatalogPatch({ scenes: this._items, variables: this._variables,
        themes: this._themes, floors: this._floors, settings: this._settings }, response);
      if (!this.isConnected || generation !== this._collabRefreshGeneration) return;
      const before = this._sceneBase;
      const openId = this._view === "edit" ? this._editId : null;
      const saved = openId && (payload.scenes || []).find((item) => item.id === openId);
      this._applyAreaCatalog(payload);
      if (events.some(event => event.kind === "settings")) this._refreshDuskVisuals();
      if (this._themeDraft?.id) {
        await this._applyRemoteLibrary(
          "theme", this._themeDraft.id,
          this._themes.find((item) => item.id === this._themeDraft.id) || null
        );
      }
      if (this._variableId) {
        await this._applyRemoteLibrary(
          "variable", this._variableId,
          this._variables.find((item) => item.id === this._variableId) || null
        );
      }
      if (events.some(event => event.kind === "theme" || event.kind === "variable")) {
        this._clearPreviewCache();
        this._patchDialFromSession({ applyTheme: true });
        this._refreshInheritedLightDrafts?.();
      }
      if (!openId) return;
      if (!saved) {
        this._sceneDeleted = true;
        window.clearTimeout(this._saveSoonTimer);
        this._saveSoonTimer = null;
        this._showDeletedDraftBanner();
        return;
      }
      if (!before || !saved.revision || saved.revision === this._sceneRevision) return;
      if (this._sceneConflict?.revision === saved.revision) return;
      const next = mergeFields(before, this._formData, saved.form);
      if (next.conflicts.length) {
        this._sceneConflict = {
          fields: next.conflicts,
          current: saved.form,
          revision: saved.revision,
          base: before,
        };
        window.clearTimeout(this._saveSoonTimer);
        this._saveSoonTimer = null;
        this._showSceneConflict();
        return;
      }
      this._rebaseSceneHistory(before, saved.form);
      patchInPlace(this._formData, next.value);
      this._sceneBase = structuredClone(saved.form);
      this._sceneRevision = saved.revision;
      this._syncAppBarTitle();
      this._patchDialFromSession();
      this._refreshInheritedLightDrafts?.();
      this._syncSceneUsed();
      if (JSON.stringify(next.value) !== JSON.stringify(saved.form)) this._saveSoon();
      else this._sessionBaseline = this._snapshotSession();
    } catch (error) {
      this._error = error.message || String(error);
    }
  },

  async _refreshAreasFromRegistry() {
    try {
      const payload = await this._hass.callWS({ type: `${DOMAIN}/list` });
      if (this.isConnected) this._applyAreaCatalog(payload);
    } catch (error) {
      this._error = error.message || String(error);
    }
  },

  async _saveLibraryItem(kind, data, baseItem = null) {
    const type = kind === "theme" ? "save_theme" : "save_variable";
    let base = baseItem || (kind === "theme" ? this._themes : this._variables)?.find((item) => item.id === data.id);
    let revision = base?.revision;
    if (base) {
      base = structuredClone(base);
      delete base.revision;
    }
    if (data.id && (!base || !revision)) {
      throw new Error(this._t("frontend.conflict.reload", "Reload this item before saving"));
    }
    let draft = structuredClone(data);
    for (;;) {
      const result = await this._hass.callWS({
        type: `${DOMAIN}/${type}`,
        data: draft,
        ...(data.id ? { base, base_revision: revision } : {}),
      });
      if (result.status !== "conflict") return result;
      this._sharedConflict = true;
      try {
        draft = await this._chooseConflictValues(
          { base, current: result.current, fields: result.fields },
          draft
        );
      } finally {
        this._sharedConflict = false;
      }
      base = structuredClone(result.current);
      revision = result.revision;
    }
  },

  async _saveSceneItem(scene, data) {
    let base = structuredClone(scene.form || scene);
    let revision = scene.revision;
    if (!revision) throw new Error(this._t("frontend.conflict.reload", "Reload this item before saving"));
    let draft = structuredClone(data);
    for (;;) {
      const result = await this._hass.callWS({
        type: `${DOMAIN}/save`,
        scene_id: scene.id,
        data: draft,
        base,
        base_revision: revision,
      });
      if (result.status !== "conflict") return result;
      this._sharedConflict = true;
      try {
        draft = await this._chooseConflictValues(
          { base, current: result.current, fields: result.fields },
          draft
        );
      } finally {
        this._sharedConflict = false;
      }
      base = structuredClone(result.current);
      revision = result.revision;
    }
  },

  async _saveVariableQuiet() {
    const payload = this._variableSavePayload();
    const data = payload && structuredClone(payload);
    if (!data) {
      return;
    }
    if (this._saving) {
      this._saveSoon();
      return;
    }
    this._saving = true;
    const editingId = this._variableId;
    const editingView = this._view;
    const savingRevision = this._variableBase?.revision;
    try {
      const saved = await this._saveLibraryItem("variable", data, this._variableBase);
      if (this._sharedDeleted) return;
      if (this._variableId === editingId && this._variableBase?.revision !== savingRevision) {
        if (!this._sharedConflict && !this._sharedDeleted) this._saveSoon();
        return;
      }
      const list = [...(this._variables || [])];
      const index = list.findIndex((item) => item.id === saved.id);
      if (index >= 0) {
        list[index] = saved;
      } else {
        list.push(saved);
      }
      this._variables = list;
      if (this._variableId !== editingId || this._view !== editingView) return;
      this._variableId = saved.id;
      this._variableBase = structuredClone(saved);
      this._alignLibraryView(saved);
      const latest = this._variableSavePayload();
      const next = reconcileSaveResponse(data, latest, saved);
      if (next.conflicts.length) {
        this._sharedConflict = true;
        try {
          const resolved = await this._chooseConflictValues(
            { base: data, current: saved, fields: next.conflicts }, latest
          );
          patchInPlace(this._variableDraft, this._variableWorkingCopy(resolved));
        } finally {
          this._sharedConflict = false;
        }
        this._saveSoon();
      } else {
        patchInPlace(this._variableDraft, this._variableWorkingCopy(next.value));
      }
      if (next.changedDuringSave && !next.conflicts.length) {
        this._saveSoon();
      } else if (!next.conflicts.length && (this._view === "variable" || this._view === "palette")) {
        this._sessionBaseline = this._snapshotSession();
      }
      const hash = this._canonicalLibraryHash(saved);
      if (this._currentHash() !== hash) {
        history.replaceState(null, "", this._hashHref(hash));
      }
    } catch (err) {
      this._error = err.message || String(err);
    } finally {
      this._saving = false;
    }
  },

  _saveSoon() {
    this._stampHistoryAfter();
    this._syncSaveFab();
    this._syncSceneUsed();
    if (this._historyRestoring) {
      return;
    }
    if (this._sceneConflict || this._sceneDeleted || this._sharedConflict || this._sharedDeleted) return;
    window.clearTimeout(this._saveSoonTimer);
    this._saveSoonTimer = window.setTimeout(() => {
      this._saveSoonTimer = null;
      void this._saveNow();
    }, 250);
  },

  async _showSceneConflict() {
    const conflict = this._sceneConflict;
    if (!conflict || !conflict.fields.length) return;
    const resolved = await this._chooseConflictValues(conflict, this._formData);
    if (this._sceneConflict !== conflict || this._sceneDeleted) return;
    patchInPlace(this._formData, resolved);
    this._sceneBase = structuredClone(conflict.current);
    this._sceneRevision = conflict.revision;
    this._sceneConflict = null;
    this._saveSoon();
  },

  async _saveNow({ fromHistory = false } = {}) {
    window.clearTimeout(this._saveSoonTimer);
    this._saveSoonTimer = null;
    this._stampHistoryAfter();
    if (this._sharedConflict || this._sharedDeleted) return;
    if (this._view === "theme" && this._themeDraft) {
      await this._saveThemeQuiet();
      return;
    }
    if (this._view === "variable" || this._view === "palette") {
      await this._saveVariableQuiet();
      return;
    }
    if (this._view !== "edit") {
      return;
    }
    if (this._sceneConflict || this._sceneDeleted) return;
    if (!this._formData?.area) {
      return;
    }
    if (this._saving) {
      this._saveSoon();
      return;
    }
    const savingId = this._editId;
    const savingBase = this._sceneBase ? structuredClone(this._sceneBase) : null;
    const savingRevision = this._sceneRevision;
    this._saving = true;
    this._error = null;
    try {
      await this._flushNativeDrafts();
      const savingData = structuredClone(this._formData);
      const saved = await this._hass.callWS({
        type: `${DOMAIN}/save`,
        scene_id: savingId || undefined,
        data: savingData,
        ...(savingId ? { base: savingBase, base_revision: savingRevision } : {}),
      });
      if (saved.status === "conflict") {
        if (this._view === "edit" && this._editId === savingId) {
          if (this._sceneRevision !== savingRevision) {
            this._saveSoon();
            return;
          }
          this._sceneConflict = {
            fields: [...saved.fields],
            current: saved.current,
            revision: saved.revision,
            base: savingBase,
          };
          this._showSceneConflict();
        }
        return;
      }
      // A collaborator's notification can arrive while this request is in
      // flight. Its newer revision must remain the editor's source of truth.
      const superseded = savingId && this._sceneRevision !== savingRevision;
      if (!superseded) this._upsertSceneInList(saved);
      // A solar-event sidebar closes with an unawaited save. If the user
      // already opened another scene, writing this id back deselects that card.
      const stayed = this._view === "edit" && this._editId === savingId;
      if (!stayed) {
        this._syncRailSelection();
        return;
      }
      if (superseded || this._sceneDeleted) {
        if (!this._sceneConflict && !this._sceneDeleted) this._saveSoon();
        return;
      }
      const wasNew = !savingId;
      this._editId = saved.id;
      this._sceneBase = structuredClone(saved.form || saved);
      this._sceneRevision = saved.revision;
      const next = reconcileSaveResponse(savingData, this._formData, this._sceneBase);
      if (next.conflicts.length) {
        this._sceneConflict = {
          fields: next.conflicts,
          current: this._sceneBase,
          revision: this._sceneRevision,
          base: savingData,
        };
        void this._showSceneConflict();
      } else {
        patchInPlace(this._formData, next.value);
        if (next.changedDuringSave) this._saveSoon();
        else this._sessionBaseline = this._snapshotSession();
      }
      if (!next.conflicts.length) {
        this._clearPersistedDraft();
        this._clearPersistedDraft("new");
      }
      if (wasNew) {
        for (const entry of [...this._undoStack, ...this._redoStack]) {
          if (entry.target?.view === "edit" && !entry.target.editId) {
            entry.target.editId = saved.id;
          }
        }
        if (!fromHistory) {
          this._leaveConfirmDone = true;
          history.replaceState(null, "", this._hashHref(`edit/${saved.id}`));
        }
      }
      if (this._themeDraft) {
        await this._saveThemeQuiet();
      }
      this._stampHistoryAfter();
    } catch (err) {
      this._error = err.message || String(err);
    } finally {
      this._saving = false;
    }
  },

  async _saveThemeQuiet() {
    if (!this._themeDraft) {
      return;
    }
    if (!(this._themeDraft.name || "").trim()) {
      return;
    }
    const savingThemeId = this._themeId;
    const savingDraft = structuredClone(this._themeDraft);
    const savingRevision = this._themeBase?.revision;
    try {
      const saved = await this._saveLibraryItem("theme", savingDraft, this._themeBase);
      if (this._sharedDeleted) return;
      if (this._themeBase?.revision !== savingRevision) {
        if (!this._sharedConflict && !this._sharedDeleted) this._saveSoon();
        return;
      }
      const stayed = this._view === "theme" && this._themeId === savingThemeId;
      const sameDraft = this._themeDraft?.id === savingDraft.id &&
        (this._view === "theme" || this._view === "edit");
      const next = sameDraft
        ? reconcileSaveResponse(savingDraft, this._themeDraft, saved)
        : null;
      this._adoptSavedTheme(saved, { adoptDraft: false });
      if (sameDraft) this._themeBase = structuredClone(saved);
      if (next?.conflicts.length) {
        this._sharedConflict = true;
        try {
          const resolved = await this._chooseConflictValues(
            { base: savingDraft, current: saved, fields: next.conflicts }, this._themeDraft
          );
          patchInPlace(this._themeDraft, resolved);
        } finally {
          this._sharedConflict = false;
        }
        this._saveSoon();
      } else if (next) {
        patchInPlace(this._themeDraft, next.value);
        if (next.changedDuringSave) this._saveSoon();
      }
      if (stayed) {
        this._themeId = saved.id;
        if (!next?.changedDuringSave && !next?.conflicts.length) {
          this._sessionBaseline = this._snapshotSession();
        }
        if (this._currentHash() !== `theme/${saved.id}`) {
          history.replaceState(null, "", this._hashHref(`theme/${saved.id}`));
        }
      }
      await this._refreshListItemsSilent({ kind: "theme", id: saved.id });
      if (this._themeDraft) {
        this._syncThemePreviewSurfaces();
      }
    } catch (err) {
      this._error = err.message || String(err);
    }
  },

  async _refreshListItemsSilent(change) {
    try {
      const response = await this._hass.callWS({ type: `${DOMAIN}/catalog_changes`, changes: [change] });
      const payload = mergeCatalogPatch({ scenes: this._items, variables: this._variables, themes: this._themes }, response);
      this._items = payload?.scenes || this._items;
      this._themes = payload?.themes || this._themes;
      this._variables = payload?.variables || this._variables;
      this._syncRailCardBackgrounds();
    } catch (_err) {
      /* keep the current rail */
    }
  },

  _syncRailCardBackgrounds() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }
    for (const scene of this._items || []) {
      const card = root.querySelector(
        `.scene-card[data-scene-id="${CSS.escape(scene.id)}"]`
      );
      if (!card) {
        continue;
      }
      if (scene.kind === "simple") {
        const meshes = card.parentElement?.querySelectorAll("canvas.card-mesh");
        for (const mesh of meshes || []) {
          paintSimpleCardMesh(mesh, scene.card?.dots);
        }
        continue;
      }
      const bg = card.querySelector(".card-bg");
      if (!bg) {
        continue;
      }
      applyCircularRamp(bg, scene.card?.ramps);
    }
  },

  _syncThemePreviewSurfaces() {
    const theme = this._themeDraft;
    if (!theme) {
      return;
    }
    const root = this.shadowRoot;
    if (!root) {
      return;
    }
    const variables = this._variables || [];
    const themeId = this._themeLookId();
    for (const scene of this._items || []) {
      if (scene.kind === "simple") {
        continue;
      }
      if ((scene.theme_id || "default") !== themeId) {
        continue;
      }
      const overrides =
        this._view === "edit" && scene.id === this._editId
          ? this._formData?.overrides || scene.overrides
          : scene.overrides;
      const ramps = previewRampsForTheme(scene, theme, variables, overrides);
      if (scene.card) {
        scene.card = { ...scene.card, ramps };
      }
      const card = root.querySelector(
        `.scene-card[data-scene-id="${CSS.escape(scene.id)}"]`
      );
      const bg = card?.querySelector(".card-bg");
      if (bg) {
        applyCircularRamp(bg, ramps);
      }
      const glow = card?.parentElement?.querySelector(":scope > .card-glow");
      if (glow?.classList.contains("card-bg")) {
        applyCircularRamp(glow, ramps);
      }
    }
    const chipDial = root.querySelector(
      `.theme-chip[data-theme-id="${CSS.escape(themeId)}"] .theme-dial`
    );
    if (chipDial) {
      paintThemeDial(chipDial, theme, variables);
    }
  }
};
