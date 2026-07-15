import { Router } from "express";
import { checkHermesHealth } from "../services/hermesClient";
import { getPublicSettings, updateRuntimeSettings } from "../config";

export const settingsRouter = Router();

settingsRouter.get("/", async (_req, res) => {
  const hermes = await checkHermesHealth();
  res.json({
    ...getPublicSettings(),
    hermesReachable: hermes.ok,
    hermesHealth: hermes,
  });
});

settingsRouter.put("/", async (req, res) => {
  const body = req.body as {
    hermesApiBaseUrl?: string;
    hermesApiKey?: string;
  };

  try {
    updateRuntimeSettings({
      hermesApiBaseUrl: body.hermesApiBaseUrl,
      hermesApiKey: body.hermesApiKey,
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Invalid settings",
    });
    return;
  }

  const hermes = await checkHermesHealth();
  res.json({
    ...getPublicSettings(),
    hermesReachable: hermes.ok,
    hermesHealth: hermes,
    message: hermes.ok
      ? "Settings saved. Hermes is reachable."
      : "Settings saved, but Hermes is not reachable at that URL.",
  });
});
