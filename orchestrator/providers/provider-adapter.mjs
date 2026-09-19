export class ProviderAdapter {
  constructor(definition){ this.definition=definition; }
  get id(){ return this.definition.id; }
  get provider(){ return this.definition.provider; }
  get capabilities(){ return this.definition.capabilities ?? []; }
  async health(){ return {state:"unknown"}; }
  async invoke(){ throw new Error("ADAPTER_NOT_IMPLEMENTED"); }
}