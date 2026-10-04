import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { PANEL_STYLES } from "../../custom_components/scene_studio/frontend/panel_styles.js";

// Extraction baseline: guard rule order, interpolation, and cascade as well as values.
// An explicitly approved style change should update this stylesheet snapshot.
test("extracted shadow stylesheet preserves the approved cascade", () => {
  assert.equal(createHash("sha256").update(PANEL_STYLES).digest("hex"),
    "d05c694e3c1ab146de6a9129c379faa867692655edcf612446598ccf263c780e");
});
