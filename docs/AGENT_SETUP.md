# Agent setup

Open this repository as the project in Codex or Cursor. Start development chats in its checkout so root `AGENTS.md` and repository skills are discoverable. A projectless chat outside the checkout does not automatically inherit these instructions. ChatGPT without a repository-connected executor can discuss files, but cannot run local checks.

## Shared instructions and skills

`AGENTS.md` contains the shared requirements. `.agents/skills/<name>/SKILL.md` contains each workflow once. `.cursor/skills/<name>` is a relative symlink to the shared folder, retaining existing Cursor skill paths. Cursor rules link back to shared guidance. Edit the shared source; do not maintain a second copy or add shared requirements only to `.mdc` files.

Keep symlinks intact when cloning or copying the checkout. Restart the agent session after changing skill discovery metadata. Confirm the relevant skill is available in the host's skill picker; directory/link validation alone does not prove a running host has refreshed its catalog.

## Local prerequisites

| Capability | Prerequisite | If unavailable |
|---|---|---|
| Code and tests | Repository access; Python/Node dependencies in [DEVELOPMENT.md](../DEVELOPMENT.md) | Use the checkout and existing `.venv`; report checks that could not run. |
| Sandbox restart | Docker Desktop running and permission to use its socket | Check Docker availability. Request only access needed for the sandbox. |
| UI verification | Official Chrome DevTools MCP connected to the sandbox Chrome session | Check the host's MCP tools/connection. Reconnect after Chrome updates or restarts. Do not substitute direct Chrome access without user authorization. |
| Sandbox authentication | Required keys in local `dev/config/secrets.yaml` | Extract needed keys in-process using the API skill. Ask for missing/placeholder keys; never guess or print credentials. |
| Signed commits | Existing Git signing configuration and unlocked 1Password signing agent | Allow the signing prompt and local IPC access if required. Do not disable signing or change Git identity to bypass a failed commit. |

Files and skills describe workflows; they do not grant filesystem, Docker, network, browser, or credential permissions. Use the host's permission mechanism when required, explain the concrete blocked action, and continue independent work. Keep approval requirements separate from missing credentials and ordinary setup failures.

## Verification and handoff

Use the [browser verification skill](../.agents/skills/scene-studio-browser-verification/SKILL.md) for panel changes. A source edit, unit-test pass, or browser-injected preview does not establish that the restarted sandbox serves final code. Report what was tested and any remaining limitation. Review and commit each logical change set without committing runtime files. Release preparation uses the [release skill](../.agents/skills/prepare-release-pr/SKILL.md).
