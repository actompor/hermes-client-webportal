import express from "express";
import cors from "cors";
import { config } from "./config";
import { checkHermesHealth } from "./services/hermesClient";
import { chatRouter } from "./routes/chat";
import { scheduleRouter } from "./routes/schedule";
import { historyRouter } from "./routes/history";
import { modelsRouter } from "./routes/models";
import { settingsRouter } from "./routes/settings";
import { webhooksRouter } from "./routes/webhooks";

const app = express();

app.use(
  cors({
    origin: config.corsOrigin,
  }),
);

// Webhooks need the raw body for HMAC verification — mount before json parser.
app.use("/api/webhooks", webhooksRouter);

app.use(express.json({ limit: "2mb" }));

app.get("/api/health", async (_req, res) => {
  const hermes = await checkHermesHealth();
  res.json({
    status: "ok",
    service: "ecept-hermes-web-client-api",
    hermesConfigured: Boolean(config.hermesApiKey),
    hermesBaseUrl: config.hermesApiBaseUrl,
    portalPublicBaseUrl: config.portalPublicBaseUrl,
    webhookConfigured: Boolean(config.hermesWebhookSecret),
    hermes: hermes,
  });
});

app.use("/api/chat", chatRouter);
app.use("/api/schedule", scheduleRouter);
app.use("/api/history", historyRouter);
app.use("/api/models", modelsRouter);
app.use("/api/settings", settingsRouter);

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err);
    res.status(500).json({ error: err.message || "Internal server error" });
  },
);

app.listen(config.port, () => {
  console.log(`ecept Hermes Web Client API listening on http://localhost:${config.port}`);
  console.log(`Proxying Hermes at ${config.hermesApiBaseUrl}`);
  if (!config.hermesApiKey) {
    console.warn("Warning: HERMES_API_KEY is empty. Set it in backend/.env");
  }
});
