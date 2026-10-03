import assert from "node:assert/strict";
import test from "node:test";
import { buildClientSunDay } from "../../custom_components/scene_studio/frontend/client_solar.js";

for (const latitude of [59.9, 78.2]) {
  for (const isoDate of ["2026-01-15", "2026-06-21", "2026-03-29", "2026-10-25"]) {
    test(`client solar limits retain raw positions at ${latitude} on ${isoDate}`, () => {
      const options = { isoDate, latitude, longitude: 10.75, timeZone: "Europe/Oslo" };
      const raw = Object.fromEntries(buildClientSunDay(options).events.map(e => [e.id, e]));
      const limited = Object.fromEntries(buildClientSunDay({ ...options, dawnMaximum: 21600, duskMinimum: 79200 }).events.map(e => [e.id, e]));
      assert.equal(limited.dawn.seconds, Math.min(raw.dawn.seconds, 21600));
      if (limited.dawn.overridden) assert.equal(limited.dawn.solar_seconds, raw.dawn.seconds);
      assert.equal(raw.dawn.overridden, false);
      assert.equal(raw.dusk.overridden, false);
      assert.ok(limited.dawn.seconds <= limited.sunrise.seconds);
      assert.ok(limited.sunrise.seconds <= limited.noon.seconds);
      assert.ok(limited.noon.seconds <= limited.sunset.seconds);
    });
  }
}
