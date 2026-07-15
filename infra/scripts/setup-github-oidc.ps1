<#
.SYNOPSIS
  Create Entra app + federated credentials for GitHub Actions OIDC and assign RBAC.

.DESCRIPTION
  Creates (or reuses) an app registration used by GitHub Actions to push to ACR
  and update the Container App. Prints values to store as GitHub secrets/vars.

.EXAMPLE
  .\infra\scripts\setup-github-oidc.ps1 -SubscriptionId '<sub>' -ResourceGroupName 'rg-hermes-portal-prod' -AcrName '<acr>'
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$SubscriptionId,

  [Parameter(Mandatory = $true)]
  [string]$ResourceGroupName,

  [Parameter(Mandatory = $true)]
  [string]$AcrName,

  [string]$GitHubOrgRepo = 'actompor/hermes-client-webportal',
  [string]$AppDisplayName = 'github-hermes-client-webportal-deploy',
  [switch]$SkipLogin
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
  throw "Azure CLI (az) is not installed. Install: winget install -e --id Microsoft.AzureCLI"
}

if (-not $SkipLogin) {
  $account = az account show 2>$null | ConvertFrom-Json
  if (-not $account) {
    az login | Out-Null
  }
}

az account set --subscription $SubscriptionId | Out-Null
$tenantId = (az account show --query tenantId -o tsv)

Write-Host "Looking for app registration '$AppDisplayName'..."
$appId = az ad app list --display-name $AppDisplayName --query '[0].appId' -o tsv
if ([string]::IsNullOrWhiteSpace($appId)) {
  Write-Host 'Creating app registration...'
  $appId = az ad app create --display-name $AppDisplayName --query appId -o tsv
} else {
  Write-Host "Reusing appId $appId"
}

$spId = az ad sp list --filter "appId eq '$appId'" --query '[0].id' -o tsv
if ([string]::IsNullOrWhiteSpace($spId)) {
  Write-Host 'Creating service principal...'
  $spId = az ad sp create --id $appId --query id -o tsv
}

function Ensure-FederatedCredential {
  param(
    [string]$Name,
    [string]$Subject
  )
  $existing = az ad app federated-credential list --id $appId --query "[?name=='$Name'].name" -o tsv
  if ($existing) {
    Write-Host "Federated credential '$Name' already exists."
    return
  }
  $tmp = [System.IO.Path]::GetTempFileName()
  @{
    name = $Name
    issuer = 'https://token.actions.githubusercontent.com'
    subject = $Subject
    audiences = @('api://AzureADTokenExchange')
    description = "GitHub Actions OIDC for $GitHubOrgRepo"
  } | ConvertTo-Json | Set-Content -Path $tmp -Encoding utf8
  az ad app federated-credential create --id $appId --parameters "@$tmp" | Out-Null
  Remove-Item $tmp -Force
  Write-Host "Created federated credential '$Name' ($Subject)"
}

# Tags (release workflow) and main branch (optional manual runs)
Ensure-FederatedCredential -Name 'github-tags' -Subject "repo:${GitHubOrgRepo}:ref:refs/tags/*"
Ensure-FederatedCredential -Name 'github-main' -Subject "repo:${GitHubOrgRepo}:ref:refs/heads/main"
Ensure-FederatedCredential -Name 'github-environment-production' -Subject "repo:${GitHubOrgRepo}:environment:production"

$rgId = az group show --name $ResourceGroupName --query id -o tsv
$acrId = az acr show --name $AcrName --resource-group $ResourceGroupName --query id -o tsv

function Ensure-Role {
  param([string]$Role, [string]$Scope)
  $assigned = az role assignment list --assignee $spId --role $Role --scope $Scope --query '[0].id' -o tsv
  if ($assigned) {
    Write-Host "Role '$Role' already assigned on scope."
    return
  }
  Write-Host "Assigning '$Role'..."
  az role assignment create --assignee-object-id $spId --assignee-principal-type ServicePrincipal --role $Role --scope $Scope | Out-Null
}

# Push images
Ensure-Role -Role 'AcrPush' -Scope $acrId
# Deploy / update Container Apps in the RG
Ensure-Role -Role 'Contributor' -Scope $rgId

Write-Host ''
Write-Host '=== Configure GitHub repository secrets and variables ==='
Write-Host ''
Write-Host 'Secrets (Settings > Secrets and variables > Actions > Secrets):'
Write-Host "  AZURE_CLIENT_ID       = $appId"
Write-Host "  AZURE_TENANT_ID       = $tenantId"
Write-Host "  AZURE_SUBSCRIPTION_ID = $SubscriptionId"
Write-Host ''
Write-Host 'Variables (Settings > Secrets and variables > Actions > Variables):'
Write-Host "  AZURE_RESOURCE_GROUP  = $ResourceGroupName"
Write-Host "  AZURE_ACR_NAME        = $AcrName"
$caName = $null
$outputsPath = Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')) '.azure\provision-outputs.json'
if (Test-Path $outputsPath) {
  $prov = Get-Content $outputsPath -Raw | ConvertFrom-Json
  $caName = $prov.containerAppName
  Write-Host "  AZURE_CONTAINER_APP   = $caName"
  Write-Host "  AZURE_ACR_LOGIN_SERVER= $($prov.acrLoginServer)"
  Write-Host "  PORTAL_URL            = $($prov.portalUrl)"
} else {
  Write-Host '  AZURE_CONTAINER_APP   = <from provision output, e.g. ca-hermesportal-prod>'
  Write-Host '  AZURE_ACR_LOGIN_SERVER= <acrName>.azurecr.io'
  Write-Host '  PORTAL_URL            = https://<fqdn>'
}
Write-Host ''
Write-Host "Optional: gh secret set / gh variable set against $GitHubOrgRepo"
