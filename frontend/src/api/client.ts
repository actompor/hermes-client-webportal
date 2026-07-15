import type {
  ActionResponse,
  HistoryItem,
  HistoryResponse,
  ModelsResponse,
  SettingsResponse,
} from "../types";

async function parseJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    const message =
      (data as { error?: string }).error ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return data;
}

export async function sendChat(
  instruction: string,
  model?: string,
): Promise<ActionResponse> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instruction, model }),
  });
  return parseJson<ActionResponse>(response);
}

export async function scheduleTask(
  instruction: string,
  schedule: string,
  name?: string,
): Promise<ActionResponse> {
  const response = await fetch("/api/schedule", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instruction, schedule, name }),
  });
  return parseJson<ActionResponse>(response);
}

export async function fetchHistory(limit = 200): Promise<HistoryResponse> {
  const response = await fetch(`/api/history?limit=${limit}`);
  return parseJson<HistoryResponse>(response);
}

export async function fetchHistoryResult(id: string): Promise<HistoryItem> {
  const response = await fetch(`/api/history/${encodeURIComponent(id)}/fetch-result`, {
    method: "POST",
  });
  return parseJson<HistoryItem>(response);
}

export async function fetchModels(refresh = false): Promise<ModelsResponse> {
  const response = await fetch(`/api/models${refresh ? "?refresh=1" : ""}`);
  return parseJson<ModelsResponse>(response);
}

export async function fetchSettings(): Promise<SettingsResponse> {
  const response = await fetch("/api/settings");
  return parseJson<SettingsResponse>(response);
}

export async function saveSettings(payload: {
  hermesApiBaseUrl?: string;
  hermesApiKey?: string;
}): Promise<SettingsResponse> {
  const response = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<SettingsResponse>(response);
}
