<#
.SYNOPSIS
  Update Hermes-related Container App secrets and env after provision.

.EXAMPLE
  .\infra\scripts\set-portal-secrets.ps1 `
    -ResourceGroupName 'rg-hermes-portal-prod' `
    -ContainerAppName 'ca-hermesportal-prod' `
    -HermesApiBaseUrl 'https://hermes.example.com' `
    -HermesApiKey '***' `
    -HermesWebhookSecret '***' `
    -PortalPublicBaseUrl 'https://myapp.azurecontainerapps.io'
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ResourceGroupName,

  [Parameter(Mandatory = $true)]
  [string]$ContainerAppName,

  [Parameter(Mandatory = $true)]
  [string]$HermesApiBaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$HermesApiKey,

  [Parameter(Mandatory = $true)]
  [string]$HermesWebhookSecret,

  [Parameter(Mandatory = $true)]
  [string]$PortalPublicBaseUrl,

  [string]$CorsOrigin = ''
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
  throw "Azure CLI (az) is not installed."
}

if ([string]::IsNullOrWhiteSpace($CorsOrigin)) {
  $CorsOrigin = $PortalPublicBaseUrl
}

Write-Host "Updating secrets on $ContainerAppName..."
az containerapp secret set `
  --name $ContainerAppName `
  --resource-group $ResourceGroupName `
  --secrets "hermes-api-key=$HermesApiKey" "hermes-webhook-secret=$HermesWebhookSecret" `
  | Out-Null

Write-Host "Updating env vars..."
az containerapp update `
  --name $ContainerAppName `
  --resource-group $ResourceGroupName `
  --set-env-vars `
    "HERMES_API_BASE_URL=$HermesApiBaseUrl" `
    "PORTAL_PUBLIC_BASE_URL=$PortalPublicBaseUrl" `
    "CORS_ORIGIN=$CorsOrigin" `
    "HERMES_API_KEY=secretref:hermes-api-key" `
    "HERMES_WEBHOOK_SECRET=secretref:hermes-webhook-secret" `
  | Out-Null

Write-Host "Done. Verify: GET $PortalPublicBaseUrl/api/health"
Write-Host "Restart Hermes gateway after aligning API_SERVER_KEY and CRON_WEBHOOK_SECRET."
