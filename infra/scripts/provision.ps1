<#
.SYNOPSIS
  Provision Azure resources for hermes-client-webportal (RG + Bicep).

.DESCRIPTION
  Creates the resource group, deploys infra/main.bicep, then patches
  PORTAL_PUBLIC_BASE_URL and CORS_ORIGIN to the Container App FQDN.

.EXAMPLE
  .\infra\scripts\provision.ps1 -SubscriptionId '<sub>' -HermesApiBaseUrl 'https://hermes.example.com' -HermesApiKey '***' -HermesWebhookSecret '***'
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$SubscriptionId,

  [string]$ResourceGroupName = 'rg-hermes-portal-prod',
  [string]$Location = 'eastus',
  [string]$NamePrefix = 'hermesportal',

  [Parameter(Mandatory = $true)]
  [string]$HermesApiBaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$HermesApiKey,

  [Parameter(Mandatory = $true)]
  [string]$HermesWebhookSecret,

  [string]$ParametersFile = '',
  [switch]$SkipLogin
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$BicepFile = Join-Path $RepoRoot 'infra\main.bicep'

function Assert-AzCli {
  if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    throw "Azure CLI (az) is not installed. Install: winget install -e --id Microsoft.AzureCLI"
  }
}

Assert-AzCli

if (-not $SkipLogin) {
  $account = az account show 2>$null | ConvertFrom-Json
  if (-not $account) {
    Write-Host 'Logging in to Azure...'
    az login | Out-Null
  }
}

az account set --subscription $SubscriptionId | Out-Null
Write-Host "Using subscription: $SubscriptionId"

$exists = az group exists --name $ResourceGroupName | ConvertFrom-Json
if (-not $exists) {
  Write-Host "Creating resource group $ResourceGroupName in $Location..."
  az group create --name $ResourceGroupName --location $Location | Out-Null
} else {
  Write-Host "Resource group $ResourceGroupName already exists."
}

$deployArgs = @(
  'deployment', 'group', 'create',
  '--resource-group', $ResourceGroupName,
  '--template-file', $BicepFile,
  '--name', 'hermes-portal-infra',
  '--parameters',
  "namePrefix=$NamePrefix",
  "hermesApiBaseUrl=$HermesApiBaseUrl",
  "hermesApiKey=$HermesApiKey",
  "hermesWebhookSecret=$HermesWebhookSecret"
)

if ($ParametersFile -and (Test-Path $ParametersFile)) {
  $deployArgs += @('--parameters', "@$ParametersFile")
}

Write-Host 'Deploying Bicep (ACR, Log Analytics, Container Apps Environment, Container App)...'
$deployment = az @deployArgs -o json | ConvertFrom-Json
$outputs = $deployment.properties.outputs

$fqdn = $outputs.containerAppFqdn.value
$portalUrl = $outputs.portalUrl.value
$acrName = $outputs.acrName.value
$caName = $outputs.containerAppName.value

Write-Host "Patching PORTAL_PUBLIC_BASE_URL and CORS_ORIGIN to $portalUrl ..."
az containerapp update `
  --name $caName `
  --resource-group $ResourceGroupName `
  --set-env-vars "PORTAL_PUBLIC_BASE_URL=$portalUrl" "CORS_ORIGIN=$portalUrl" `
  | Out-Null

Write-Host ''
Write-Host '=== Provision complete ==='
Write-Host "Resource group:     $ResourceGroupName"
Write-Host "ACR name:           $acrName"
Write-Host "ACR login server:   $($outputs.acrLoginServer.value)"
Write-Host "Container App:      $caName"
Write-Host "Portal URL:         $portalUrl"
Write-Host "FQDN:               $fqdn"
Write-Host ''
Write-Host 'Next steps:'
Write-Host "  1. Run .\infra\scripts\setup-github-oidc.ps1 -SubscriptionId $SubscriptionId -ResourceGroupName $ResourceGroupName -AcrName $acrName"
Write-Host '  2. Add the printed GitHub secrets/variables, then push a v* tag to deploy the real image.'
Write-Host '  3. See docs/azure-deploy.md for Hermes wire-up.'

# Write a local outputs file for follow-up scripts (gitignored pattern via .azure/)
$outDir = Join-Path $RepoRoot '.azure'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
@{
  subscriptionId = $SubscriptionId
  resourceGroupName = $ResourceGroupName
  location = $Location
  acrName = $acrName
  acrLoginServer = $outputs.acrLoginServer.value
  containerAppName = $caName
  containerAppsEnvironmentName = $outputs.containerAppsEnvironmentName.value
  portalUrl = $portalUrl
  containerAppFqdn = $fqdn
} | ConvertTo-Json | Set-Content -Path (Join-Path $outDir 'provision-outputs.json') -Encoding utf8

Write-Host "Wrote .azure/provision-outputs.json"
