import { config } from "../config";

export class HermesApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "HermesApiError";
    this.status = status;
    this.body = body;
  }
}

async function hermesFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };

  if (config.hermesApiKey) {
    headers.Authorization = `Bearer ${config.hermesApiKey}`;
  }

  const url = `${config.hermesApiBaseUrl}${path}`;
  return fetch(url, { ...init, headers });
}

export interface HermesChatResult {
  content: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  raw: unknown;
}

export interface HermesModelInfo {
  id: string;
  ownedBy: string | null;
  root: string | null;
  parent: string | null;
}

export async function listHermesModels(): Promise<HermesModelInfo[]> {
  const response = await hermesFetch("/v1/models");
  const raw = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new HermesApiError(
      extractErrorMessage(raw) || `Hermes models failed (${response.status})`,
      response.status,
      raw,
    );
  }

  const data = (raw as { data?: Array<Record<string, unknown>> }).data ?? [];
  return data
    .map((item) => ({
      id: String(item.id ?? ""),
      ownedBy: item.owned_by != null ? String(item.owned_by) : null,
      root: item.root != null ? String(item.root) : null,
      parent: item.parent != null ? String(item.parent) : null,
    }))
    .filter((item) => item.id.length > 0);
}

export async function chatWithHermes(
  instruction: string,
  model = "hermes-agent",
): Promise<HermesChatResult> {
  const response = await hermesFetch("/v1/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      model: model || "hermes-agent",
      messages: [{ role: "user", content: instruction }],
      stream: false,
    }),
  });

  const raw = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new HermesApiError(
      extractErrorMessage(raw) || `Hermes chat failed (${response.status})`,
      response.status,
      raw,
    );
  }

  const content =
    (raw as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]
      ?.message?.content ?? "";

  const usage = (raw as { usage?: Record<string, number> }).usage ?? {};

  return {
    content,
    inputTokens: usage.prompt_tokens ?? usage.input_tokens ?? null,
    outputTokens: usage.completion_tokens ?? usage.output_tokens ?? null,
    totalTokens: usage.total_tokens ?? null,
    raw,
  };
}

export interface HermesJobResult {
  summary: string;
  jobId: string;
  raw: unknown;
}

export interface HermesJobOutput {
  jobId: string;
  lastStatus: string | null;
  lastRunAt: string | null;
  lastError: string | null;
  lastDeliveryError: string | null;
  outputFile: string | null;
  output: string | null;
  raw: unknown;
}

function cronCallbackUrl(): string | null {
  const base = config.portalPublicBaseUrl;
  if (!base) return null;
  return `${base}/api/webhooks/hermes/job-result`;
}

export async function scheduleHermesJob(params: {
  name: string;
  schedule: string;
  prompt: string;
}): Promise<HermesJobResult> {
  const callbackUrl = cronCallbackUrl();
  const body: Record<string, unknown> = {
    name: params.name,
    schedule: params.schedule,
    prompt: params.prompt,
  };

  if (callbackUrl && config.hermesWebhookSecret) {
    body.deliver = "webhook";
    body.callback = { url: callbackUrl };
  } else {
    // Fall back to local when webhook is not configured so scheduling still works.
    body.deliver = "local";
  }

  const response = await hermesFetch("/api/jobs", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const raw = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new HermesApiError(
      extractErrorMessage(raw) || `Hermes schedule failed (${response.status})`,
      response.status,
      raw,
    );
  }

  const job = (raw as { job?: Record<string, unknown> }).job ?? raw;
  const jobId = String((job as { id?: string }).id ?? "unknown");
  const scheduleDisplay =
    (job as { schedule_display?: string }).schedule_display ?? params.schedule;
  const nextRun = (job as { next_run_at?: string }).next_run_at;
  const deliver = (job as { deliver?: string }).deliver ?? String(body.deliver);

  const summary = [
    `Scheduled job "${params.name}" (id: ${jobId}).`,
    `Schedule: ${scheduleDisplay}`,
    `Deliver: ${deliver}`,
    nextRun ? `Next run: ${nextRun}` : null,
    "",
    "Prompt:",
    params.prompt,
  ]
    .filter((line) => line !== null)
    .join("\n");

  return { summary, jobId, raw };
}

export async function getHermesJobOutput(jobId: string): Promise<HermesJobOutput> {
  const response = await hermesFetch(`/api/jobs/${encodeURIComponent(jobId)}/output`);
  const raw = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new HermesApiError(
      extractErrorMessage(raw) || `Hermes job output failed (${response.status})`,
      response.status,
      raw,
    );
  }

  const obj = raw as Record<string, unknown>;
  return {
    jobId: String(obj.job_id ?? jobId),
    lastStatus: obj.last_status != null ? String(obj.last_status) : null,
    lastRunAt: obj.last_run_at != null ? String(obj.last_run_at) : null,
    lastError: obj.last_error != null ? String(obj.last_error) : null,
    lastDeliveryError:
      obj.last_delivery_error != null ? String(obj.last_delivery_error) : null,
    outputFile: obj.output_file != null ? String(obj.output_file) : null,
    output: obj.output != null ? String(obj.output) : null,
    raw,
  };
}

export async function checkHermesHealth(): Promise<{
  ok: boolean;
  status: number;
  body: unknown;
}> {
  try {
    const response = await hermesFetch("/health");
    const body = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}

function extractErrorMessage(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const obj = raw as Record<string, unknown>;
  if (typeof obj.error === "string") return obj.error;
  if (obj.error && typeof obj.error === "object") {
    const nested = obj.error as Record<string, unknown>;
    if (typeof nested.message === "string") return nested.message;
  }
  if (typeof obj.message === "string") return obj.message;
  if (typeof obj.detail === "string") return obj.detail;
  return "";
}
