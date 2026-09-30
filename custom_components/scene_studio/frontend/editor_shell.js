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

