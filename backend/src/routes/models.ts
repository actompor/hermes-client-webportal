import { Router } from "express";
import {
  flattenInventoryToOptions,
  listHermesInventory,
} from "../services/hermesInventory";

export const modelsRouter = Router();

modelsRouter.get("/", async (req, res) => {
  const refresh = String(req.query.refresh ?? "") === "1";

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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list Hermes models";
    res.status(502).json({
      error: message,
      source: "hermes-inventory",
      models: [],
      providers: [],
      count: 0,
    });
  }
});
