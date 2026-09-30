/** Shared editor mounting and motion primitives. */

export function waitForSurfaceAnimation(el, name, fallbackMs) {
    return new Promise((resolve) => {
      if (!el) {
        resolve();
        return;
      }
      let done = false;
      const finish = () => {
        if (done) {
          return;
        }
        done = true;
        el.removeEventListener("animationend", onEnd);
        resolve();
      };
      const onEnd = (ev) => {
        if (ev.target !== el) {
          return;
        }
        if (name && ev.animationName && ev.animationName !== name) {
          return;
        }
        finish();
      };
      el.addEventListener("animationend", onEnd);
      window.setTimeout(finish, fallbackMs);
    });
}

export function createStageColumn() {
  const stage = document.createElement("div");
  stage.className = "stage-col";
  const bg = document.createElement("div");
  bg.className = "stage-bg";
  bg.setAttribute("aria-hidden", "true");
  const scroll = document.createElement("div");
  scroll.className = "stage-scroll";
  stage.append(bg, scroll);
  return { stage, bg, scroll };
}


/** Stable regions; editor adapters retain ownership of their mounted controls. */
export function createEditorShell() {
  const el = document.createElement("div");
  el.className = "editor-shell";
  const toolbar = document.createElement("div");
  toolbar.className = "editor-toolbar";
  const preview = document.createElement("div");
  preview.className = "editor-preview";
  const lights = document.createElement("div");
  lights.className = "editor-lights";
  lights.hidden = true;
  el.append(toolbar, preview, lights);
  return { el, toolbar, preview, lights };
}

export function mountEditorRegions(shell, { mount, visual, toolbar, lights }) {
  if (shell.el.parentNode !== mount) mount.appendChild(shell.el);
  // Move controls before mounting their former parent into the preview.
  if (toolbar.length !== shell.toolbar.children.length ||
      toolbar.some((node, index) => shell.toolbar.children[index] !== node)) {
    shell.toolbar.replaceChildren(...toolbar);
  }
  if (lights && shell.lights.firstChild !== lights) shell.lights.replaceChildren(lights);
  shell.lights.hidden = !lights;
  if (!lights) shell.lights.replaceChildren();
  if (shell.preview.firstChild !== visual) shell.preview.replaceChildren(visual);
}

export const EDITOR_SHELL_CSS = `
  .editor-shell {
    position: relative;
    display: grid;
    grid-template-rows: auto minmax(var(--editor-preview-floor, 456px), 1fr) auto;
    width: 100%;
    min-width: 0;
    min-height: 0;
    overflow: visible;
  }
  :host([narrow]) .editor-shell { --editor-preview-floor: 0px; }
  .editor-toolbar {
    position: relative;
    z-index: 15;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 12px;
    padding: 12px 16px;
    min-width: 0;
  }
  .editor-toolbar:empty { padding: 0; }
  .editor-preview {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    min-height: 0;
  }
  .editor-lights {
    position: relative;
    z-index: 12;
    width: 100%;
    min-width: 0;
    padding: 0 0 16px;
  }
  .editor-lights[hidden] { display: none; }
  .editor-preview > .simple-editor-host,
  .editor-preview > .library-editor,
  .editor-preview > .sun-path {
    width: 100%;
    height: 100%;
    min-height: 0;
    margin: 0;
    padding: 0;
  }
  .editor-shell .simple-editor {
    height: 100%;
    min-height: 0;
    padding: 0;
    gap: 0;
    overflow: visible;
  }
  .editor-shell .simple-wheels {
    min-height: 0;
    height: 100%;
    padding: 0 16px;
    align-items: center;
    justify-content: center;
  }
  .editor-shell .sun-path.dial-view,
  .editor-shell .sun-path.dial-view .sun-path-stage,
  .editor-shell .sun-path.dial-view .sun-path-body {
    height: 100%;
    min-height: 0;
    align-items: center;
    justify-content: center;
  }
  .editor-shell .sun-path.dial-view .sun-light-clock {
    height: 100%;
    min-height: 0;
    padding: 28px 0;
    margin: 0;
    justify-content: center;
  }
  .editor-shell .sun-light-clock-face {
    margin-top: 0 !important;
    margin-bottom: 0 !important;
  }
  .editor-toolbar .scene-used,
  .editor-toolbar .library-used-by {
    position: static;
    width: auto;
    max-width: 100%;
    padding: 0;
    margin: 0;
    pointer-events: auto;
    flex: 0 1 auto;
  }
  .editor-toolbar .sun-toolbar { width: 100%; margin: 0; padding: 0; }
  .editor-toolbar .sun-toolbar-chrome,
  .editor-toolbar .sun-hover-readout {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    position: static;
    width: auto;
    max-width: 100%;
    margin: 0;
    padding: 0;
  }
  .editor-toolbar .sun-toolbar-chrome > .scene-used { position: static; }
  .editor-toolbar .sun-hover-play-split { display: inline-flex; }
  .editor-shell .sun-year-scrub-rail .sun-date-tools { width: max-content; }
  .editor-shell .sun-year-scrub-rail .sun-scrub-date { width: max-content; }
  .editor-shell .sun-year-scrub-rail .sun-chip-row { width: auto; }
  .content:has(> .editor-shell) { padding: 0; display: block; min-height: 0; }
`;

export const EDITOR_SHELL_LAYOUT_CSS = `
  :host .editor-shell .sun-path.dial-view .sun-light-clock {
    padding: 28px 0;
    justify-content: center;
  }
  :host .editor-shell .simple-wheels { padding: 0 16px; }
  :host .editor-shell .simple-editor { padding: 0; }
  .editor-preview > .library-editor { display: flex; flex-direction: column; align-items: center; justify-content: center; }
  :host .editor-toolbar .sun-hover-play-split { display: inline-flex; }
  :host .editor-toolbar .sun-date-tools .sun-hover-readout {
    flex-wrap: wrap;
    justify-content: flex-start;
  }
  .editor-lights > .light-tiles-block,
  .editor-lights > .sun-light-clock-legend {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    width: 100%;
  }
  .editor-lights .light-tiles-hint { margin: 4px 0 0; }
  :host([narrow]) .editor-lights .light-tiles-hint { min-height: 48px; }
  .editor-lights .light-tiles-scroller { padding-inline: 0; }
`;
