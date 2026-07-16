import { Router } from "express";
import { chatWithHermes, HermesApiError } from "../services/hermesClient";
import {
  appendCommunication,
  buildFailureRecord,
} from "../services/communicationLog";
import {
  parseModelSelection,
  setHermesMainModel,
} from "../services/hermesInventory";
import type { ChatRequestBody } from "../types";

export const chatRouter = Router();

chatRouter.post("/", async (req, res) => {
  const body = req.body as ChatRequestBody;
  const instruction = (body.instruction ?? "").trim();
  const selection = parseModelSelection(body.model);
  const provider = (body.provider ?? selection.provider ?? "").trim();
  const selectedModel = (selection.model || "hermes-agent").trim();

  if (!instruction) {
    res.status(400).json({ error: "instruction is required" });
    return;
  }

  const started = Date.now();
  const modelLabel = provider ? `${provider}::${selectedModel}` : selectedModel;

  try {
    // Apply the selected provider/model in Hermes config so the gateway
    // agent uses it (same idea as the Hermes dashboard model picker).
    if (provider && selectedModel && selectedModel !== "hermes-agent") {
      await setHermesMainModel(provider, selectedModel);
    }

    const result = await chatWithHermes(instruction, "hermes-agent");
    const responseTimeMs = Date.now() - started;

    let record;
    try {
      record = appendCommunication({
        action: "chat",
        instruction,
        model: modelLabel,
        response: result.content,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: result.totalTokens,
        responseTimeMs,
        success: true,
        hermesRaw: result.raw,
      });
    } catch (logError) {
      console.error("Failed to persist chat history:", logError);
      record = {
        id: "unlogged",
        timestamp: new Date().toISOString(),
        action: "chat" as const,
        model: modelLabel,
        response: result.content,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: result.totalTokens,
        responseTimeMs,
        success: true,
      };
    }

    res.json({
      id: record.id,
      timestamp: record.timestamp,
      action: record.action,
      model: record.model,
      response: record.response,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      totalTokens: record.totalTokens,
      responseTimeMs: record.responseTimeMs,
      success: true,
    });
  } catch (error) {
    const responseTimeMs = Date.now() - started;
    const message =
      error instanceof HermesApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unexpected chat error";

    let record;
    try {
      record = buildFailureRecord("chat", instruction, responseTimeMs, message, {
        model: modelLabel,
      });
    } catch (logError) {
      console.error("Failed to persist chat failure:", logError);
      record = {
        id: "unlogged",
        timestamp: new Date().toISOString(),
        action: "chat" as const,
        responseTimeMs,
      };
    }

    res.status(error instanceof HermesApiError ? error.status || 502 : 502).json({
      id: record.id,
      timestamp: record.timestamp,
      action: "chat",
      model: modelLabel,
      response: "",
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      responseTimeMs,
      success: false,
      error: message,
    });
  }
});
