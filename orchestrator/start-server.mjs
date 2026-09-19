import { createRuntime } from "./runtime.mjs";
import { startServer } from "./api/openai-compatible-server.mjs";

const port = Number(process.env.PORT || 8787);
const runtime = createRuntime({
  masterKey: process.env.APP_MASTER_KEY || "creazzy-dev-master-key",
  demo: true,
  routing: {
    preferredProviders: ["xai", "openai", "anthropic", "google", "mock"],
    maxAttempts: 4
  }
});

const server = startServer({ runtime, port });
server.on("listening", () => {
  console.log(`Creazzy Universal AI listening on http://127.0.0.1:${port}`);
});
