declare module "../../../orchestrator/runtime.mjs" {
  export function createRuntime(config?: Record<string, unknown>): any;
}

declare module "../../../orchestrator/providers/connectors.mjs" {
  export function listConnectors(): Array<{
    id: string;
    baseUrl: string;
    adapter: string;
    authEnv: string | null;
  }>;
  export function getConnector(id: string): {
    id: string;
    baseUrl: string;
    adapter: string;
    authEnv: string | null;
  } | null;
}

declare module "../../../orchestrator/auth/deepseek-flow.mjs" {
  export function completeDeepSeekConnection(input: {
    connectionManager: any;
    apiKey: string;
    label?: string;
    accountId?: string;
  }): string;
}
