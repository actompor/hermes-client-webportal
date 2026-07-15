import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { config } from "../config";
import type {
  ActionType,
  CommunicationRecord,
  JobExecutionResult,
} from "../types";

const MAX_EXECUTIONS = 20;

function ensureLogDir(): void {
  if (!fs.existsSync(config.logDir)) {
    fs.mkdirSync(config.logDir, { recursive: true });
  }
}

function logFilePath(): string {
  return path.join(config.logDir, config.logFileName);
}

function readAllRecords(): CommunicationRecord[] {
  ensureLogDir();
  const file = logFilePath();

  if (!fs.existsSync(file)) {
    return [];
  }

  const content = fs.readFileSync(file, "utf8").trim();
  if (!content) {
    return [];
  }

  const records: CommunicationRecord[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      records.push(JSON.parse(trimmed) as CommunicationRecord);
    } catch {
      // skip corrupt lines
    }
  }
  return records;
}

function writeAllRecords(records: CommunicationRecord[]): void {
  ensureLogDir();
  const file = logFilePath();
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  const body = records.map((r) => JSON.stringify(r)).join("\n") + (records.length ? "\n" : "");
  fs.writeFileSync(tmp, body, "utf8");
  fs.renameSync(tmp, file);
}

export function appendCommunication(
  partial: Omit<CommunicationRecord, "id" | "timestamp">,
): CommunicationRecord {
  ensureLogDir();

  const record: CommunicationRecord = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...partial,
  };

  fs.appendFileSync(logFilePath(), `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

export function readCommunications(limit = 200): CommunicationRecord[] {
  const records = readAllRecords();
  return records.reverse().slice(0, limit);
}

export function findCommunicationById(id: string): CommunicationRecord | null {
  if (!id) return null;
  const records = readAllRecords();
  for (let i = records.length - 1; i >= 0; i -= 1) {
    if (records[i].id === id) return records[i];
  }
  return null;
}

export function findScheduleByJobId(jobId: string): CommunicationRecord | null {
  if (!jobId) return null;
  const records = readAllRecords();
  for (let i = records.length - 1; i >= 0; i -= 1) {
    const record = records[i];
    if (record.action === "schedule" && record.jobId === jobId) {
      return record;
    }
  }
  return null;
}

export function updateCommunication(
  id: string,
  patch: Partial<CommunicationRecord>,
): CommunicationRecord | null {
  const records = readAllRecords();
  const index = records.findIndex((r) => r.id === id);
  if (index < 0) return null;

  const { id: _ignoreId, ...safePatch } = patch;
  const updated: CommunicationRecord = {
    ...records[index],
    ...safePatch,
    id: records[index].id,
  };
  records[index] = updated;
  writeAllRecords(records);
  return updated;
}

export function upsertJobExecution(
  recordId: string,
  execution: JobExecutionResult,
): CommunicationRecord | null {
  const existing = findCommunicationById(recordId);
  if (!existing) return null;

  const prior = existing.executions ?? [];
  if (prior.some((e) => e.eventId === execution.eventId)) {
    // Idempotent: already recorded this event.
    return existing;
  }

  const executions = [execution, ...prior].slice(0, MAX_EXECUTIONS);
  return updateCommunication(recordId, {
    executionResult: execution,
    executions,
  });
}

export function buildFailureRecord(
  action: ActionType,
  instruction: string,
  responseTimeMs: number,
  error: string,
  extras?: Partial<CommunicationRecord>,
): CommunicationRecord {
  return appendCommunication({
    action,
    instruction,
    response: "",
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    responseTimeMs,
    success: false,
    error,
    ...extras,
  });
}
