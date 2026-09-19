import { adapterError } from "../providers/adapter-contract.mjs";

export class MCPExecutor {
  constructor({ aggregator, gateway, lifecycle } = {}) {
    this.aggregator = aggregator;
    this.gateway = gateway;
    this.lifecycle = lifecycle;
    this.handlers = new Map();
  }

  registerHandler(name, handler) {
    if (!name || typeof handler !== "function") throw adapterError("INVALID_MCP_HANDLER", "INVALID_REQUEST");
    this.handlers.set(name, handler);
  }

  async execute(name, args = {}) {
    const tools = this.aggregator.resolve([name]);
    if (!tools.length) throw adapterError(`Unknown MCP tool: ${name}`, "MCP_TOOL_NOT_FOUND", { name });
    const tool = tools[0];
    if (this.gateway && !this.gateway.authorize(tool.server, "execute") && !this.gateway.authorize(tool.server, "read")) {
      throw adapterError(`MCP server ${tool.server} is not authorized`, "MCP_UNAUTHORIZED", { server: tool.server });
    }
    const handler = this.handlers.get(tool.name) || this.handlers.get(name) || tool.handler;
    if (typeof handler !== "function") {
      throw adapterError(`No handler for ${tool.name}`, "MCP_NO_HANDLER", { name: tool.name, server: tool.server });
    }
    try {
      const result = await handler(args, tool);
      this.lifecycle?.markHealthy?.(tool.server);
      return {
        name: tool.name,
        server: tool.server,
        ok: true,
        result
      };
    } catch (error) {
      this.lifecycle?.markFailed?.(tool.server, error);
      throw adapterError(String(error.message || error), error.code ?? "MCP_EXECUTION_ERROR", {
        name: tool.name,
        server: tool.server
      });
    }
  }

  async executeMany(calls = []) {
    const out = [];
    for (const call of calls) {
      out.push(await this.execute(call.name, call.arguments ?? call.args ?? {}));
    }
    return out;
  }
}
