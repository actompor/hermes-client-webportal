export type ActionType = "chat" | "schedule";

export interface JobExecutionResult {
  eventId: string;
  runAt: string;
  status: "ok" | "error";
  output?: string;
  error?: string;
  silent?: boolean;
  source: "webhook" | "fetch";
  receivedAt: string;
}

export interface ActionResponse {
  id: string;
  timestamp: string;
  action: ActionType;
  model?: string;
  response: string;
  schedule?: string;
  jobName?: string;
  jobId?: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  responseTimeMs: number;
  success: boolean;
  error?: string;
  executionResult?: JobExecutionResult | null;
  executions?: JobExecutionResult[];
}

export interface HistoryItem extends ActionResponse {
  instruction: string;
}

export interface HistoryResponse {
  count: number;
  items: HistoryItem[];
}

export interface HermesModel {
  id: string;
  ownedBy: string | null;
  root: string | null;
  parent: string | null;
  provider?: string;
  providerName?: string;
  model?: string;
  label?: string;
  isCurrent?: boolean;
}

export interface HermesProviderGroup {
  slug: string;
  name: string;
  authenticated: boolean;
  isCurrent: boolean;
  models: string[];
  totalModels: number;
}

export interface ModelsResponse {
  count: number;
  source?: string;
  currentProvider?: string | null;
  currentModel?: string | null;
  providers?: HermesProviderGroup[];
  models: HermesModel[];
  error?: string;
}

export interface SettingsResponse {
  hermesApiBaseUrl: string;
  hermesApiKeyConfigured: boolean;
  hermesApiKeyPreview: string;
  hermesReachable: boolean;
  hermesHealth?: unknown;
  message?: string;
}
