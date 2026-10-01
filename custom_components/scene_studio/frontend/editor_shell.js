/** Shared editor mounting and motion primitives. */

export function waitForSurfaceAnimation(el, name, fallbackMs) {
    return new Promise((resolve) => {
      if (!el) {
        resolve();
        return;
      }
      let done = false;
      let timer;
      const finish = () => {
        if (done) {
          return;
        }
        done = true;
        window.clearTimeout(timer);
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
      timer = window.setTimeout(finish, fallbackMs);
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
  const timeline = document.createElement("div");
  timeline.className = "editor-timeline";
  timeline.hidden = true;
  const background = document.createElement("div");
  background.className = "editor-background";
  el.append(background, toolbar, timeline, preview, lights);
  return { el, toolbar, timeline, preview, lights, background, lightGate: createTransitionGate(), previewGate: createTransitionGate() };
}

export function mountEditorRegions(shell, { mount, visual, toolbar, lights, animateLights = false, reducedMotion = false }) {
  if (shell.el.parentNode !== mount) mount.appendChild(shell.el);
  // Move controls before mounting their former parent into the preview.
  if (toolbar.length !== shell.toolbar.children.length ||
      toolbar.some((node, index) => shell.toolbar.children[index] !== node)) {
    shell.toolbar.replaceChildren(...toolbar);
  }
  if (animateLights) {
    const exiting = !lights && shell.lights.classList.contains("editor-lights-exit");
    if (!exiting && (shell.lights.firstChild !== lights || shell.lights.hidden === Boolean(lights)))
      void setLightRegion(shell, lights, { reducedMotion });
  } else {
    if (lights && shell.lights.firstChild !== lights) shell.lights.replaceChildren(lights);
    shell.lights.hidden = !lights;
    if (!lights) shell.lights.replaceChildren();
  }
  if (shell.preview.firstChild !== visual) shell.preview.replaceChildren(visual);
}

/** Keep the action-plate gutter inside the existing hint/footer space. */
export function fitLightStripGutter(shell) {
  const tiles = shell.lights.querySelector(".light-tiles");
  if (shell.lights.hidden || !tiles) return;
  const remaining = shell.lights.getBoundingClientRect().bottom - tiles.getBoundingClientRect().bottom;
  // The top gutter still overlaps the preview. Only the bottom gutter is
  // bounded by the light region; padding and its negative margin cancel out.
  shell.lights.style.setProperty("--light-strip-bottom-padding", `${Math.min(64, Math.max(0, remaining))}px`);
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
    box-sizing: border-box;
    padding-block: 24px;
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
  .editor-lights .light-tiles-scroller {
    padding-inline: 0;
    padding-bottom: var(--light-strip-bottom-padding, 64px);
    margin-bottom: calc(-1 * var(--light-strip-bottom-padding, 64px));
  }
`;

/** Capture live pixels before editor teardown, without cloning canvas content. */
export function capturePreviewExit(shell, surface, context = null, backgrounds = []) {
  const previewRect = shell.preview.getBoundingClientRect();
  const shellRect = shell.el.getBoundingClientRect();
  const surfaceRect = surface.getBoundingClientRect();
  for (const node of [surface, ...surface.querySelectorAll(".simple-editor-enter, .clock-face-enter, .stage-surface-enter")]) {
    const computed = getComputedStyle(node);
    const transform = computed.transform;
    const opacity = computed.opacity;
    node.getAnimations().forEach(animation => animation.cancel());
    node.classList.remove("simple-editor-enter", "clock-face-enter", "stage-surface-enter");
    if (transform !== "none") node.style.transform = transform;
    node.style.opacity = opacity;
  }
  for (const face of surface.querySelectorAll(".sun-light-clock-face, .hue-wheel-canvas")) {
    const rect = face.getBoundingClientRect();
    face.style.width = `${rect.width}px`;
    face.style.height = `${rect.height}px`;
    face.style.maxWidth = "none";
  }
  const backgroundRects = backgrounds.map(node => [node, node.getBoundingClientRect()]);
  const layer = document.createElement("div");
  layer.className = "editor-preview-exit";
  layer.style.cssText = `top:${previewRect.top - shellRect.top}px;left:${previewRect.left - shellRect.left}px;width:${previewRect.width}px;height:${previewRect.height}px;`;
  const wrapper = context ? context.cloneNode(false) : document.createElement("div");
  wrapper.classList.remove("simple-editor-enter", "clock-face-enter", "stage-surface-enter");
  wrapper.style.cssText = "position:absolute;inset:0;width:100%;height:100%;";
  surface.style.position = "absolute";
  surface.style.left = `${surfaceRect.left - previewRect.left}px`;
  surface.style.top = `${surfaceRect.top - previewRect.top}px`;
  surface.style.width = `${surfaceRect.width}px`;
  surface.style.height = `${surfaceRect.height}px`;
  wrapper.appendChild(surface);
  layer.appendChild(wrapper);
  for (const [node, rect] of backgroundRects) {
    node.style.left = `${rect.left - previewRect.left}px`;
    node.style.top = `${rect.top - previewRect.top}px`;
    node.style.width = `${rect.width}px`;
    node.style.height = `${rect.height}px`;
    node.style.transform = "none";
    layer.insertBefore(node, wrapper);
  }
  shell.el.appendChild(layer);
  return layer;
}

export function createTransitionGate() {
  let revision = 0;
  return {
    next() { return ++revision; },
    current(token) { return token === revision; },
  };
}

export async function crossfadePreview(shell, outgoing, incoming, { reducedMotion = false, current = () => true } = {}) {
  if (reducedMotion) { outgoing?.remove(); return; }
  // Force layout once before starting both animations on the same frame.
  void incoming.offsetWidth;
  incoming.classList.add("editor-preview-enter");
  outgoing?.classList.add("editor-preview-exit-active");
  await waitForSurfaceAnimation(incoming, "stage-surface-enter-scale", 480);
  if (!current()) return;
  incoming.classList.remove("editor-preview-enter");
  outgoing?.remove();
}

export async function setLightRegion(shell, content, { reducedMotion = false } = {}) {
  const token = shell.lightGate.next();
  const showing = !shell.lights.hidden;
  if (content) {
    shell.lights.classList.remove("editor-lights-exit", "editor-lights-enter");
    shell.lights.replaceChildren(content);
    shell.lights.hidden = false;
    shell.lights.inert = false;
    shell.lights.style.setProperty("--editor-lights-height", `${shell.lights.getBoundingClientRect().height}px`);
    if (!showing && !reducedMotion) {
      void shell.lights.offsetWidth;
      shell.lights.classList.add("editor-lights-enter");
      await waitForSurfaceAnimation(shell.lights, "editor-lights-rise", 480);
      if (shell.lightGate.current(token)) shell.lights.classList.remove("editor-lights-enter");
    }
  } else if (showing) {
    shell.lights.style.setProperty("--editor-lights-height", `${shell.lights.getBoundingClientRect().height}px`);
    shell.lights.inert = true;
    shell.lights.classList.remove("editor-lights-enter");
    if (!reducedMotion) {
      shell.lights.classList.add("editor-lights-exit");
      await waitForSurfaceAnimation(shell.lights, "editor-lights-drop", 480);
    }
    if (!shell.lightGate.current(token)) return;
    shell.lights.hidden = true;
    shell.lights.classList.remove("editor-lights-exit");
    shell.lights.replaceChildren();
  }
}

export const EDITOR_SHELL_MOTION_CSS = `
  .editor-preview-exit {
    position: absolute;
    z-index: 6;
    pointer-events: none;
    transform-origin: center;
  }
  .editor-preview-exit-active {
    animation: stage-surface-fade-out 280ms cubic-bezier(0.2, 0, 0, 1) both,
      stage-surface-exit-scale 400ms cubic-bezier(0.2, 0, 0, 1) both;
  }
  .editor-preview-enter {
    transform-origin: center;
    animation: stage-surface-fade-in 280ms cubic-bezier(0.2, 0, 0, 1) both,
      stage-surface-enter-scale 400ms cubic-bezier(0.2, 0, 0, 1) both;
  }
  .editor-shell .simple-editor-host.simple-editor-enter,
  .editor-shell .library-editor.simple-editor-enter,
  .editor-shell .empty-state.stage-surface-enter,
  .editor-shell .sun-light-clock-face.clock-face-enter { animation: none; }
  .editor-lights { box-sizing: border-box; }
  .editor-lights-enter {
    animation: stage-surface-fade-in 280ms cubic-bezier(0.2, 0, 0, 1) both,
      editor-lights-rise 400ms cubic-bezier(0.2, 0, 0, 1) both;
  }
  .editor-lights-exit {
    animation: stage-surface-fade-out 280ms cubic-bezier(0.2, 0, 0, 1) both,
      editor-lights-drop 400ms cubic-bezier(0.2, 0, 0, 1) both;
  }
  @keyframes editor-lights-rise { from { height: 0; padding-bottom: 0; transform: translateY(var(--editor-lights-height)); } to { height: var(--editor-lights-height); padding-bottom: 16px; transform: translateY(0); } }
  @keyframes editor-lights-drop { from { height: var(--editor-lights-height); padding-bottom: 16px; transform: translateY(0); } to { height: 0; padding-bottom: 0; transform: translateY(var(--editor-lights-height)); } }
  @media (prefers-reduced-motion: reduce) {
    .editor-preview-enter, .editor-preview-exit-active, .editor-lights-enter, .editor-lights-exit { animation: none; }
  }
`;

export const EDITOR_LIBRARY_PREVIEW_CSS = `
  .editor-preview > .library-editor > .hue-wheel-stage {
    width: min(100%, var(--dial-face-max, 650px));
    height: 100%;
    padding: 0;
    margin: 0;
  }
  .editor-preview .library-editor .hue-wheel-face { justify-content: center; }
  .editor-preview .library-editor .hue-wheel-canvas { width: 100%; max-width: none; flex: 0 0 auto; }
  .editor-toolbar > .hue-wheel-chrome { position: static; width: 100%; }
`;

/** Layout uses the editor container, independent of the device orientation. */
export function editorGeometry(width, height, windowHeight) {
  return { floor: Math.min(300, width, windowHeight), portrait: height > width, overlap: width >= 1100 };
}

export const EDITOR_CONTAINER_CSS = `
  .editor-shell { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto minmax(calc(var(--editor-preview-floor, 300px) + 48px), 1fr) auto; }
  .editor-background { position: absolute; inset: 0; overflow: clip; pointer-events: none; }
  .editor-toolbar { grid-column: 1; grid-row: 1; isolation: isolate; }
  .editor-toolbar::before {
    content: "";
    position: absolute;
    inset: 0 0 -24px;
    z-index: -1;
    pointer-events: none;
    opacity: .75;
    background: linear-gradient(to bottom, var(--app-header-background-color, var(--sidebar-background-color)) 0%, var(--app-header-background-color, var(--sidebar-background-color)) calc(100% - 24px), transparent 100%);
  }
  .editor-timeline { grid-column: 1; grid-row: 2; min-height: 50px; padding: 0 16px; z-index: 12; }
  .editor-timeline[hidden] { display: none; }
  .editor-preview { grid-column: 1; grid-row: 3; }
  .editor-lights { grid-column: 1; grid-row: 4; }
  .editor-shell[data-timeline="vertical"] { grid-template-columns: minmax(0, 1fr) 64px; grid-template-rows: auto minmax(calc(var(--editor-preview-floor, 300px) + 48px), 1fr) auto; }
  .editor-shell[data-timeline="vertical"] .editor-timeline { grid-column: 2; grid-row: 2; height: 100%; padding: 12px 12px 12px 0; box-sizing: border-box; }
  .editor-shell[data-timeline="vertical"] .sun-year-scrub { height: 100%; min-height: 0; margin: 0; }
  .editor-shell[data-timeline="vertical"] .editor-preview { grid-row: 2; }
  .editor-shell[data-timeline="vertical"] .editor-lights { grid-row: 3; }
  .editor-shell[data-timeline-hidden="true"] { grid-template-columns: minmax(0, 1fr); }
  .editor-shell[data-overlap="true"] .editor-preview { grid-row: 1 / 4; }
  .editor-shell[data-overlap="true"][data-timeline="vertical"] .editor-preview { grid-row: 1 / 3; }
  :host .editor-shell .sun-path.dial-view .sun-light-clock { padding: 0; }
  :host .editor-shell .sun-light-clock-face { width: min(100cqi, 100cqb, var(--dial-face-max, 900px)); }
  :host .editor-shell .hue-wheel-face { align-items: center; justify-content: center; }
  :host .editor-shell .simple-editor .hue-wheel-canvas {
    width: min(100cqi, 100cqb, var(--dial-face-max, 650px));
    max-width: min(100%, var(--dial-face-max, 650px));
  }
  :host .editor-shell .simple-editor:not(.chrome-aside) .hue-wheel-chrome {
    position: absolute; top: 0; left: 0; right: 0; z-index: 5;
  }
  .editor-toolbar .sun-toolbar-chrome { display: flex; flex-wrap: wrap; width: 100%; justify-content: space-between; }
  .editor-toolbar .sun-date-tools { display: flex; flex-direction: row; align-items: center; justify-content: flex-end; gap: 8px; width: auto; margin-left: auto; }
  .editor-toolbar .sun-chip-row { flex-wrap: nowrap; width: auto; }
  .editor-toolbar .sun-scrub-date { flex: 0 0 auto; width: max-content; }
  :host([narrow]) .editor-toolbar .sun-hover-play-split { display: none; }
  :host([narrow]) .content:has(> .editor-shell) { overflow-y: auto; }
`;
