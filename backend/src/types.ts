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

export interface CommunicationRecord {
  id: string;
  timestamp: string;
  action: ActionType;
  instruction: string;
  model?: string;
  schedule?: string;
  jobName?: string;
  jobId?: string;
  response: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  responseTimeMs: number;
  success: boolean;
  error?: string;
  hermesRaw?: unknown;
  executionResult?: JobExecutionResult | null;
  executions?: JobExecutionResult[];
}

export interface ChatRequestBody {
  instruction: string;
  model?: string;
  provider?: string;
}

export interface ScheduleRequestBody {
  instruction: string;
  schedule: string;
  name?: string;
}
