/** Solar-event power controls for lights without a brightness capability. */

export function toggleOnOffDraft(draft) {
  draft.state = draft.state === "off" ? "on" : "off";
  return draft.state;
}

export function createOnOffEventGraph({ title, subtitle, onLabel, offLabel, getEvents, onToggle }) {
  const el = document.createElement("div");
  el.className = "light-onoff-graph";
  const heading = document.createElement("div");
  heading.className = "light-brightness-graph-heading";
  const titleEl = document.createElement("div");
  titleEl.className = "light-brightness-graph-title";
  titleEl.textContent = title;
  const sub = document.createElement("div");
  sub.className = "light-brightness-graph-sub";
  sub.textContent = subtitle;
  heading.append(titleEl, sub);
  const row = document.createElement("div");
  row.className = "light-onoff-events";
  el.append(heading, row);

  const sync = () => {
    const events = getEvents();
    if (row.children.length !== events.length ||
        events.some((event, index) => row.children[index]?.dataset.eventId !== event.id)) {
      row.replaceChildren();
      for (const event of events) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "light-onoff-event";
        button.dataset.eventId = event.id;
        const name = document.createElement("span");
        name.className = "light-onoff-event-name";
        const state = document.createElement("span");
        state.className = "light-onoff-event-state";
        button.append(name, state);
        button.addEventListener("click", () => void onToggle(event.id));
        row.appendChild(button);
      }
    }
    for (const [index, event] of events.entries()) {
      const button = row.children[index];
      button.disabled = !event.member;
      button.classList.toggle("is-on", event.on);
      button.classList.toggle("is-active", event.active);
      button.setAttribute("aria-pressed", event.on ? "true" : "false");
      button.setAttribute("aria-label", `${event.name}: ${event.on ? onLabel : offLabel}`);
      button.querySelector(".light-onoff-event-name").textContent = event.name;
      button.querySelector(".light-onoff-event-state").textContent = event.on ? onLabel : offLabel;
    }
  };
  sync();
  return { el, sync, disconnect() {} };
}
