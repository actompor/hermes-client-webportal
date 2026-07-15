import { Router } from "express";
import { randomUUID } from "crypto";
import { HermesApiError, getHermesJobOutput } from "../services/hermesClient";
import {
  findCommunicationById,
  readCommunications,
  updateCommunication,
  upsertJobExecution,
} from "../services/communicationLog";
import type { JobExecutionResult } from "../types";

export const historyRouter = Router();

function toHistoryItem(item: ReturnType<typeof readCommunications>[number]) {
  return {
    id: item.id,
    timestamp: item.timestamp,
    action: item.action,
    instruction: item.instruction,
    model: item.model,
    schedule: item.schedule,
    jobName: item.jobName,
    jobId: item.jobId,
    response: item.response,
    inputTokens: item.inputTokens,
    outputTokens: item.outputTokens,
    totalTokens: item.totalTokens,
    responseTimeMs: item.responseTimeMs,
    success: item.success,
    error: item.error,
    executionResult: item.executionResult ?? null,
    executions: item.executions ?? [],
  };
}

historyRouter.get("/", (_req, res) => {
  const limitParam = Number(_req.query.limit ?? 200);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 1000) : 200;
  const items = readCommunications(limit);

  res.json({
    count: items.length,
    items: items.map(toHistoryItem),
  });
});

historyRouter.post("/:id/fetch-result", async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) {
    res.status(400).json({ error: "id is required" });
    return;
  }

  const record = findCommunicationById(id);
  if (!record) {
    res.status(404).json({ error: "History item not found" });
    return;
  }
  if (record.action !== "schedule") {
    res.status(400).json({ error: "Only schedule items support fetch-result" });
    return;
  }
  if (!record.jobId) {
    res.status(400).json({ error: "Schedule item has no Hermes jobId" });
    return;
  }

  try {
    const output = await getHermesJobOutput(record.jobId);
    if (!output.lastRunAt && !output.output) {
      res.status(404).json({
        error: "No execution output available yet for this job",
        jobId: record.jobId,
        lastStatus: output.lastStatus,
      });
      return;
    }

    const status: JobExecutionResult["status"] =
      output.lastStatus === "ok" ? "ok" : "error";
    const runAt = output.lastRunAt || new Date().toISOString();
    const fingerprint = `${runAt}|${status}|${output.output ?? ""}|${output.lastError ?? ""}`;
    const already = (record.executions ?? []).find(
      (e) => `${e.runAt}|${e.status}|${e.output ?? ""}|${e.error ?? ""}` === fingerprint,
    );

    let updated;
    if (already) {
      const refreshed: JobExecutionResult = {
        ...already,
        source: "fetch",
        receivedAt: new Date().toISOString(),
      };
      const executions = [
        refreshed,
        ...(record.executions ?? []).filter((e) => e.eventId !== already.eventId),
      ].slice(0, 20);
      updated =
        updateCommunication(record.id, {
          executionResult: refreshed,
          executions,
        }) || record;
    } else {
      const execution: JobExecutionResult = {
        eventId: `fetch_${randomUUID()}`,
        runAt,
        status,
        output: output.output ?? undefined,
        error: output.lastError ?? undefined,
        source: "fetch",
        receivedAt: new Date().toISOString(),
      };
      updated = upsertJobExecution(record.id, execution) || record;
    }

    res.json(toHistoryItem(updated));
  } catch (error) {
    const message =
      error instanceof HermesApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to fetch job result";
    res.status(error instanceof HermesApiError ? error.status || 502 : 502).json({
      error: message,
    });
  }
});
