/** Scene-local event editor data and guidance lifecycle. */
import { EVENT_COLOR_FIELDS, resolveEventDraft } from "./event_inheritance.js";

export function eventSourceChanged(scene, theme, eventId) {
  const assignment = scene.event_palettes?.[eventId];
  return Boolean(assignment?.brightness_adjustment || (assignment?.palette_id &&
    assignment.palette_id !== theme.events?.[eventId]?.color?.variable_ref));
}

export function lightOverrideRows(scene, theme, eventId, variables, adapt) {
  return Object.entries(scene.overrides || {}).flatMap(([id, events]) => {
    const override = events[eventId];
    if (!override || !Object.keys(override).length) return [];
    const baselineScene = { ...scene, overrides: { ...scene.overrides, [id]: { ...events } } };
    delete baselineScene.overrides[id][eventId];
    const before = adapt(id, resolveEventDraft(baselineScene, theme, eventId, id, variables));
    const after = { ...adapt(id, resolveEventDraft(scene, theme, eventId, id, variables)) };
    // Saved effects remain visible even when this hardware cannot apply them.
    if (Object.hasOwn(override, "effect")) after.effect = override.effect;
    const fields = ["state", "brightness", "effect"].filter(key => Object.hasOwn(override, key));
    if (EVENT_COLOR_FIELDS.some(key => Object.hasOwn(override, key))) fields.push("color");
    return [{ id, before, after, fields }];
  });
}

/** One timer lifecycle; selecting an event or leaving cancels all pending work. */
export class EventGuidance {
  constructor({ show, hide, pulse, reducedMotion, timers = globalThis }) {
    Object.assign(this, { showView: show, hideView: hide, pulse, reducedMotion, timers });
    this.jobs = [];
  }
  cancel() {
    for (const job of this.jobs) this.timers.clearTimeout(job);
    this.jobs = [];
    this.hideView(true);
  }
  show() {
    this.cancel();
    this.showView();
    if (!this.reducedMotion()) this.jobs.push(this.timers.setTimeout(() => this.pulse(), 1280));
    this.jobs.push(this.timers.setTimeout(() => {
      this.hideView(false);
      this.jobs.push(this.timers.setTimeout(() => this.hideView(true), 280));
    }, 3280));
  }
}

export const EVENT_EDITOR_CSS = `
  .event-required { position: relative; }
  .sun-light-clock-legend .light-tiles { transition: opacity 280ms cubic-bezier(.2,0,0,1); }
  .event-required .light-tiles { opacity: .45; }
  .event-required-message { position: absolute; inset: 0; z-index: 30; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; padding: 16px; pointer-events: none; opacity: 0; transition: opacity 280ms cubic-bezier(.2,0,0,1); }
  .event-required-message.visible { opacity: 1; }
  .event-required-message .event-copies { display: flex; gap: 12px; }
  .event-required-message .event-copy { display: grid; place-items: center; width: 32px; height: 32px; border: 1px solid var(--divider-color); border-radius: 50%; background: var(--card-background-color); }
  .event-source { margin-bottom: 16px; }
  .event-overrides { display: flex; flex-direction: column; gap: 16px; margin-top: 24px; }
  .event-override-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .event-override-description { flex: 1; min-width: 0; }
  .event-override-description p { margin: 4px 0; color: var(--secondary-text-color); }
`;
