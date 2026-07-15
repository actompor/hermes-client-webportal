# Infrastructure

Bicep + PowerShell scripts to provision Azure Container Apps for this portal.

| File | Purpose |
|------|---------|
| `main.bicep` | ACR, Log Analytics, Container Apps Environment, Container App, AcrPull |
| `main.parameters.json` | Sample parameters (replace secrets; do not commit real keys) |
| `scripts/provision.ps1` | Create RG, deploy Bicep, set public URL env |
| `scripts/setup-github-oidc.ps1` | Entra app + federated credentials + RBAC |
| `scripts/set-portal-secrets.ps1` | Update Hermes secrets/env on an existing app |

Full guide: [../docs/azure-deploy.md](../docs/azure-deploy.md)
