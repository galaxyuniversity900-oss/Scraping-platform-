import { AssetPipeline } from "./asset-pipeline.mjs";

const CAPABILITY_BY_KIND = {
  image: ["vision", "image"],
  video: ["video"],
  audio: ["audio"],
  document: ["files"],
  binary: ["files"]
};

export class FileRouter {
  constructor({ pipeline } = {}) {
    this.pipeline = pipeline ?? new AssetPipeline();
  }

  inspect(file) {
    return this.pipeline.inspect(file);
  }

  requiredCapabilities(files = []) {
    const caps = new Set();
    for (const file of files) {
      const inspected = this.pipeline.inspect(file);
      for (const cap of CAPABILITY_BY_KIND[inspected.kind] ?? ["files"]) caps.add(cap);
    }
    return [...caps];
  }

  async prepare(files = []) {
    const prepared = [];
    for (const file of files) {
      const inspected = this.pipeline.inspect(file);
      prepared.push({
        ...inspected,
        extracted: await this.extract(file, inspected),
        capabilities: CAPABILITY_BY_KIND[inspected.kind] ?? ["files"]
      });
    }
    return prepared;
  }

  async extract(file, inspected) {
    const kind = inspected?.kind ?? this.pipeline.inspect(file).kind;
    if (kind === "document" && typeof file.text === "string") {
      return { type: "text", text: file.text };
    }
    if (kind === "document" && typeof file.content === "string") {
      return { type: "text", text: file.content };
    }
    if (kind === "image") {
      return { type: "image", name: file.name, mime: inspected.mime };
    }
    return { type: kind, name: file.name, note: "passthrough" };
  }
}
