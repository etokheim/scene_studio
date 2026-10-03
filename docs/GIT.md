# Git workflow for Scene Studio

## Branches

| Branch | Role |
|--------|------|
| **`dev`** | Default place for work. Feature branches merge here. |
| **`master`** | Released code. A merged PR into `master` publishes a GitHub / HACS release. |

Do not open feature PRs against `master`. To ship: [`.agents/skills/prepare-release-pr/SKILL.md`](../.agents/skills/prepare-release-pr/SKILL.md) (translations + changelog, then `dev` → `master`). The merge runs [`.github/workflows/release.yml`](../.github/workflows/release.yml), which assigns the version. Details: [`RELEASE.md`](../RELEASE.md).

If `origin/dev` does not exist yet:

```bash
git checkout -b dev origin/master
git push -u origin dev
```

After clone, check out `dev` before starting work (`git checkout dev`). GitHub’s default branch stays `master` so visitors see released code.

## What is versioned

- Integration: `custom_components/scene_studio/`
- Agent instructions: `AGENTS.md`, `.agents/`, `.cursor/`, `docs/`
- Local sandbox **starter** YAML: `dev/config/configuration.yaml`, `packages/`, `area_map.yaml`, `apply_area_map.py`, plus empty `automations.yaml` / `scripts.yaml`
- Tooling: `docker-compose.yml`, `pyproject.toml`, `DEVELOPMENT.md`, CI under `.github/`

## What is not versioned

- `dev/config/` runtime: `.storage/`, databases, logs, onboarding, `custom_components/virtual/` (hass-virtual copy)
- `dev/config/secrets.yaml` (use `dev/config/secrets.yaml.example` as a template)
- `dev/config/scenes.yaml` (sandbox-local; HA writes it back from the UI)
- `__pycache__/`, `.env`

## Clone

Public origin: [`etokheim/scene_studio`](https://github.com/etokheim/scene_studio).

```bash
git clone git@github.com:etokheim/scene_studio.git
cd scene_studio
git checkout dev
```

Sandbox setup: [`DEVELOPMENT.md`](../DEVELOPMENT.md).

## Private vs this repo

This integration is public. Do **not** copy live-home YAML, production tokens, or `/config` from [`etokheim/Home-Assistant-Config`](https://github.com/etokheim/Home-Assistant-Config). Talk to a running HA only via the Docker sandbox in this repo.

## If `secrets.yaml` was ever pushed

Rotate any exposed credentials, then rewrite history (e.g. `git filter-repo`) before pushing to a shared remote.

## Identity, signing, and release review

Keep the configured author and signing enabled. If identity is missing, ask the user to configure their real Git identity; do not invent one or override it for a command. If the 1Password signer fails, keep the change set staged and ask the user to unlock/approve signing before retrying. Continue independent work without bypassing signing or hooks.

When an authorized release already has a `dev` → `master` PR, push focused commits and refresh that PR's description and verified checks. Do not open a duplicate. Leave merging and publication to review; the release workflow assigns the manifest version. The trial installation is a manually added HACS repository, not HACS default inclusion.
