# Hermes ↔ Azure portal wire-up checklist

Complete this after Container Apps is provisioned and `PORTAL_PUBLIC_BASE_URL` is set to `https://<container-app-fqdn>`.

## Portal (Azure Container App env)

| Variable | Value |
|----------|--------|
| `HERMES_API_BASE_URL` | Public Hermes HTTPS base (no trailing slash) |
| `HERMES_API_KEY` | Same as Hermes `API_SERVER_KEY` |
| `HERMES_WEBHOOK_SECRET` | Same as Hermes `CRON_WEBHOOK_SECRET` |
| `PORTAL_PUBLIC_BASE_URL` | `https://<container-app-fqdn>` |
| `CORS_ORIGIN` | Same as `PORTAL_PUBLIC_BASE_URL` |
| `PORT` | `8787` |

Update secrets without redeploying the image:

```powershell
az containerapp secret set `
  --name <containerAppName> `
  --resource-group rg-hermes-portal-prod `
  --secrets hermes-api-key=<API_SERVER_KEY> hermes-webhook-secret=<CRON_WEBHOOK_SECRET>

az containerapp update `
  --name <containerAppName> `
  --resource-group rg-hermes-portal-prod `
  --set-env-vars `
    "HERMES_API_BASE_URL=https://YOUR-HERMES-HOST" `
    "PORTAL_PUBLIC_BASE_URL=https://<container-app-fqdn>" `
    "CORS_ORIGIN=https://<container-app-fqdn>"
```

(`HERMES_API_KEY` / `HERMES_WEBHOOK_SECRET` remain bound via secret refs created by Bicep.)

## Hermes host

1. In Hermes `.env` (or equivalent):
   - `API_SERVER_ENABLED=true` (if required by your Hermes version)
   - `API_SERVER_KEY=<same as portal HERMES_API_KEY>`
   - `CRON_WEBHOOK_SECRET=<same as portal HERMES_WEBHOOK_SECRET>`
2. Confirm Hermes can **egress HTTPS** to the Container App FQDN.
3. **Restart the Hermes gateway** after any secret or webhook-related change.
4. Schedule Task from the portal should create jobs with `deliver=webhook` and callback  
   `{PORTAL_PUBLIC_BASE_URL}/api/webhooks/hermes/job-result`.

## Verify

```text
GET https://<container-app-fqdn>/api/health
```

Expect `status: "ok"` and `hermes.ok: true`.

In History, successful cron callbacks show `source: webhook`. If only `fetch` appears, check Hermes logs for webhook delivery errors and secret mismatch (HTTP 401).

Full Azure setup: [azure-deploy.md](./azure-deploy.md).
