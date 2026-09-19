import { adapterError } from "../providers/adapter-contract.mjs";

export class AccountPool {
  constructor({ connections, credentials, health, quota } = {}) {
    this.connections = connections ?? null;
    this.credentials = credentials ?? null;
    this.health = health ?? null;
    this.quota = quota ?? null;
  }

  candidates(provider) {
    const fromConnections = this.connections
      ? this.connections
          .list(provider)
          .filter((item) => item.status === "available" && (item.until ?? 0) <= Date.now())
          .map((item) => ({
            id: item.id,
            provider: item.provider,
            source: "connection",
            label: item.label,
            status: item.status
          }))
      : [];

    const fromPool = this.credentials
      ? this.credentials.inspect(provider).map((item) => ({
          id: item.id,
          provider,
          source: "credential-pool",
          label: item.label,
          status: item.status
        }))
      : [];

    const merged = [];
    const seen = new Set();
    for (const item of [...fromConnections, ...fromPool]) {
      if (seen.has(item.id)) continue;
      if (item.status && item.status !== "available") continue;
      const quota = this.quota?.get(item.id);
      if (quota?.exhausted) continue;
      const health = this.health?.snapshot(item.id, "account");
      if (["down", "auth_error", "quota_exhausted"].includes(health?.state)) continue;
      seen.add(item.id);
      merged.push({ ...item, health: health?.state ?? "unknown", score: health?.score ?? 50 });
    }
    return merged.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }

  lease(provider) {
    if (this.connections) {
      try {
        const lease = this.connections.lease(provider);
        return { ...lease, source: "connection", provider };
      } catch (error) {
        if (error.code !== "NO_CREDENTIAL" && error.code !== "NO_AVAILABLE_CONNECTION") throw error;
      }
    }
    if (this.credentials) {
      const lease = this.credentials.lease(provider);
      return { ...lease, source: "credential-pool", provider };
    }
    throw adapterError("NO_AVAILABLE_CONNECTION", "NO_CREDENTIAL", { provider });
  }
}
