import { createHmac, timingSafeEqual } from "crypto";
import { Router, raw } from "express";
import { config } from "../config";
import {
  findScheduleByJobId,
  upsertJobExecution,
} from "../services/communicationLog";
import type { JobExecutionResult } from "../types";

export const webhooksRouter = Router();

const MAX_SKEW_SECONDS = 5 * 60;

function verifyHermesSignature(
  rawBody: Buffer,
  timestampHeader: string | undefined,
  signatureHeader: string | undefined,
  secret: string,
): { ok: true } | { ok: false; error: string } {
  if (!timestampHeader || !signatureHeader) {
    return { ok: false, error: "Missing signature headers" };
  }

  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts)) {
    return { ok: false, error: "Invalid timestamp" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > MAX_SKEW_SECONDS) {
    return { ok: false, error: "Timestamp outside allowed window" };
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestampHeader}.`)
    .update(rawBody)
    .digest("hex");
  const expectedHeader = `v1=${expected}`;

  const provided = signatureHeader.trim();
  const a = Buffer.from(expectedHeader);
  const b = Buffer.from(provided);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: "Invalid signature" };
  }

  return { ok: true };
}

webhooksRouter.post(
  "/hermes/job-result",
  raw({ type: "*/*", limit: "1mb" }),
  (req, res) => {
    if (!config.hermesWebhookSecret) {
      res.status(503).json({ error: "HERMES_WEBHOOK_SECRET is not configured" });
      return;
    }

    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === "string" ? req.body : "", "utf8");

    const verified = verifyHermesSignature(
      rawBody,
      req.header("X-Hermes-Timestamp") ?? undefined,
      req.header("X-Hermes-Signature") ?? undefined,
      config.hermesWebhookSecret,
    );

    if (!verified.ok) {
      res.status(401).json({ error: verified.error });
      return;
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
    } catch {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }

    const job = (payload.job ?? {}) as Record<string, unknown>;
    const run = (payload.run ?? {}) as Record<string, unknown>;
    const jobId = typeof job.id === "string" ? job.id : "";
    const eventId =
      typeof payload.event_id === "string" && payload.event_id
        ? payload.event_id
        : `evt_missing_${Date.now()}`;

    if (!jobId) {
      res.status(400).json({ error: "job.id is required" });
      return;
    }

    const record = findScheduleByJobId(jobId);
    if (!record) {
      // Acknowledge so Hermes does not retry forever for unknown jobs.
      res.status(204).end();
      return;
    }

    const statusRaw = typeof run.status === "string" ? run.status : "error";
    const status: JobExecutionResult["status"] = statusRaw === "ok" ? "ok" : "error";
    const runAt =
      (typeof run.run_at === "string" && run.run_at) ||
      (typeof payload.occurred_at === "string" && payload.occurred_at) ||
      new Date().toISOString();

    const execution: JobExecutionResult = {
      eventId,
      runAt,
      status,
      output: typeof run.output === "string" ? run.output : undefined,
      error: typeof run.error === "string" ? run.error : undefined,
      silent: Boolean(run.silent),
      source: "webhook",
      receivedAt: new Date().toISOString(),
    };

    upsertJobExecution(record.id, execution);
    res.status(204).end();
  },
);
