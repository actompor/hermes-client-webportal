import { Router } from "express";
import { listHermesModels } from "../services/hermesClient";
import {
  flattenInventoryToOptions,
  listHermesInventory,
} from "../services/hermesInventory";

export const modelsRouter = Router();

const DEFAULT_MODEL = {
  id: "hermes-agent",
  ownedBy: "hermes",
  root: "hermes-agent",
  parent: null as string | null,
  provider: "hermes",
  providerName: "Hermes",
  model: "hermes-agent",
  label: "hermes-agent (default)",
  isCurrent: true,
};

modelsRouter.get("/", async (req, res) => {
  const refresh = String(req.query.refresh ?? "") === "1";

  // Prefer local Hermes inventory when HERMES_HOME/Python is available (dev machine).
  try {
    const inventory = await listHermesInventory({ refresh });
    const options = flattenInventoryToOptions(inventory);

    res.json({
      source: "hermes-inventory",
      currentProvider: inventory.provider,
      currentModel: inventory.model,
      count: options.length,
      providers: inventory.providers,
      models: options.map((option) => ({
        id: option.id,
        ownedBy: option.provider,
        root: option.model,
        parent: option.provider,
        provider: option.provider,
        providerName: option.providerName,
        model: option.model,
        label: option.label,
        isCurrent: option.isCurrent,
      })),
    });
    return;
  } catch (inventoryError) {
    const inventoryMessage =
      inventoryError instanceof Error
        ? inventoryError.message
        : "Local Hermes inventory unavailable";

    // Azure / remote Hermes: use the public OpenAI-compatible /v1/models API.
    try {
      const remote = await listHermesModels();
      const models =
        remote.length > 0
          ? remote.map((item, index) => ({
              id: item.id,
              ownedBy: item.ownedBy,
              root: item.root,
              parent: item.parent,
              provider: item.ownedBy || "hermes",
              providerName: item.ownedBy || "Hermes",
              model: item.id,
              label: item.id,
              isCurrent: index === 0,
            }))
          : [DEFAULT_MODEL];

      res.json({
        source: "hermes-api",
        warning: inventoryMessage,
        count: models.length,
        providers: [],
        models,
      });
      return;
    } catch (remoteError) {
      const remoteMessage =
        remoteError instanceof Error
          ? remoteError.message
          : "Failed to list Hermes models";

      res.status(200).json({
        error: `${inventoryMessage}; remote fallback also failed: ${remoteMessage}`,
        source: "fallback",
        count: 1,
        providers: [],
        models: [DEFAULT_MODEL],
      });
    }
  }
});
