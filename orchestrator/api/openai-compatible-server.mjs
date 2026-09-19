import { createServer } from "node:http";
import { completeDeepSeekConnection, beginDeepSeekConnection } from "../auth/deepseek-flow.mjs";
import { serveUI } from "../web/ui-handler.mjs";
import { listConnectors, getConnector } from "../providers/connectors.mjs";

export function startServer({ runtime, port = 8787 }) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      if (url.pathname.startsWith("/ui")) {
        if (await serveUI(req, res)) return;
      }
      if (url.pathname === "/healthz") return json(res, 200, { status: "ok" });
      if (url.pathname === "/v1/models") {
        return json(res, 200, {
          object: "list",
          data: runtime.registry.models.map((model) => ({
            id: model.id,
            object: "model",
            owned_by: model.provider,
            capabilities: model.capabilities ?? [],
            health: model.health ?? null
          }))
        });
      }
      if (url.pathname === "/v1/health") return json(res, 200, runtime.health.summarize());
      if (url.pathname === "/v1/quota") return json(res, 200, { accounts: runtime.quota.list() });
      if (url.pathname === "/v1/mcp/tools") return json(res, 200, { tools: runtime.mcpAggregator.discover() });
      if (url.pathname === "/v1/skills") return json(res, 200, { skills: [...runtime.skills.skills.values()] });
      if (url.pathname === "/v1/plugins") return json(res, 200, { plugins: runtime.plugins.list() });
      if (url.pathname === "/v1/connectors") return json(res, 200, { connectors: listConnectors() });
      if (url.pathname === "/connections/deepseek/start") {
        return json(res, 200, beginDeepSeekConnection({ returnTo: "/settings/connections" }));
      }
      if (url.pathname === "/connections/deepseek/complete" && req.method === "POST") {
        const payload = JSON.parse((await readBody(req)) || "{}");
        if (!runtime.connections) {
          throw Object.assign(new Error("APP_MASTER_KEY_REQUIRED"), { code: "CONFIGURATION_ERROR" });
        }
        const id = completeDeepSeekConnection({
          connectionManager: runtime.connections,
          apiKey: payload.apiKey,
          label: payload.label,
          accountId: payload.accountId
        });
        return json(res, 201, { provider: "deepseek", connectionId: id });
      }
      if (url.pathname === "/connections" && req.method === "GET") {
        if (!runtime.connections) return json(res, 200, { connections: [] });
        return json(res, 200, { connections: runtime.connections.list() });
      }
      if (url.pathname === "/connections" && req.method === "POST") {
        if (!runtime.connections) {
          throw Object.assign(new Error("APP_MASTER_KEY_REQUIRED"), { code: "CONFIGURATION_ERROR" });
        }
        const payload = JSON.parse((await readBody(req)) || "{}");
        const connector = payload.provider ? getConnector(payload.provider) : null;
        const id = runtime.connections.add({
          provider: payload.provider,
          secret: payload.apiKey || payload.secret,
          label: payload.label ?? "",
          accountId: payload.accountId ?? ""
        });
        if (connector && !runtime.registry.models.some((model) => model.provider === payload.provider)) {
          runtime.registry.register({
            id: `${payload.provider}-default`,
            provider: payload.provider,
            remoteId: payload.model ?? undefined,
            family: connector.adapter === "openai-compatible" ? "openai-compatible" : payload.provider,
            baseUrl: connector.baseUrl,
            capabilities: payload.capabilities ?? ["chat", "code"],
            priority: 70
          });
        }
        return json(res, 201, { connectionId: id, provider: payload.provider });
      }
      if (url.pathname === "/v1/mcp/execute" && req.method === "POST") {
        const payload = JSON.parse((await readBody(req)) || "{}");
        const result = await runtime.mcpExecutor.execute(payload.name, payload.arguments ?? {});
        return json(res, 200, result);
      }
      if (url.pathname === "/v1/chat/completions" && req.method === "POST") {
        const payload = JSON.parse((await readBody(req)) || "{}");
        if (runtime.execution) {
          const result = await runtime.execution.completeOpenAI(payload);
          return json(res, 200, result);
        }
        const result = await runtime.router.execute(payload, async (model) => {
          if (model.adapter?.chat) return model.adapter.chat(payload);
          if (model.adapter?.invoke) return model.adapter.invoke(payload);
          throw Object.assign(new Error("ADAPTER_NOT_BOUND"), { code: "ADAPTER_NOT_BOUND" });
        });
        return json(res, 200, result.result);
      }
      return json(res, 404, { error: { message: "Not found" } });
    } catch (error) {
      json(
        res,
        error.code === "RATE_LIMIT"
          ? 429
          : error.code === "UNAUTHORIZED"
            ? 401
            : error.code === "INVALID_CREDENTIAL"
              ? 400
              : error.code === "NO_CAPABLE_PROVIDER"
                ? 400
                : 500,
        { error: { message: String(error.message || error), code: error.code || "ERROR" } }
      );
    }
  }).listen(port);
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = "";
    req.on("data", (chunk) => {
      s += chunk;
      if (s.length > 10 * 1024 * 1024) reject(new Error("BODY_TOO_LARGE"));
    });
    req.on("end", () => resolve(s));
    req.on("error", reject);
  });
}
