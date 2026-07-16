import { Router } from "express";
import { HermesApiError, scheduleHermesJob } from "../services/hermesClient";
import {
  appendCommunication,
  buildFailureRecord,
} from "../services/communicationLog";
import type { ScheduleRequestBody } from "../types";

export const scheduleRouter = Router();

scheduleRouter.post("/", async (req, res) => {
  const body = req.body as ScheduleRequestBody;
  const instruction = (body.instruction ?? "").trim();
  const schedule = (body.schedule ?? "").trim();
  const name =
    (body.name ?? "").trim() ||
    `portal-task-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`;

  if (!instruction) {
    res.status(400).json({ error: "instruction is required" });
    return;
  }

  if (!schedule) {
    res.status(400).json({
      error: "schedule is required (e.g. \"30m\", \"every 2h\", \"0 9 * * *\")",
    });
    return;
  }

  const started = Date.now();

  try {
    const result = await scheduleHermesJob({
      name,
      schedule,
      prompt: instruction,
    });
    const responseTimeMs = Date.now() - started;

    let record;
    try {
      record = appendCommunication({
        action: "schedule",
        instruction,
        schedule,
        jobName: name,
        jobId: result.jobId !== "unknown" ? result.jobId : undefined,
        response: result.summary,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        responseTimeMs,
        success: true,
        hermesRaw: result.raw,
        executionResult: null,
        executions: [],
      });
    } catch (logError) {
      console.error("Failed to persist schedule history:", logError);
      record = {
        id: "unlogged",
        timestamp: new Date().toISOString(),
        action: "schedule" as const,
        schedule,
        jobName: name,
        jobId: result.jobId !== "unknown" ? result.jobId : undefined,
        response: result.summary,
        responseTimeMs,
        success: true,
      };
    }

    res.json({
      id: record.id,
      timestamp: record.timestamp,
      action: record.action,
      response: record.response,
      schedule: record.schedule,
      jobName: record.jobName,
      jobId: record.jobId,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      responseTimeMs,
      success: true,
      executionResult: null,
      executions: [],
    });
  } catch (error) {
    const responseTimeMs = Date.now() - started;
    const message =
      error instanceof HermesApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unexpected schedule error";

    let record;
    try {
      record = buildFailureRecord("schedule", instruction, responseTimeMs, message, {
        schedule,
        jobName: name,
      });
    } catch (logError) {
      console.error("Failed to persist schedule failure:", logError);
      record = {
        id: "unlogged",
        timestamp: new Date().toISOString(),
        action: "schedule" as const,
        responseTimeMs,
      };
    }

    res.status(error instanceof HermesApiError ? error.status || 502 : 502).json({
      id: record.id,
      timestamp: record.timestamp,
      action: "schedule",
      response: "",
      schedule,
      jobName: name,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      responseTimeMs,
      success: false,
      error: message,
    });
  }
});
