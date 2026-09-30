![Scene Studio Hero](images/Hero.png)

# Scene Studio

[![GitHub release](https://img.shields.io/github/release/etokheim/scene_studio.svg)](https://github.com/etokheim/scene_studio/releases)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=flat-square&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/etokheim)

Daylight that follows the sun between your chosen looks. The integration builds a Home Assistant scene that blends your day and evening looks from the sun’s cycle — cool by day, warm toward dusk — so activating it lights the room the way you want for *now*.

**Built-in automatic light updates** (on by default) re-apply each circadian scene on an interval with a matching transition, so the room fades through the day without a separate automation. Pause per room from the sidebar list, or set the global interval to 0 to turn updates off.

**Support the project:** [buymeacoffee.com/etokheim](https://buymeacoffee.com/etokheim)

## Install

1. In HACS, add `https://github.com/etokheim/scene_studio` as a **custom repository** of type **Integration**, then install **Scene Studio**. Alternatively, copy `custom_components/scene_studio` into your Home Assistant config directory.
2. Restart Home Assistant.
3. Add the integration once: **Settings → Devices & services → Add integration → Scene Studio**.
4. Open **Scene Studio** from the sidebar to create and edit rooms.

You do **not** add a new integration entry for each room — one instance covers every circadian scene.

### Upgrading from Circadian Scenes

The domain and GitHub repo are now `scene_studio` (was `circadian_scenes`). After updating:

1. Remove the old **Circadian Scenes** config entry if Home Assistant still lists it.
2. Add **Scene Studio** once.
3. Room configs migrate from `circadian_scenes.scenes` to `scene_studio.scenes` when the new store is empty. If you used HACS, add this repository as a custom Integration repository before installing Scene Studio.

### Upgrading from Scene Extrapolation

v4 renamed `scene_extrapolation` to `circadian_scenes`. If that store is the only one present, Scene Studio still copies `scene_extrapolation.scenes` into `scene_studio.scenes`. Remove the old config entry and add **Scene Studio** once.

## Setup

Create a scene in the Scene Studio sidebar and choose its Home Assistant area. A circadian scene starts from a built-in day-to-evening look; edit the colors and brightness at dawn, sunrise, noon, sunset, and dusk in the main editor. You can also create a fixed scene or reuse looks from the library. Scene Studio creates the Home Assistant scene entity for you.

An older installation that used native Home Assistant scenes can migrate its saved light looks into Scene Studio when all required source scenes are available. Native scenes are no longer needed for new scenes.

You might already have fixed scenes like this:

![Illustration - Scenes with hard transitions](images/Example%20-%20Fixed.png)

Scene Studio blends between them so the room looks right whenever you activate it:

![Illustration - Scenes with soft transitions](images/Example%20-%20Blurred.png)

A typical result:

![Illustration of how the integration works in practice](images/Actual%20scene.png)

## Why use this?

1. **Simple** — it is still “just a scene”: activate it when you want that look; turn lights off normally when you don’t.
2. **Any colors** — not limited to white / warm white.
3. **Effects** — e.g. fireplace after sunset, or Christmas lights that still follow the day.
4. **Turn lights off or on** by time of day (bright undimmable lamp off in the evening; cozy lamp on only then).
5. **Area-aware light membership** — a scene follows the area's lights, with per-light changes when you need them.
6. **Automatic light updates** — keep the room tracking the sun after activation without fighting a “force lights on” loop.

## Limitations

1. Scene Studio currently controls lights. Existing native-scene migration keeps the light looks; other entity types from those source scenes are not imported.
2. Automatic light updates run only while a Scene Studio scene owns its area. An unavailable light is skipped until it is available again.

### Alternatives

| Integration | Notes |
| --- | --- |
| [Flux](https://www.home-assistant.io/integrations/flux/) | Built-in; drives individual lights; YAML; smaller install base. |
| [Circadian Lighting](https://github.com/claytonjn/hass-circadian_lighting) | Drives lights/groups directly; richer options; large community. |
| [Adaptive Lighting](https://github.com/basnijholt/adaptive-lighting) | Continuous CT/brightness without scene knots. |

Scene Studio stays scene-based on purpose: predictable, easy to combine with motion and schedules, and automatic light updates that can skip overridden lamps.

## Extend it

Keep the core simple, then add behavior with the rest of Home Assistant:

1. **All-day fade** — use built-in automatic light updates (default). Older blueprints that re-activate every few minutes are legacy and not required.
2. **Motion lighting** — automation that activates the circadian scene on motion (a blueprint is still useful for this).

## Acknowledgements

The color wheel is based on the wheel in [Hue Like Light Card](https://github.com/Gh61/lovelace-hue-like-light-card) by [Gh61](https://github.com/Gh61). [huemane-light-card](https://github.com/etokheim/huemane-light-card) is built on that card, and this panel’s wheel uses the same implementation as its starting point.

Project code is licensed under [LGPL-2.1](LICENSE). The Hue Like Light Card wheel is also LGPL-2.1. The bundled SunCalc code and gallery photos have their own notices and credits in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [gallery/CREDITS.md](custom_components/scene_studio/frontend/gallery/CREDITS.md).

## Support

If Scene Studio saves you setup time or makes your evenings nicer, you can [buy me a coffee](https://buymeacoffee.com/etokheim):

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/etokheim)

Issues and ideas: [GitHub Issues](https://github.com/etokheim/scene_studio/issues).

## Q&A

<details>
<summary><strong>What happens when the sun doesn't rise or set? (Polar regions, midnight sun, polar night)</strong></summary>

In polar regions the sun may never set (midnight sun) or never rise (polar night). When solar calculations fail completely, the integration uses **seasonal fallback times**:

- **Winter:** Dawn 8:45, Sunrise 10:30, Noon 12:00, Sunset 13:00, Dusk 22:00
- **Summer:** Dawn 2:15, Sunrise 4:00, Noon 13:00, Sunset 22:00, Dusk 23:55

When only some events fail, it keeps chronological order by taking the later of:

- previous event + 30 minutes, or
- that event’s seasonal fallback

**Example:** Dawn calculates as 06:00 but sunrise fails → use the later of 06:30 and the summer sunrise fallback (04:00) → **06:30**, so sunrise stays after dawn.

</details>
