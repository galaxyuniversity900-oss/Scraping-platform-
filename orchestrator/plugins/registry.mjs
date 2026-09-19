import {normalizePlugin} from "./manifest.mjs";
export class PluginRegistry {
  constructor(){this.plugins=new Map();}
  install(manifest){const p=normalizePlugin(manifest);this.plugins.set(p.id,p);return p;}
  enable(id){const p=this.plugins.get(id);if(!p)throw new Error("PLUGIN_NOT_FOUND");p.enabled=true;}
  disable(id){const p=this.plugins.get(id);if(p)p.enabled=false;}
  list(){return [...this.plugins.values()];}
  available(capability){return this.list().filter(p=>p.enabled&&(p.capabilities??[]).includes(capability));}
}