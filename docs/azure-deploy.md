# Azure auto-deploy (Container Apps)

This portal runs as a single container on **Azure Container Apps**. Hermes stays on a separate public HTTPS URL.

## Current production target (configured)

| Item | Value |
|------|--------|
| Subscription | `756bd5de-37ed-447f-8eca-4bdaf387814c` |
| Resource group | `AIServices` |
| Container App | `devaiagentcontainer` |
| ACR | `eceptagentregistry` (`eceptagentregistry.azurecr.io`) |
| Portal URL | https://devaiagentcontainer.whiteriver-7e291f56.southcentralus.azurecontainerapps.io |
| Hermes API | `https://hermes-dev-gen.eceptionist.com` |

First image deployed: `eceptagentregistry.azurecr.io/hermes-client-webportal:v1.0.1` (health + Hermes OK verified).

---

## Architecture

- **ACR** stores `hermes-client-webportal:vX.Y.Z`
- **Container App** serves Express + built React (same origin `/api` + SPA)
- **GitHub Actions** builds on PR/`main`; **tag `v*`** builds, pushes, deploys, and smokes `GET /api/health`

## One-time Azure setup

### Prerequisites

1. Azure subscription with permission to create RGs, ACR, Container Apps, and Entra app registrations
2. [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) (`winget install -e --id Microsoft.AzureCLI`)
3. Values for Hermes:
   - Public `HERMES_API_BASE_URL` (HTTPS, no trailing slash)
   - `API_SERVER_KEY` / portal `HERMES_API_KEY`
   - Shared `CRON_WEBHOOK_SECRET` / portal `HERMES_WEBHOOK_SECRET`

### 1. Provision infrastructure

```powershell
cd hermes-client-webportal
az login
.\infra\scripts\provision.ps1 `
  -SubscriptionId '<subscription-guid>' `
  -HermesApiBaseUrl 'https://YOUR-HERMES-HOST' `
  -HermesApiKey '<API_SERVER_KEY>' `
  -HermesWebhookSecret '<shared-webhook-secret>'
```

Creates `rg-hermes-portal-prod` (default), ACR, Log Analytics, Container Apps Environment, Container App (placeholder image initially), managed identity + `AcrPull`, and patches `PORTAL_PUBLIC_BASE_URL` / `CORS_ORIGIN` to the app FQDN.

Outputs are written to `.azure/provision-outputs.json` (gitignored).

### 2. GitHub OIDC + RBAC

```powershell
.\infra\scripts\setup-github-oidc.ps1 `
  -SubscriptionId '<subscription-guid>' `
  -ResourceGroupName 'rg-hermes-portal-prod' `
  -AcrName '<from provision output>'
```

Add the printed **secrets** and **variables** under the GitHub repo → Settings → Secrets and variables → Actions.

Optional (with [GitHub CLI](https://cli.github.com/)):

```powershell
gh secret set AZURE_CLIENT_ID --body '<appId>'
gh secret set AZURE_TENANT_ID --body '<tenantId>'
gh secret set AZURE_SUBSCRIPTION_ID --body '<subscriptionId>'
gh variable set AZURE_RESOURCE_GROUP --body 'rg-hermes-portal-prod'
gh variable set AZURE_ACR_NAME --body '<acrName>'
gh variable set AZURE_ACR_LOGIN_SERVER --body '<acrName>.azurecr.io'
gh variable set AZURE_CONTAINER_APP --body '<containerAppName>'
gh variable set PORTAL_URL --body 'https://<fqdn>'
```

Create a GitHub Environment named **`production`** (used by the release workflow). No required reviewers needed for v1.

### 3. Wire Hermes (required for Schedule Task webhooks)

On the Hermes host:

1. Set `API_SERVER_KEY` to the same value as portal `HERMES_API_KEY`
2. Set `CRON_WEBHOOK_SECRET` (or `cron.webhook.secret` in config) to the same value as portal `HERMES_WEBHOOK_SECRET`
3. Ensure Hermes can reach `https://<portal-fqdn>/api/webhooks/hermes/job-result` over HTTPS
4. **Restart the Hermes gateway** after changing secrets
5. Confirm portal env `PORTAL_PUBLIC_BASE_URL` is `https://<portal-fqdn>` (provision script sets this)

After the first real image deploy, `GET https://<portal-fqdn>/api/health` should show `status: ok` and Hermes `ok: true`.

### 4. First release

```powershell
git tag v1.0.2
git push origin v1.0.2
```

Watch **Actions → Release**. On success, open `PORTAL_URL`.

## Ongoing release process

1. PR → CI build must pass → merge to `main`
2. Update `release.md`
3. Tag and push `vX.Y.Z`
4. Release workflow: build/push image → update Container App → smoke `/api/health` (requires Hermes reachable)
5. Spot-check Communicate / Schedule / History

Rollback:

```powershell
az containerapp update `
  --name <containerAppName> `
  --resource-group rg-hermes-portal-prod `
  --image <acrLoginServer>/hermes-client-webportal:v1.0.1
```

## Known v1 limitations

- **Models inventory** (local Hermes Python / `HERMES_HOME`) may fail in the container — accepted for v1
- **History** (`communications.jsonl`) is ephemeral on the container filesystem
- Portal URL is **public with no login** — treat the URL as sensitive

## Infra files

| Path | Purpose |
|------|---------|
| `infra/main.bicep` | ACR, Log Analytics, CAE, Container App, AcrPull |
| `infra/main.parameters.json` | Sample parameter values (do not commit real secrets) |
| `infra/scripts/provision.ps1` | Create RG + deploy Bicep + patch public URL |
| `infra/scripts/setup-github-oidc.ps1` | Entra app, federated creds, AcrPush + Contributor |
| `.github/workflows/ci.yml` | Build on PR/`main` |
| `.github/workflows/release.yml` | Deploy on `v*` tags |
| `Dockerfile` | Multi-stage frontend + backend image |
