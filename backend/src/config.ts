import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const settingsFilePath = path.resolve(__dirname, "..", "data", "settings.json");

export interface RuntimeSettings {
  hermesApiBaseUrl: string;
  hermesApiKey: string;
}

export interface PortalConfig {
  port: number;
  hermesApiBaseUrl: string;
  hermesApiKey: string;
  hermesHome: string;
  hermesPython: string;
  corsOrigin: string;
  logDir: string;
  logFileName: string;
  settingsFilePath: string;
  /** Public base URL Hermes uses to reach this portal for cron webhooks. */
  portalPublicBaseUrl: string;
  /** Shared HMAC secret for Hermes → portal cron result webhooks. */
  hermesWebhookSecret: string;
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/$/, "");
}

function loadPersistedSettings(): Partial<RuntimeSettings> {
  try {
    if (!fs.existsSync(settingsFilePath)) {
      return {};
    }
    const raw = fs.readFileSync(settingsFilePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<RuntimeSettings>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

const persisted = loadPersistedSettings();

const defaultHermesHome = path.join(process.env.LOCALAPPDATA || "", "hermes");

export const config: PortalConfig = {
  port: Number(process.env.PORT ?? 8787),
  hermesApiBaseUrl: normalizeBaseUrl(
    persisted.hermesApiBaseUrl ||
      process.env.HERMES_API_BASE_URL ||
      "http://127.0.0.1:8642",
  ),
  hermesApiKey:
    persisted.hermesApiKey ??
    process.env.HERMES_API_KEY ??
    "",
  hermesHome: path.resolve(process.env.HERMES_HOME || defaultHermesHome),
  hermesPython: process.env.HERMES_PYTHON || "",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  logDir: path.resolve(process.env.LOG_DIR ?? path.join(__dirname, "..", "logs")),
  logFileName: "communications.jsonl",
  settingsFilePath,
  portalPublicBaseUrl: normalizeBaseUrl(
    process.env.PORTAL_PUBLIC_BASE_URL || `http://127.0.0.1:${Number(process.env.PORT ?? 8787)}`,
  ),
  hermesWebhookSecret: (process.env.HERMES_WEBHOOK_SECRET || "").trim(),
};

export function getPublicSettings() {
  return {
    hermesApiBaseUrl: config.hermesApiBaseUrl,
    hermesApiKeyConfigured: Boolean(config.hermesApiKey),
    // Masked preview only — never return the full key
    hermesApiKeyPreview: config.hermesApiKey
      ? `${config.hermesApiKey.slice(0, 4)}…${config.hermesApiKey.slice(-4)}`
      : "",
  };
}

export function updateRuntimeSettings(input: {
  hermesApiBaseUrl?: string;
  hermesApiKey?: string;
}): RuntimeSettings {
  if (typeof input.hermesApiBaseUrl === "string") {
    const next = normalizeBaseUrl(input.hermesApiBaseUrl);
    if (!next) {
      throw new Error("hermesApiBaseUrl cannot be empty");
    }
    try {
      // Validates absolute URL
      new URL(next);
    } catch {
      throw new Error("hermesApiBaseUrl must be a valid URL");
    }
    config.hermesApiBaseUrl = next;
  }

  if (typeof input.hermesApiKey === "string") {
    config.hermesApiKey = input.hermesApiKey.trim();
  }

  persistRuntimeSettings();
  return {
    hermesApiBaseUrl: config.hermesApiBaseUrl,
    hermesApiKey: config.hermesApiKey,
  };
}

function persistRuntimeSettings(): void {
  const dir = path.dirname(settingsFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const payload: RuntimeSettings = {
    hermesApiBaseUrl: config.hermesApiBaseUrl,
    hermesApiKey: config.hermesApiKey,
  };
  fs.writeFileSync(settingsFilePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}
