import {ProviderAdapter} from "./provider-adapter.mjs";
export class OpenAICompatibleAdapter extends ProviderAdapter {
  constructor(definition){super(definition);}
  async health(){
    const r=await fetch(this.definition.baseUrl.replace(/\/$/,"")+"/models",{headers:this.headers()});
    if(!r.ok){const e=new Error("PROVIDER_HEALTH_"+r.status);e.code=r.status===401?"AUTH_ERROR":"PROVIDER_DOWN";throw e;}
    return {state:"healthy"};
  }
  headers(){return this.definition.apiKey?{"Authorization":"Bearer "+this.definition.apiKey}:{};}
  async invoke(request){
    const r=await fetch(this.definition.baseUrl.replace(/\/$/,"")+"/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",...this.headers()},body:JSON.stringify({...request,model:request.model??this.definition.model})});
    if(!r.ok){const body=await r.text();const e=new Error(body||("HTTP "+r.status));e.code=r.status===401?"AUTH_ERROR":r.status===429?"RATE_LIMIT":r.status>=500?"PROVIDER_DOWN":"INVALID_REQUEST";throw e;}
    return r.json();
  }
}