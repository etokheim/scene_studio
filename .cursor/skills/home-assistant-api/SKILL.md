---
name: home-assistant-api
description: >-
  Call the local Docker sandbox Home Assistant REST API using cursor_ha_token
  in dev/config/secrets.yaml. Use when reading entity states, calling services,
  rendering templates, listing areas/devices, checking config, or when
  browser/UI inspection is insufficient and live HA data is needed. Do not use
  production HA or /config/secrets.yaml from the live home.
---

# Home Assistant API (Docker sandbox)

This repo talks to the **local Scene Studio sandbox**, not the live home `/config`. Prefer the REST API for authoritative state over guessing from YAML alone.

## Auth (required)

- REST token: `cursor_ha_token` in [`dev/config/secrets.yaml`](../../../dev/config/secrets.yaml) (gitignored).
- Chrome MCP UI login: `sandbox_ha_username` and `sandbox_ha_password` in the same file.
- Example template: [`dev/config/secrets.yaml.example`](../../../dev/config/secrets.yaml.example).
- Create the REST token in the **sandbox** UI (Profile → Long-Lived Access Tokens). See [`DEVELOPMENT.md`](../../../DEVELOPMENT.md).
- **Never** open/browse the whole secrets file. Extract **only** the keys for this step.
- If a login key is missing or `CHANGEME`, ask the user. Do not guess.
- **Never** print, log, or echo tokens or passwords. Follow
  [`.cursor/rules/secrets-handling.mdc`](../../rules/secrets-handling.mdc).
- **Never** read production `/config/secrets.yaml` or copy live-home tokens into this workspace.

## Panel UI (Chrome DevTools MCP)

Verify Scene Studio in Chrome DevTools MCP, not a Cursor-owned HA tab ([`.cursor/rules/no-browser-reload.mdc`](../../rules/no-browser-reload.mdc)):

1. `http://127.0.0.1:8123/scene_studio`
2. Login with `sandbox_ha_username` / `sandbox_ha_password` from `secrets.yaml` when the authorize form appears.
3. After `PANEL_ASSET_REV` + `docker compose restart`, use a **normal** reload (`ignoreCache` off) and confirm the `panel.js` URL rev before judging layout.

## Base URL

From this environment use:

```text
http://127.0.0.1:8123
```

(`docker-compose.yml` publishes sandbox HA on host port 8123. `/api/` returns 401 without a token — that means the Core HTTP API is up.)

## Safe call pattern

Run from the **repo root**. Extract only `cursor_ha_token`; never print it.

```bash
python3 - <<'PY'
from pathlib import Path
import json, urllib.request, yaml

secrets = yaml.safe_load(Path("dev/config/secrets.yaml").read_text())
token = secrets["cursor_ha_token"]  # do not print
base = "http://127.0.0.1:8123"

def ha(path, method="GET", body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        base + path,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read()
        return json.loads(raw) if raw else None

# Example: one sandbox entity (print state only — never the token)
st = ha("/api/states/light.ceiling_lights")
print(st["state"], st.get("attributes", {}).get("brightness"))
PY
```

## High-value endpoints

| Goal | Method | Path / body |
|------|--------|-------------|
| API health | GET | `/api/` |
| One entity | GET | `/api/states/<entity_id>` |
| All states | GET | `/api/states` (large — filter in Python) |
| Call service | POST | `/api/services/<domain>/<service>` + JSON body |
| Render template | POST | `/api/template` body `{"template": "{{ … }}"}` |
| Config info | GET | `/api/config` |
| Check config | POST | `/api/services/homeassistant/check_config` |
| Areas | GET | `/api/config/area_registry/list` via WS — or use REST where available; for registries prefer Websocket or existing YAML/helpers |

Service call example (sandbox dummy lights / native scenes):

```python
ha("/api/services/light/turn_on", "POST", {
    "entity_id": "light.ceiling_lights",
    "brightness_pct": 40,
})
ha("/api/services/scene/turn_on", "POST", {
    "entity_id": "scene.stue_dag",
})
```

Template example:

```python
print(ha("/api/template", "POST", {
    "template": "{{ states('light.ceiling_lights') }}"
}))
```

Official reference: [REST API](https://developers.home-assistant.io/docs/api/rest/).

## When to use API vs browser vs YAML

| Need | Prefer |
|------|--------|
| Current entity/device state, attributes, last_changed | REST API |
| Fire a service / validate a template quickly | REST API |
| Scene Studio sidebar panel layout, CSS, chart | Chrome DevTools MCP on the sandbox (`http://127.0.0.1:8123/scene_studio`); login keys in `secrets.yaml` |
| How the integration is authored | `custom_components/scene_studio/` |
| How the sandbox home is authored | `dev/config/` starter YAML |

## Safety

- Read-only by default. Only call mutating services when the task requires it.
- Do not dump `/api/states` unfiltered into chat — summarize.
- Do not commit tokens, response blobs that embed tokens, or `.storage` auth files.
