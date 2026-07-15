# Release 1.0.2 — Azure auto-deploy

**Date:** 2026-07-15 (9:15 pm)  
**Tag:** `v1.0.2`  
**Scope:** Deploy hermes-client-webportal to Azure Container Apps with tag-based CI/CD. Hermes stays on a separate public HTTPS URL.

## Summary

This release packages the portal for cloud hosting and adds an automated release pipeline. A single Docker image runs Express (API + static React). Pushing a `v*` git tag builds the image, pushes it to Azure Container Registry, updates the Container App, and smoke-tests `/api/health`.

## What’s included

### Application

- Multi-stage **Dockerfile** (frontend Vite build + backend TypeScript build → Node runtime)
- Express serves the Vite production build from `STATIC_DIR` (SPA fallback for non-`/api` routes)
- Listens on `0.0.0.0` for Container Apps ingress
- `.dockerignore` for lean build context
- `STATIC_DIR` documented in `backend/.env.example`

### Azure / CI

- **GitHub Actions**
  - `ci.yml` — build frontend + backend on PR and `main`
  - `release.yml` — on tag `v*`: OIDC login → ACR push → Container App update → health smoke (portal + Hermes)
- **Infra**
  - `infra/main.bicep` — ACR, Log Analytics, Container Apps Environment, Container App, AcrPull (for greenfield)
  - Scripts: `provision.ps1`, `setup-github-oidc.ps1`, `set-portal-secrets.ps1`
- **Docs**
  - `docs/azure-deploy.md` — setup and release process
  - `docs/hermes-wireup.md` — Hermes secrets and webhook checklist

### Production target configured (this environment)

| Item | Value |
|------|--------|
| Resource group | `AIServices` |
| Container App | `devaiagentcontainer` |
| ACR | `eceptagentregistry` (`eceptagentregistry.azurecr.io`) |
| Portal URL | https://devaiagentcontainer.whiteriver-7e291f56.southcentralus.azurecontainerapps.io |
| Hermes API | `https://hermes-dev-gen.eceptionist.com` |

Verified: `GET /api/health` returns `status: ok` and `hermes.ok: true`.

## Known limitations (unchanged / accepted for v1)

- Models inventory that uses local Hermes Python / `HERMES_HOME` may fail in the container
- History (`communications.jsonl`) is ephemeral on the container filesystem
- Portal URL is public with no login

## How to release next versions

1. Merge to `main` (CI build must pass)
2. Update `release.md` and add a docs release note if needed
3. `git tag vX.Y.Z && git push origin vX.Y.Z`
4. Confirm GitHub Actions **Release** workflow succeeds

Requires GitHub secrets/variables documented in `docs/azure-deploy.md` and environment **`production`**.

## Related docs

- [azure-deploy.md](./azure-deploy.md)
- [hermes-wireup.md](./hermes-wireup.md)
- [release.md](../release.md) (changelog index)
