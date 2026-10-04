/* editor history owns these panel methods.
 * The receiver is the panel: navigation, rendering and saving remain host hooks.
 * Keep closures bound to that receiver; do not bind methods to a separate object. */
import { DOMAIN, UNDO_STACK_LIMIT } from "./panel_constants.js";
import { mergeFields } from "./collaboration.js";
import { captureWheelPinPositions } from "./color_ui.js";

export const editorHistoryMethods = {
  _noteSimpleDirty() {
    this._sessionDirty = true;
    this._saveSoon();
  },

  // Simple-scene light edits share the global undo stack. The snapshot is the
  // scene before the write; a drag or scroll stays one entry until the gesture ends.
  _beginSimpleUndo() {
    if (this._historyRestoring) {
      return;
    }
    if (!this._simpleUndoLatched) {
      this._simpleUndoLatched = true;
      this._commitUndo({ type: "simple" });
    }
    window.clearTimeout(this._simpleUndoEndTimer);
    if (this._simpleUndoHold) {
      this._simpleUndoEndTimer = null;
      return;
    }
    this._simpleUndoEndTimer = window.setTimeout(() => {
      this._simpleUndoEndTimer = null;
      this._finishSimpleUndo();
    }, 400);
  },

  _holdSimpleUndo(hold) {
    if (hold) {
      if (!this._simpleUndoHold && this._simpleUndoLatched) {
        this._finishSimpleUndo();
      }
      this._simpleUndoHold = true;
      window.clearTimeout(this._simpleUndoEndTimer);
      this._simpleUndoEndTimer = null;
      return;
    }
    this._simpleUndoHold = false;
    window.clearTimeout(this._simpleUndoEndTimer);
    this._simpleUndoEndTimer = null;
    this._finishSimpleUndo();
  },

  _finishSimpleUndo() {
    window.clearTimeout(this._simpleUndoEndTimer);
    this._simpleUndoEndTimer = null;
    if (!this._simpleUndoLatched) {
      return;
    }
    this._stampHistoryAfter();
    this._simpleUndoLatched = false;
  },

  _rebaseSceneHistory(before, after) {
    for (const entry of [...this._undoStack, ...this._redoStack]) {
      if (entry.target?.view !== "edit" || entry.target.editId !== this._editId) continue;
      for (const snapshot of [entry.session, entry.after]) {
        if (snapshot?.form) snapshot.form = mergeFields(before, snapshot.form, after).value;
      }
    }
  },

  _rebaseLibraryHistory(kind, before, after) {
    const field = kind === "theme" ? "theme" : "variable";
    const targetField = kind === "theme" ? "themeId" : "variableId";
    const openId = kind === "theme" ? this._themeId : this._variableId;
    for (const entry of [...this._undoStack, ...this._redoStack]) {
      if (entry.target?.[targetField] !== openId) continue;
      for (const snapshot of [entry.session, entry.after]) {
        if (snapshot?.[field]) snapshot[field] = mergeFields(before, snapshot[field], after).value;
      }
    }
  },

  _commitCreatedUndo({ kind, id, record, beforeTarget }) {
    this._undoStack.push({
      session: this._snapshotSession(),
      after: { created: { kind, id, record } },
      target: beforeTarget || this._historyTarget(),
      created: { kind, id, record },
      focus: null,
    });
    if (this._undoStack.length > UNDO_STACK_LIMIT) {
      this._undoStack.shift();
    }
    this._redoStack = [];
    this._syncUndoButtons();
  },

  _createdHistoryTarget(created) {
    if (created.kind === "scene") {
      return { view: "edit", editId: created.id, themeId: null, variableId: null };
    }
    if (created.kind === "theme") {
      return { view: "theme", editId: null, themeId: created.id, variableId: null };
    }
    if (created.kind === "palette") {
      return {
        view: "palette",
        editId: null,
        themeId: null,
        variableId: created.id,
      };
    }
    return {
      view: "variable",
      editId: null,
      themeId: null,
      variableId: created.id,
    };
  },

  async _deleteCreated(created) {
    if (!created?.id) {
      return;
    }
    if (created.kind === "scene") {
      await this._hass.callWS({
        type: `${DOMAIN}/delete`,
        scene_id: created.id,
      });
      this._dropSceneFromList(created.id);
      return;
    }
    if (created.kind === "theme") {
      await this._hass.callWS({
        type: `${DOMAIN}/delete_theme`,
        theme_id: created.id,
      });
      this._themes = (this._themes || []).filter((item) => item.id !== created.id);
      if (this._themeId === created.id) {
        this._themeId = null;
        this._themeDraft = null;
      }
      return;
    }
    await this._hass.callWS({
      type: `${DOMAIN}/delete_variable`,
      variable_id: created.id,
    });
    this._variables = (this._variables || []).filter(
      (item) => item.id !== created.id
    );
    if (this._variableId === created.id) {
      this._variableId = null;
      this._variableDraft = null;
    }
  },

  async _recreateCreated(created) {
    if (!created?.record) {
      return;
    }
    if (created.kind === "scene") {
      const data = structuredClone(created.record.form || created.record);
      delete data.id;
      const saved = await this._hass.callWS({
        type: `${DOMAIN}/save`,
        data,
      });
      created.id = saved.id;
      created.record = saved;
      this._upsertSceneInList(saved);
      return;
    }
    if (created.kind === "theme") {
      const data = structuredClone(created.record);
      delete data.id;
      delete data.revision;
      const saved = await this._hass.callWS({
        type: `${DOMAIN}/save_theme`,
        data,
      });
      created.id = saved.id;
      created.record = saved;
      this._adoptSavedTheme(saved);
      return;
    }
    const data = structuredClone(created.record);
    delete data.id;
    delete data.revision;
    const saved = await this._hass.callWS({
      type: `${DOMAIN}/save_variable`,
      data,
    });
    created.id = saved.id;
    created.record = saved;
    const list = [...(this._variables || [])];
    const index = list.findIndex((item) => item.id === saved.id);
    if (index >= 0) {
      list[index] = saved;
    } else {
      list.push(saved);
    }
    this._variables = list;
  },

  _undoRedoButton(kind) {
    const undo = kind === "undo";
    const button = document.createElement("ha-icon-button");
    button.id = undo ? "button-undo" : "button-redo";
    button.label = undo
      ? this._loc("ui.common.undo", "Undo")
      : this._loc("ui.common.redo", "Redo");
    button.disabled = undo ? !this._undoStack.length : !this._redoStack.length;
    const icon = document.createElement("ha-icon");
    icon.setAttribute("icon", undo ? "mdi:undo" : "mdi:redo");
    button.appendChild(icon);
    button.addEventListener("click", () => {
      if (undo) {
        this._undo();
      } else {
        this._redo();
      }
    });
    if (customElements.get("ha-tooltip")) {
      const tip = document.createElement("ha-tooltip");
      tip.placement = "bottom";
      const label = document.createElement("span");
      label.textContent = `${button.label} `;
      const shortcut = document.createElement("span");
      shortcut.className = "shortcut";
      shortcut.textContent = this._shortcutLabel(undo ? "undo" : "redo");
      tip.append(label, shortcut);
      button.appendChild(tip);
      // `for` looks up an id on the root node. A disconnected button is not a
      // document, so set it only after the button is in the shadow root.
      const bindTip = () => {
        const root = button.getRootNode();
        if (typeof root?.getElementById !== "function") {
          return;
        }
        tip.setAttribute("for", button.id);
      };
      if (button.isConnected) {
        bindTip();
      } else {
        queueMicrotask(bindTip);
      }
    }
    return button;
  },

  _shortcutLabel(kind) {
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    if (kind === "undo") {
      return mac ? "⌘Z" : "Ctrl+Z";
    }
    return mac ? "⌘⇧Z" : "Ctrl+Y";
  },

  _resetSession() {
    this._nativeDrafts = {};
    this._previewOverlay = null;
    this._sessionBaseline = this._snapshotSession();
    this._syncUndoButtons();
    this._syncSaveFab();
  },

  _historyTarget() {
    return {
      view: this._view,
      editId: this._editId,
      themeId: this._themeId,
      variableId: this._variableId,
    };
  },

  _sameHistoryTarget(target) {
    return (
      target &&
      target.view === this._view &&
      target.editId === this._editId &&
      target.themeId === this._themeId &&
      target.variableId === this._variableId
    );
  },

  _stampHistoryAfter() {
    const last = this._undoStack[this._undoStack.length - 1];
    if (!last || !this._sameHistoryTarget(last.target)) {
      return;
    }
    last.after = this._snapshotSession();
  },

  _snapshotSession() {
    return {
      form: structuredClone(this._formData),
      nativeDrafts: structuredClone(this._nativeDrafts),
      theme: this._themeDraft ? structuredClone(this._themeDraft) : null,
      variable: this._variableDraft ? structuredClone(this._variableDraft) : null,
    };
  },

  _needsLeaveConfirm() {
    return false;
  },

  async _confirmLeaveEditor() {
    this._forceCloseSceneSidebar();
    window.clearTimeout(this._saveSoonTimer);
    this._saveSoonTimer = null;
    await this._saveNow();
    return true;
  },

  _commitUndo(focus = null) {
    this._undoStack.push({
      session: this._snapshotSession(),
      after: null,
      target: this._historyTarget(),
      focus: focus || this._currentUndoFocus(),
    });
    if (this._undoStack.length > UNDO_STACK_LIMIT) {
      this._undoStack.shift();
    }
    this._redoStack = [];
    this._syncUndoButtons();
    queueMicrotask(() => {
      this._saveSoon();
    });
  },

  _currentUndoFocus() {
    const lightId = this._sidebarLightId;
    const themeLight =
      typeof lightId === "string" && lightId.startsWith("theme:");
    if (lightId && !themeLight) {
      return {
        type: "light",
        lightId,
        eventId: this._sidebarEventId,
      };
    }
    if (this._sidebarEventId) {
      return {
        type: "theme-event",
        eventId: this._sidebarEventId,
      };
    }
    return null;
  },

  _applySession(snapshot, { remount = true, keepLightSidebar = false } = {}) {
    if (!keepLightSidebar) {
      this._forceCloseSceneSidebar();
    }
    this._formData = structuredClone(snapshot.form);
    this._nativeDrafts = structuredClone(snapshot.nativeDrafts);
    this._removedLights = [];
    if (snapshot.theme) {
      this._themeDraft = structuredClone(snapshot.theme);
    } else {
      this._themeDraft = null;
    }
    if (Object.prototype.hasOwnProperty.call(snapshot, "variable")) {
      this._variableDraft = snapshot.variable
        ? structuredClone(snapshot.variable)
        : null;
    }
    this._syncAppBarTitle();
    this._syncPreviewOverlay();
    this._sunPath = null;
    this._clearPreviewCache();
    this._syncUndoButtons();
    this._syncSaveFab();
    if (
      remount &&
      (this._view === "edit" ||
        this._view === "theme" ||
        this._view === "palette" ||
        this._view === "variable")
    ) {
      this._render();
    }
  },

  _revealHistoryFocus(focus) {
    const event =
      (this._sunPath?.events || []).find((row) => row.id === focus?.eventId) ||
      (this._sunPath?.events || [])[0];
    if (focus?.type === "light" && focus.lightId) {
      const light = (this._sunPath?.lights || []).find(
        (row) => row.entity_id === focus.lightId
      );
      if (light && event) {
        this._setSidebarEvent(event.id);
        this._selectCircadianLight(light.entity_id);
      }
      return;
    }
    if (["theme-event", "event-lights", "event-randomize"].includes(focus?.type) && event) {
      void this._openThemeEventSidebar(event);
    }
  },

  async _openHistoryTarget(target) {
    if (!target || this._sameHistoryTarget(target)) {
      return;
    }
    this._eventGuidance?.cancel();
    this._sidebarEventId = null;
    this._legendSelectedIds = new Set();
    this._circadianAnchor = null;
    this._circadianTouchSelect = false;
    this._leaveConfirmDone = true;
    if (target.view === "theme" && target.themeId) {
      this._view = "theme";
      this._themeId = target.themeId;
      this._editId = null;
      this._variableId = null;
      history.replaceState(null, "", this._hashHref(`theme/${target.themeId}`));
      await this._loadTheme(target.themeId);
      return;
    }
    if (target.view === "variable" || target.view === "palette") {
      this._view = target.view;
      this._editId = null;
      this._themeId = null;
      const id = target.variableId;
      if (id) {
        this._variableId = id;
        const prefix = target.view === "palette" ? "palette" : "variable";
        history.replaceState(null, "", this._hashHref(`${prefix}/${id}`));
        await this._loadVariable(id);
        return;
      }
    }
    if (target.view === "edit") {
      this._view = "edit";
      this._themeId = null;
      if (target.editId) {
        this._editId = target.editId;
        history.replaceState(null, "", this._hashHref(`edit/${target.editId}`));
        await this._loadItem(target.editId);
        return;
      }
      this._editId = null;
      history.replaceState(null, "", this._hashHref("new"));
      this._render();
      return;
    }
    this._view = "list";
    this._editId = null;
    this._themeId = null;
    history.replaceState(null, "", this._hashHref(""));
    await this._loadList();
  },

  async _restoreHistory(entry, which) {
    if (entry?.created) {
      this._historyRestoring = true;
      try {
        if (which === "before") {
          await this._deleteCreated(entry.created);
          await this._openHistoryTarget(entry.target);
        } else {
          await this._recreateCreated(entry.created);
          await this._openHistoryTarget(this._createdHistoryTarget(entry.created));
        }
      } finally {
        this._historyRestoring = false;
      }
      return;
    }
    const snap = which === "after" ? entry.after || entry.session : entry.session;
    if (!snap) {
      return;
    }
    const focus = entry.focus || null;
    const lightSidebar = this.shadowRoot?.querySelector(
      ".scene-sidebar.light-dialog"
    );
    const keepLightSidebar =
      which === "before" &&
      focus?.type === "light" &&
      focus.lightId &&
      lightSidebar &&
      !lightSidebar._closing &&
      lightSidebar._lightEntityId === focus.lightId &&
      typeof lightSidebar._reloadDrafts === "function";
    this._historyRestoring = true;
    try {
      await this._openHistoryTarget(entry.target);
      this._applySession(snap, { remount: false, keepLightSidebar });
      await this._saveNow({ fromHistory: true });
      if (
        this._view === "edit" ||
        this._view === "theme" ||
        this._view === "palette" ||
        this._view === "variable"
      ) {
        this._wheelPinFlip = captureWheelPinPositions(this.shadowRoot);
        this._render();
        this._wheelPinFlip = null;
      }
      this._clearPreviewCache();
      await this._ensureSunPath();
      if (keepLightSidebar && lightSidebar.isConnected) {
        lightSidebar._reloadDrafts();
      } else {
        this._revealHistoryFocus(focus);
      }
    } finally {
      this._historyRestoring = false;
    }
  },

  _undo() {
    this._finishSimpleUndo();
    if (!this._undoStack.length || this._historyRestoring) {
      return;
    }
    const entry = this._undoStack.pop();
    if (entry && this._sameHistoryTarget(entry.target)) {
      entry.after = this._snapshotSession();
    }
    this._redoStack.push({
      session: entry.session,
      after: entry.after || this._snapshotSession(),
      target: entry.target || this._historyTarget(),
      focus: entry.focus || null,
      created: entry.created || null,
    });
    void this._restoreHistory(entry, "before");
    this._syncUndoButtons();
  },

  _redo() {
    this._finishSimpleUndo();
    if (!this._redoStack.length || this._historyRestoring) {
      return;
    }
    const entry = this._redoStack.pop();
    this._undoStack.push(entry);
    void this._restoreHistory(entry, "after");
    this._syncUndoButtons();
  },

  _syncUndoButtons() {
    if (this._undoBtn) {
      this._undoBtn.disabled = !this._undoStack.length;
    }
    if (this._redoBtn) {
      this._redoBtn.disabled = !this._redoStack.length;
    }
    if (this._sidebarUndoBtn) {
      this._sidebarUndoBtn.disabled = !this._undoStack.length;
    }
    if (this._sidebarRedoBtn) {
      this._sidebarRedoBtn.disabled = !this._redoStack.length;
    }
  },

  _handleEditorShortcut(ev) {
    if (!this.isConnected) {
      return;
    }
    if (
      this._view !== "edit" &&
      this._view !== "theme" &&
      this._view !== "list" &&
      this._view !== "variables" &&
      this._view !== "variable" &&
      this._view !== "palette"
    ) {
      return;
    }
    if (!ev.ctrlKey && !ev.metaKey) {
      return;
    }
    if (ev.altKey) {
      return;
    }
    const path = ev.composedPath();
    if (
      path.some((node) => {
        const tag = node.tagName;
        return (
          node.isContentEditable ||
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT"
        );
      })
    ) {
      return;
    }
    const key = ev.key.toLowerCase();
    if (key === "z" && ev.shiftKey) {
      ev.preventDefault();
      this._redo();
      return;
    }
    if (key === "z") {
      ev.preventDefault();
      this._undo();
      return;
    }
    if (key === "y") {
      ev.preventDefault();
      this._redo();
    }
  }
};
