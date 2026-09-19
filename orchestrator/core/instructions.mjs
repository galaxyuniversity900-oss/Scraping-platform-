const ORDER = ["global", "provider", "model", "skill", "plugin", "task", "conversation", "user"];

export class InstructionStack {
  constructor(layers = {}) {
    this.layers = { ...layers };
  }

  set(layer, text) {
    if (!ORDER.includes(layer)) throw new Error("UNKNOWN_INSTRUCTION_LAYER");
    this.layers[layer] = text;
  }

  compose(request = {}) {
    const parts = [];
    for (const layer of ORDER) {
      const value = request[layer] ?? request.instructions?.[layer] ?? this.layers[layer];
      if (value) parts.push(`# ${layer}\n${value}`);
    }
    if (request.system && !parts.some((part) => part.startsWith("# user") || part.includes(request.system))) {
      parts.unshift(`# system\n${request.system}`);
    }
    return parts.join("\n\n");
  }
}
