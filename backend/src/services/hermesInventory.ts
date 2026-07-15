import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { config } from "../config";

export interface HermesProviderModels {
  slug: string;
  name: string;
  authenticated: boolean;
  isCurrent: boolean;
  models: string[];
  totalModels: number;
}

export interface HermesInventoryResult {
  provider: string | null;
  model: string | null;
  providers: HermesProviderModels[];
}

export interface HermesModelOption {
  id: string;
  provider: string;
  providerName: string;
  model: string;
  isCurrent: boolean;
  label: string;
}

function resolveHermesHome(): string {
  return path.resolve(
    config.hermesHome ||
      process.env.HERMES_HOME ||
      path.join(process.env.LOCALAPPDATA || "", "hermes"),
  );
}

function resolveHermesPython(hermesHome: string): string {
  if (config.hermesPython && fs.existsSync(config.hermesPython)) {
    return config.hermesPython;
  }
  const candidates = [
    path.join(hermesHome, "hermes-agent", ".venv", "Scripts", "python.exe"),
    path.join(hermesHome, "hermes-agent", ".venv", "bin", "python"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(
    `Hermes Python not found under ${hermesHome}. Set HERMES_PYTHON in backend/.env`,
  );
}

function runPythonScript(
  scriptName: string,
  args: string[],
  timeoutMs = 120_000,
): Promise<{ code: number; stdout: string; stderr: string }> {
  const hermesHome = resolveHermesHome();
  const python = resolveHermesPython(hermesHome);
  const scriptPath = path.resolve(__dirname, "..", "..", "scripts", scriptName);

  if (!fs.existsSync(scriptPath)) {
    return Promise.reject(new Error(`Missing script: ${scriptPath}`));
  }

  return new Promise((resolve, reject) => {
    const child = spawn(python, [scriptPath, "--hermes-home", hermesHome, ...args], {
      windowsHide: true,
      env: {
        ...process.env,
        HERMES_HOME: hermesHome,
      },
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Hermes script timed out: ${scriptName}`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

export async function listHermesInventory(options?: {
  refresh?: boolean;
}): Promise<HermesInventoryResult> {
  const args = options?.refresh ? ["--refresh"] : [];
  const { code, stdout, stderr } = await runPythonScript(
    "list_hermes_models.py",
    args,
  );

  let parsed: {
    ok?: boolean;
    error?: string;
    provider?: string;
    model?: string;
    providers?: HermesProviderModels[];
  } = {};

  try {
    parsed = JSON.parse(stdout.trim() || "{}") as typeof parsed;
  } catch {
    throw new Error(
      `Invalid Hermes inventory JSON (exit ${code}): ${stdout || stderr || "empty"}`,
    );
  }

  if (!parsed.ok) {
    throw new Error(parsed.error || stderr || "Hermes inventory failed");
  }

  return {
    provider: parsed.provider ?? null,
    model: parsed.model ?? null,
    providers: Array.isArray(parsed.providers) ? parsed.providers : [],
  };
}

export function flattenInventoryToOptions(
  inventory: HermesInventoryResult,
): HermesModelOption[] {
  const options: HermesModelOption[] = [];

  for (const provider of inventory.providers) {
    if (!provider.authenticated && provider.models.length === 0) {
      continue;
    }
    for (const model of provider.models) {
      const isCurrent =
        Boolean(provider.isCurrent) &&
        inventory.model != null &&
        model === inventory.model;
      options.push({
        id: `${provider.slug}::${model}`,
        provider: provider.slug,
        providerName: provider.name,
        model,
        isCurrent,
        label: `${provider.name} / ${model}`,
      });
    }
  }

  return options;
}

export async function setHermesMainModel(provider: string, model: string): Promise<void> {
  const { code, stdout, stderr } = await runPythonScript("set_hermes_model.py", [
    "--provider",
    provider,
    "--model",
    model,
  ]);

  let parsed: { ok?: boolean; error?: string } = {};
  try {
    parsed = JSON.parse(stdout.trim() || "{}") as typeof parsed;
  } catch {
    throw new Error(
      `Invalid set-model response (exit ${code}): ${stdout || stderr || "empty"}`,
    );
  }

  if (!parsed.ok) {
    throw new Error(parsed.error || stderr || "Failed to set Hermes model");
  }
}

export function parseModelSelection(input?: string): {
  provider?: string;
  model: string;
} {
  const raw = (input ?? "").trim();
  if (!raw) {
    return { model: "hermes-agent" };
  }
  const sep = raw.indexOf("::");
  if (sep > 0) {
    return {
      provider: raw.slice(0, sep),
      model: raw.slice(sep + 2),
    };
  }
  return { model: raw };
}
