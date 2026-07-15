import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchHistory, fetchHistoryResult } from "../api/client";
import type { HistoryItem, JobExecutionResult } from "../types";

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function scheduleStatusLabel(item: HistoryItem): { text: string; className: string } {
  if (!item.success) {
    return { text: "error", className: "text-rose-600" };
  }
  const exec = item.executionResult;
  if (!exec) {
    return { text: "pending", className: "text-amber-600" };
  }
  if (exec.status === "ok") {
    return { text: "ok", className: "text-emerald-600" };
  }
  return { text: "error", className: "text-rose-600" };
}

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchingResult, setFetchingResult] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [viewedEventId, setViewedEventId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchHistory();
        if (cancelled) return;
        setItems(data.items);
        setSelectedId(data.items[0]?.id ?? null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load history");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = items.find((item) => item.id === selectedId) ?? null;

  const selectedExecution: JobExecutionResult | null = useMemo(() => {
    if (!selected || selected.action !== "schedule") return null;
    const executions = selected.executions ?? [];
    if (viewedEventId) {
      return executions.find((e) => e.eventId === viewedEventId) ?? selected.executionResult ?? null;
    }
    return selected.executionResult ?? executions[0] ?? null;
  }, [selected, viewedEventId]);

  useEffect(() => {
    setViewedEventId(null);
    setFetchError(null);
  }, [selectedId]);

  async function handleFetchResult() {
    if (!selected || selected.action !== "schedule") return;
    setFetchingResult(true);
    setFetchError(null);
    try {
      const updated = await fetchHistoryResult(selected.id);
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setViewedEventId(updated.executionResult?.eventId ?? null);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to fetch result");
    } finally {
      setFetchingResult(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">History</h1>
          <p className="mt-1 text-sm text-mist">
            Previous communications saved in the portal local log. Schedule items show
            execution results from Hermes webhooks or a manual fetch.
          </p>
        </div>
        <Link
          to="/"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          New communication
        </Link>
      </div>

      {loading && <p className="text-sm text-mist">Loading history…</p>}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 px-6 py-16 text-center">
          <p className="text-sm text-mist">No communications yet.</p>
          <Link to="/" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">
            Start on the Communicate page
          </Link>
        </div>
      )}

      {items.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
          <aside className="max-h-[36rem] overflow-auto rounded-xl border border-slate-200 bg-panel shadow-sm">
            <ul className="divide-y divide-slate-100">
              {items.map((item) => {
                const active = item.id === selectedId;
                const status =
                  item.action === "schedule"
                    ? scheduleStatusLabel(item)
                    : {
                        text: item.success ? "ok" : "error",
                        className: item.success ? "text-emerald-600" : "text-rose-600",
                      };
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={[
                        "w-full px-4 py-3 text-left transition",
                        active ? "bg-brand-soft" : "hover:bg-slate-50",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={[
                            "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                            item.action === "chat"
                              ? "bg-sky-100 text-sky-800"
                              : "bg-amber-100 text-amber-800",
                          ].join(" ")}
                        >
                          {item.action}
                        </span>
                        <span className={["text-[10px] font-medium", status.className].join(" ")}>
                          {status.text}
                        </span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-sm text-ink">
                        {item.instruction}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-mist">
                        {formatTime(item.timestamp)}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <section className="rounded-xl border border-slate-200 bg-panel p-5 shadow-sm">
            {selected ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-mist">
                  <span>{formatTime(selected.timestamp)}</span>
                  <span>·</span>
                  <span className="capitalize">{selected.action}</span>
                  <span>·</span>
                  <span>{selected.inputTokens ?? "—"} in</span>
                  <span>{selected.outputTokens ?? "—"} out</span>
                  <span>{(selected.responseTimeMs / 1000).toFixed(2)}s</span>
                  {selected.jobId && (
                    <>
                      <span>·</span>
                      <span>job {selected.jobId}</span>
                    </>
                  )}
                </div>

                <div>
                  <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-mist">
                    Instruction
                  </h2>
                  <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                    {selected.instruction}
                  </p>
                </div>

                {selected.schedule && (
                  <div>
                    <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-mist">
                      Schedule
                    </h2>
                    <p className="font-mono text-sm text-slate-700">
                      {selected.schedule}
                      {selected.jobName ? ` · ${selected.jobName}` : ""}
                    </p>
                  </div>
                )}

                {selected.model && (
                  <div>
                    <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-mist">
                      Model
                    </h2>
                    <p className="font-mono text-sm text-slate-700">{selected.model}</p>
                  </div>
                )}

                <div>
                  <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-mist">
                    {selected.action === "schedule" ? "Schedule confirmation" : "Response"}
                  </h2>
                  {selected.error && (
                    <p className="mb-2 text-sm text-rose-700">{selected.error}</p>
                  )}
                  <p className="min-h-24 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                    {selected.response || "—"}
                  </p>
                </div>

                {selected.action === "schedule" && (
                  <div className="space-y-3 border-t border-slate-100 pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-mist">
                        Execution result
                      </h2>
                      <button
                        type="button"
                        onClick={() => void handleFetchResult()}
                        disabled={fetchingResult || !selected.jobId}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {fetchingResult ? "Fetching…" : "Fetch result from Hermes"}
                      </button>
                    </div>

                    {fetchError && (
                      <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        {fetchError}
                      </p>
                    )}

                    {(selected.executions?.length ?? 0) > 1 && (
                      <ul className="flex flex-wrap gap-2">
                        {(selected.executions ?? []).map((exec) => {
                          const active = selectedExecution?.eventId === exec.eventId;
                          return (
                            <li key={exec.eventId}>
                              <button
                                type="button"
                                onClick={() => setViewedEventId(exec.eventId)}
                                className={[
                                  "rounded-md border px-2 py-1 font-mono text-[11px]",
                                  active
                                    ? "border-brand bg-brand-soft text-ink"
                                    : "border-slate-200 bg-white text-mist hover:bg-slate-50",
                                ].join(" ")}
                              >
                                {formatTime(exec.runAt)} · {exec.status}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {!selectedExecution ? (
                      <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-sm text-mist">
                        No execution result yet. Wait for the Hermes webhook callback, or
                        fetch the latest output after the job has run.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-3 font-mono text-[11px] text-mist">
                          <span
                            className={
                              selectedExecution.status === "ok"
                                ? "font-semibold text-emerald-600"
                                : "font-semibold text-rose-600"
                            }
                          >
                            {selectedExecution.status}
                          </span>
                          <span>{formatTime(selectedExecution.runAt)}</span>
                          <span>via {selectedExecution.source}</span>
                          {selectedExecution.silent && <span>silent</span>}
                        </div>
                        {selectedExecution.error && (
                          <p className="text-sm text-rose-700">{selectedExecution.error}</p>
                        )}
                        <p className="min-h-32 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                          {selectedExecution.output ||
                            (selectedExecution.silent
                              ? "[SILENT] — no output delivered"
                              : "—")}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-mist">Select a communication to review.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
