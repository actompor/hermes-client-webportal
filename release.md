## this is the release file to keep track the changes of releases for this project ##

### 07.15.2026 -- inital release ###
1. inital release of the projet
2. contains only three functions: new communication, history cpmmunication and setting

### 07.15.2026 7:15 pm - release 1.0.1 ###
- add a new function in the communication page to submit one time run task

### 07.15.2026 9:15 pm - release 1.0.2 ###
- Azure Container Apps auto-deploy (Docker, Bicep/scripts, GitHub Actions on `v*` tags)
- Express serves built frontend; portal wired to public Hermes HTTPS
- Details: [docs/release-1.0.2-azure-auto-deploy.md](docs/release-1.0.2-azure-auto-deploy.md)

### 07.16.2026 5:15 pm - release 1.0.3 ###
- Fix Azure Communicate/History: writable `LOG_DIR` + non-root container dirs
- Model dropdown falls back to remote Hermes `/v1/models` when local Python inventory is unavailable
- Chat no longer blocked when inventory fails; default `hermes-agent` always available
- Details: [docs/release-1.0.3-azure-communicate-history-fix.md](docs/release-1.0.3-azure-communicate-history-fix.md)
- Tag: `release`

### 07.17.2026 - release 1.0.4 ###
- Hermes Agent API dual access on the local host:
  - Local: `http://127.0.0.1:8642` (unchanged loopback bind)
  - Public HTTPS: `https://hermes-dev-gen.eceptionist.com` (Azure DNS A record + Caddy reverse proxy + NSG 443)
- Shared secrets aligned for local + Azure portal: `API_SERVER_KEY` / `CRON_WEBHOOK_SECRET`
- Azure Container App portal pointed at public Hermes URL; local portal `.env` still uses `http://127.0.0.1:8642`
- Verified local portal still works end-to-end against local Hermes (health, models inventory, chat)
- Tag: `v1.0.4`
