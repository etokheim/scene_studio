import assert from "node:assert/strict";
import test from "node:test";

import { toggleOnOffDraft } from "../../custom_components/scene_studio/frontend/onoff_graph.js";

test("on/off event edits change only power, never brightness or fades", () => {
  const draft = { state: "on", brightness: 154, transition: 2 };
  assert.equal(toggleOnOffDraft(draft), "off");
  assert.deepEqual(draft, { state: "off", brightness: 154, transition: 2 });
  assert.equal(toggleOnOffDraft(draft), "on");
  assert.deepEqual(draft, { state: "on", brightness: 154, transition: 2 });
});
