@description('Resource name prefix (alphanumeric, lowercase). Used to derive unique names.')
param namePrefix string = 'hermesportal'

@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('Globally unique ACR name (5-50 alphanumeric). Leave empty to derive from prefix + uniqueString.')
param acrName string = ''

@description('Container Apps Environment name.')
param containerAppsEnvironmentName string = ''

@description('Container App name.')
param containerAppName string = ''

@description('Initial container image. Use a public placeholder until the first release push.')
param containerImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('Target port inside the container.')
param targetPort int = 8787

@description('Minimum replicas (use 1 so Hermes webhooks can reach a warm instance).')
param minReplicas int = 1

@description('Maximum replicas.')
param maxReplicas int = 3

@description('Hermes public API base URL (no trailing slash).')
param hermesApiBaseUrl string = 'https://example.invalid'

@secure()
@description('Hermes API_SERVER_KEY shared with the portal.')
param hermesApiKey string = 'replace-me'

@secure()
@description('Shared HMAC secret for Hermes cron webhooks.')
param hermesWebhookSecret string = 'replace-me'

@description('Optional override for PORTAL_PUBLIC_BASE_URL. Empty = https://<fqdn> after deploy.')
param portalPublicBaseUrl string = ''

@description('CORS allowed origin. Empty = use portal public URL / FQDN.')
param corsOrigin string = ''

var uniqueSuffix = uniqueString(resourceGroup().id)
var resolvedAcrName = empty(acrName) ? take(toLower('${namePrefix}${uniqueSuffix}'), 50) : acrName
var resolvedCaeName = empty(containerAppsEnvironmentName) ? 'cae-${namePrefix}-prod' : containerAppsEnvironmentName
var resolvedCaName = empty(containerAppName) ? 'ca-${namePrefix}-prod' : containerAppName
var logAnalyticsName = 'log-${namePrefix}-prod'

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: resolvedAcrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
  }
}

resource cae 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: resolvedCaeName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: resolvedCaName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: cae.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: targetPort
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: acr.properties.loginServer
          identity: 'system'
        }
      ]
      secrets: [
        {
          name: 'hermes-api-key'
          value: hermesApiKey
        }
        {
          name: 'hermes-webhook-secret'
          value: hermesWebhookSecret
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'portal'
          image: containerImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'PORT'
              value: string(targetPort)
            }
            {
              name: 'STATIC_DIR'
              value: '/app/public'
            }
            {
              name: 'HERMES_API_BASE_URL'
              value: hermesApiBaseUrl
            }
            {
              name: 'HERMES_API_KEY'
              secretRef: 'hermes-api-key'
            }
            {
              name: 'HERMES_WEBHOOK_SECRET'
              secretRef: 'hermes-webhook-secret'
            }
            {
              name: 'PORTAL_PUBLIC_BASE_URL'
              value: !empty(portalPublicBaseUrl) ? portalPublicBaseUrl : 'https://pending-set-after-deploy'
            }
            {
              name: 'CORS_ORIGIN'
              value: !empty(corsOrigin) ? corsOrigin : (!empty(portalPublicBaseUrl) ? portalPublicBaseUrl : '*')
            }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
      }
    }
  }
}

resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, containerApp.id, 'AcrPull')
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalId: containerApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output resourceGroupName string = resourceGroup().name
output location string = location
output acrName string = acr.name
output acrLoginServer string = acr.properties.loginServer
output containerAppsEnvironmentName string = cae.name
output containerAppName string = containerApp.name
output containerAppFqdn string = containerApp.properties.configuration.ingress.fqdn
output containerAppPrincipalId string = containerApp.identity.principalId
output portalUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
