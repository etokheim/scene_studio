import assert from "node:assert/strict";
import test from "node:test";
import { waitForSurfaceAnimation } from "../../custom_components/scene_studio/frontend/editor_shell.js";

globalThis.window = globalThis;

test("surface cleanup waits for its own matching animation", async () => {
  const surface = new EventTarget();
  let completed = false;
  const waiting = waitForSurfaceAnimation(surface, "exit", 30).then(() => { completed = true; });
  const unrelated = new Event("animationend");
  unrelated.animationName = "enter";
  surface.dispatchEvent(unrelated);
  await Promise.resolve();
  assert.equal(completed, false);
  const exit = new Event("animationend");
  exit.animationName = "exit";
  surface.dispatchEvent(exit);
  await waiting;
  assert.equal(completed, true);
});

test("missing or interrupted surfaces eventually complete cleanup", async () => {
  await waitForSurfaceAnimation(null, "exit", 5);
  await waitForSurfaceAnimation(new EventTarget(), "exit", 5);
});
