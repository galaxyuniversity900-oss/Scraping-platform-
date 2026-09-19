export class MCPGateway {
  constructor() { this.servers = new Map(); }

  register(manifest) {
    if (!manifest?.name) throw new Error("INVALID_MCP_MANIFEST");
    this.servers.set(manifest.name, {
      enabled:true, health:"unknown", permissions:[], ...manifest
    });
  }

  list(capability) {
    return [...this.servers.values()].filter(s =>
      s.enabled && (!capability || (s.capabilities ?? []).includes(capability))
    );
  }

  authorize(serverName, action) {
    const s = this.servers.get(serverName);
    return !!s && s.enabled && (!s.permissions?.length || s.permissions.includes(action));
  }
}
