// @ts-nocheck
import { createRuntime } from "../../../orchestrator/runtime.mjs";

export function getRuntime() {
  if (!globalThis.__creazzyRuntime) {
    const runtime = createRuntime({
      masterKey: process.env.APP_MASTER_KEY || "creazzy-preview-master-key",
      demo: true,
      routing: {
        preferredProviders: ["xai", "openai", "anthropic", "google", "mock"],
        maxAttempts: 4,
      },
    });
    runtime.logs = [];
    runtime.events.on("chat", (payload) => {
      runtime.logs.unshift({
        at: new Date().toISOString(),
        type: "chat",
        ...payload,
      });
      runtime.logs = runtime.logs.slice(0, 80);
    });
    globalThis.__creazzyRuntime = runtime;
  }
  return globalThis.__creazzyRuntime;
}
