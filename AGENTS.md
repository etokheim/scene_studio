# Agent instructions (Scene Studio)

Custom Home Assistant integration in `custom_components/scene_studio/` and its local Docker sandbox. The live home `/config` and Heim dashboard are outside this project's scope. Durable rationale lives in [docs/DECISIONS.md](docs/DECISIONS.md).

This file is the shared instruction source for Codex and Cursor. Cursor `.mdc` rules provide compatibility reminders; follow the requirements here without relying on `.mdc` auto-loading. Skills live in `.agents/skills/`; `.cursor/skills/` links to those same files.

## Must do

- **Commit after each change set** — see [`.cursor/rules/commit-after-changes.mdc`](.cursor/rules/commit-after-changes.mdc). Overrides global “only commit when asked.” Review the diff and recent commit style, stage only relevant files, preserve unrelated work, and commit before finishing. No amend, force-push, or hook bypass unless requested.
- **Do not hard-reload the HA/Cursor browser** — bump `PANEL_ASSET_REV`, restart, then a **normal** reload (custom elements stay stale on hash-only nav). Follow the [browser verification skill](.agents/skills/scene-studio-browser-verification/SKILL.md).
- **Do not silence bugs** — fix the cause; do not clamp or catch-and-guess to hide invariant failures. See [`.cursor/rules/dont-silence-bugs.mdc`](.cursor/rules/dont-silence-bugs.mdc).
- **The main column is the editor** — scenes and library items are edited in `.stage-col`, with autosave. Creation dialogs may choose a starter or existing preset; actual name/color/slot/theme editing stays in the stage. Rename, settings, confirmation, and light sidebars remain supporting surfaces.
- **HA Jinja templates** — follow [`.agents/skills/home-assistant-templates/SKILL.md`](.agents/skills/home-assistant-templates/SKILL.md); update that skill when you find new quirks.
- **HA REST API** — local sandbox at `http://127.0.0.1:8123`; auth via the shared credential name `cursor_ha_token` in `dev/config/secrets.yaml`. See [`.agents/skills/home-assistant-api/SKILL.md`](.agents/skills/home-assistant-api/SKILL.md).
- **Panel UI checks** — Chrome DevTools MCP at `/scene_studio`, not a new Cursor HA tab. Sandbox login keys `sandbox_ha_username` / `sandbox_ha_password` in the same secrets file; ask if missing. Follow the [browser verification skill](.agents/skills/scene-studio-browser-verification/SKILL.md).
- **Git** — day-to-day work is on `dev`. A PR to `master` is a release. See [`docs/GIT.md`](docs/GIT.md).
- **Releases** — [`.agents/skills/prepare-release-pr/SKILL.md`](.agents/skills/prepare-release-pr/SKILL.md) (translations + changelog, then PR). Merging to `master` runs [`.github/workflows/release.yml`](.github/workflows/release.yml). Sidebar/store is a minor with automatic migration, not a breaking reconfigure.
- **Translations** — during development, add keys to `en.json` only. nb/nn/de/es are one pass in the release PR — [`.agents/skills/panel-translations/SKILL.md`](.agents/skills/panel-translations/SKILL.md).
- **Changelog** — do not maintain `CHANGELOG.md` Unreleased during feature work; the release skill fills it from the diff.
- **Secrets** — never browse whole secret stores, `.env`, HA auth/config-entry storage, backups, or SSH keys. Extract only required keys and use credentials without printing them; disclose any accidental secret read immediately. See [`.cursor/rules/secrets-handling.mdc`](.cursor/rules/secrets-handling.mdc).
- **Tests** — `pytest tests/` and `node --test tests/frontend/*.test.mjs` (pin grouping, tile selection, card dots). Do not add Playwright; panel layout stays on Chrome DevTools MCP. See [`DEVELOPMENT.md`](DEVELOPMENT.md).

## Local sandbox

- Docker + starter YAML: [`DEVELOPMENT.md`](DEVELOPMENT.md). Python changes need `docker compose restart`.
- Integration code: [`custom_components/scene_studio/`](custom_components/scene_studio/). Runtime files under `dev/config/` are gitignored except the committed starter YAML. Do not commit or rewrite `dev/config/scenes.yaml` unless the user explicitly asks.
- Agent prerequisites and permission troubleshooting: [docs/AGENT_SETUP.md](docs/AGENT_SETUP.md). Keep configured Git signing enabled; never disable signing or change identity to bypass a failed commit. Instructions do not grant filesystem, Docker, network, browser, or credential access.
- Record non-obvious constraints and reasons beside the code or in [docs/DECISIONS.md](docs/DECISIONS.md). Replace contradictory guidance and delete superseded decisions in the same change set. Git preserves history; do not create a decision archive.
- Report checks blocked by unavailable tools or permissions. A browser-injected preview is not verification of the final source.

## Git remote

Public origin: [`etokheim/scene_studio`](https://github.com/etokheim/scene_studio). Workflow: [`docs/GIT.md`](docs/GIT.md).
