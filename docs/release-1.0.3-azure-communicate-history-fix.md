# Release 1.0.3 — Azure Communicate / History fix

**Date:** 2026-07-16 (5:15 pm)  
**Tag:** `release`  
**Image:** `eceptagentregistry.azurecr.io/hermes-client-webportal:v1.0.3-models-fallback`  
**Scope:** Fix Communicate (Chat / Schedule Task) and History on the Azure Container Apps portal when Hermes is remote-only.

## Summary

After deploying the portal to Azure, History failed with `EACCES` writing logs, and Communicate looked broken because the LLM model dropdown depended on a local Hermes Python inventory that does not exist in the container. This release makes logging work under a non-root container user, falls back to the remote Hermes `/v1/models` API, and keeps Chat usable with a default `hermes-agent` model.

## Root causes (verified in production)

1. **History / Chat persistence** — Container runs as non-root `portal`, but the app tried to create `/app/logs`. That returned `EACCES: permission denied, mkdir '/app/logs'`. Chat then threw again while recording the failure and could take the replica down (503).
2. **Model dropdown / Chat disabled** — `/api/models` used local `HERMES_HOME` + Python inventory. In Azure that fails with `Hermes Python not found under /app/hermes`. An empty model list left `selectedModel` empty, so the Chat button stayed disabled even though Hermes chat itself was healthy.

## What’s included

### Runtime / Docker

- Dockerfile creates writable `/app/logs` and `/app/data` owned by `portal`
- `LOG_DIR=/app/logs` set in the image; Bicep also sets `LOG_DIR`
- Live hotfix retained: Container App env `LOG_DIR=/tmp/hermes-portal-logs` when needed

### Backend

- `communicationLog` falls back to a writable temp directory if `LOG_DIR` is not writable
- Chat / schedule / history routes no longer crash the process if history persistence fails
- `/api/models` tries local inventory first, then falls back to remote Hermes `GET /v1/models`, then to a hardcoded `hermes-agent` default

### Frontend

- Communicate page always has a default model (`hermes-agent`)
- Chat is not blocked when inventory fails
- Model helper text distinguishes Hermes API vs local inventory sources

## Production verification

Portal: https://devaiagentcontainer.whiteriver-7e291f56.southcentralus.azurecontainerapps.io  

| Check | Result |
|-------|--------|
| `GET /api/health` | `status: ok`, `hermes.ok: true` |
| `GET /api/history` | 200 (no EACCES) |
| `GET /api/models` | 200, `source: hermes-api`, model `hermes-agent` |
| `POST /api/chat` | 200; entry appears in History |
| UI Communicate | Dropdown shows `hermes-agent`; Chat / Schedule Task usable |
| UI History | Loads without error |

Hermes public API: `https://hermes-dev-gen.eceptionist.com`

## Known limitations (unchanged)

- Full provider model inventory still requires local Hermes Python / `HERMES_HOME` (remote API currently exposes `hermes-agent`)
- History (`communications.jsonl`) remains ephemeral on the container filesystem unless a volume is added later
- Portal URL is public with no login

## Related docs

- [azure-deploy.md](./azure-deploy.md)
- [hermes-wireup.md](./hermes-wireup.md)
- [release-1.0.2-azure-auto-deploy.md](./release-1.0.2-azure-auto-deploy.md)
- [release.md](../release.md) (changelog index)
