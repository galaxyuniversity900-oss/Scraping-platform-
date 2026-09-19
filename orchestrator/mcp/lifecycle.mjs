export class MCPLifecycle {
  constructor(gateway){this.gateway=gateway;this.connections=new Map();}
  register(server){this.gateway.register(server);this.connections.set(server.name,{state:"registered",lastError:null});}
  markHealthy(name){const s=this.connections.get(name);if(s)this.connections.set(name,{...s,state:"healthy",lastError:null,lastChecked:Date.now()});}
  markFailed(name,error){const s=this.connections.get(name)??{};this.connections.set(name,{...s,state:"failed",lastError:String(error?.message??error),lastChecked:Date.now()});}
  status(){return Object.fromEntries(this.connections);}
}