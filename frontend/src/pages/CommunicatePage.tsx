import { useEffect, useState } from "react";
import { sendChat, scheduleTask, fetchModels } from "../api/client";
import type { ActionResponse, HermesModel } from "../types";

type BusyAction = "chat" | "schedule" | null;

function pickDefaultModel(models: HermesModel[]): string {
  const current = models.find((model) => model.isCurrent);
  if (current) return current.id;
  return models[0]?.id ?? "";
}

export default function CommunicatePage() {
  const [instruction, setInstruction] = useState("");
  const [schedule, setSchedule] = useState("every 1h");
  const [models, setModels] = useState<HermesModel[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsSource, setModelsSource] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [result, setResult] = useState<ActionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadModels(refresh = false) {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const data = await fetchModels(refresh);
      const nextModels =
        data.models.length > 0
          ? data.models
          : [
              {
                id: "hermes-agent",
                ownedBy: "hermes",
                root: "hermes-agent",
                parent: null,
                provider: "hermes",
                providerName: "Hermes",
                model: "hermes-agent",
                label: "hermes-agent (default)",
                isCurrent: true,
              },
            ];
      setModels(nextModels);
      setModelsSource(data.source ?? null);
      // Inventory may be unavailable in Azure; keep chat usable with a default.
      setModelsError(data.error ?? data.warning ?? null);
      setSelectedModel((current) => {
        if (current && nextModels.some((model) => model.id === current)) {
          return current;
        }
        return pickDefaultModel(nextModels) || "hermes-agent";
      });
    } catch (err) {
      setModels([
        {
          id: "hermes-agent",
          ownedBy: "hermes",
          root: "hermes-agent",
          parent: null,
          provider: "hermes",
          providerName: "Hermes",
          model: "hermes-agent",
          label: "hermes-agent (default)",
          isCurrent: true,
        },
      ]);
      setSelectedModel("hermes-agent");
      setModelsError(err instanceof Error ? err.message : "Failed to load models");
    } finally {
      setModelsLoading(false);
    }
  }

  useEffect(() => {
    void loadModels(false);
  }, []);

  async function runChat() {
    const text = instruction.trim();
    if (!text || busy) return;

    setBusy("chat");
    setError(null);

    try {
      const response = await sendChat(text, selectedModel || "hermes-agent");
      setResult(response);
      if (!response.success) {
        setError(response.error ?? "Chat failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat request failed");
    } finally {
      setBusy(null);
    }
  }

  async function runSchedule() {
    const text = instruction.trim();
    const scheduleText = schedule.trim();
    if (!text || !scheduleText || busy) return;

    setBusy("schedule");
    setError(null);

    try {
      const response = await scheduleTask(text, scheduleText);
      setResult(response);
      if (!response.success) {
        setError(response.error ?? "Schedule failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Schedule request failed");
    } finally {
      setBusy(null);
    }
  }

  const grouped = models.reduce<Record<string, HermesModel[]>>((acc, model) => {
    const key = model.providerName || model.provider || "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(model);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Communicate</h1>
        <p className="mt-1 text-sm text-mist">
          Send work instructions to Hermes Agent through the portal API.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flex min-h-[28rem] flex-col rounded-xl border border-slate-200 bg-panel p-5 shadow-sm">
          <label htmlFor="instruction" className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-mist">
            Work instruction
          </label>
          <textarea
            id="instruction"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Describe what you want Hermes to do…"
            className="mb-4 min-h-[12rem] flex-1 resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-relaxed text-ink outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20"
          />

          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <label
                htmlFor="model"
                className="text-[11px] font-semibold uppercase tracking-wider text-mist"
              >
                LLM model
              </label>
              <button
                type="button"
                onClick={() => void loadModels(true)}
                disabled={modelsLoading}
                className="text-xs font-medium text-brand hover:underline disabled:opacity-50"
              >
                {modelsLoading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
            <select
              id="model"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={modelsLoading || models.length === 0}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20 disabled:opacity-60"
            >
              {models.length === 0 ? (
                <option value="hermes-agent">hermes-agent (default)</option>
              ) : (
                Object.entries(grouped).map(([group, groupModels]) => (
                  <optgroup key={group} label={group}>
                    {groupModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.model || model.label || model.id}
                        {model.isCurrent ? " (current)" : ""}
                      </option>
                    ))}
                  </optgroup>
                ))
              )}
            </select>
            {modelsError && modelsSource !== "hermes-api" && modelsSource !== "fallback" ? (
              <p className="mt-1.5 text-xs text-rose-600">{modelsError}</p>
            ) : (
              <p className="mt-1.5 text-xs text-mist">
                {models.length} model{models.length === 1 ? "" : "s"}
                {modelsSource === "hermes-api"
                  ? " from Hermes API"
                  : modelsSource === "hermes-inventory"
                    ? " from Hermes provider inventory"
                    : modelsSource
                      ? ` (${modelsSource})`
                      : ""}
                .
              </p>
            )}
          </div>

          <label htmlFor="schedule" className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-mist">
            Schedule (for Schedule Task)
          </label>
          <input
            id="schedule"
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            placeholder='e.g. "30m", "every 2h", "0 9 * * *"'
            className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm text-ink outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20"
          />

          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-mist">
            Actions
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runChat}
              disabled={!instruction.trim() || busy !== null}
              className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0369a1] disabled:hover:bg-brand"
            >
              {busy === "chat" ? "Chatting…" : "Chat"}
            </button>
            <button
              type="button"
              onClick={runSchedule}
              disabled={!instruction.trim() || !schedule.trim() || busy !== null}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              {busy === "schedule" ? "Scheduling…" : "Schedule Task"}
            </button>
          </div>
        </section>

        <section className="flex min-h-[28rem] flex-col rounded-xl border border-slate-200 bg-panel p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-mist">
              Result
            </div>
            {result && (
              <div className="flex flex-wrap gap-2 font-mono text-[11px]">
                {result.model && (
                  <span className="rounded-md bg-sky-50 px-2 py-1 text-sky-800">
                    {result.model}
                  </span>
                )}
                <span className="rounded-md bg-slate-100 px-2 py-1 text-mist">
                  {result.inputTokens ?? "—"} in
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-mist">
                  {result.outputTokens ?? "—"} out
                </span>
                <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700">
                  {(result.responseTimeMs / 1000).toFixed(2)}s
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-1 capitalize text-mist">
                  {result.action}
                </span>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="flex-1 overflow-auto rounded-lg bg-slate-50 p-4 text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
            {result?.response
              ? result.response
              : "Hermes responses appear here after you run Chat or Schedule Task."}
          </div>
        </section>
      </div>
    </div>
  );
}
