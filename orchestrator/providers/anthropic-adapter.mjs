export class AnthropicAdapter {
  constructor({apiKey, baseUrl="https://api.anthropic.com", model="claude-sonnet-4-5", timeoutMs=60000}={}) {
    if (!apiKey) throw Object.assign(new Error("ANTHROPIC_API_KEY_REQUIRED"),{code:"CONFIGURATION_ERROR"});
    this.apiKey=apiKey; this.baseUrl=baseUrl.replace(/\/$/,""); this.model=model; this.timeoutMs=timeoutMs;
  }
  async invoke(request={}) {
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),this.timeoutMs);
    try {
      const messages=(request.messages||[]).filter(m=>m.role!=="system").map(m=>({role:m.role==="assistant"?"assistant":"user",content:typeof m.content==="string"?m.content:m.content}));
      const system=(request.messages||[]).filter(m=>m.role==="system").map(m=>typeof m.content==="string"?m.content:"").join("\n");
      const r=await fetch(this.baseUrl+"/v1/messages",{method:"POST",headers:{"content-type":"application/json","x-api-key":this.apiKey,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:request.model||this.model,max_tokens:request.max_tokens||request.maxTokens||4096,system,messages}),signal:controller.signal});
      const body=await r.json().catch(()=>({}));
      if(!r.ok) throw this.mapError(r.status,body);
      return body;
    } catch(e) { if(e.name==="AbortError") throw Object.assign(new Error("REQUEST_TIMEOUT"),{code:"TIMEOUT"}); throw e; }
    finally { clearTimeout(timer); }
  }
  mapError(status,body){const code=status===401||status===403?"AUTH_ERROR":status===429?"RATE_LIMIT":status>=500?"PROVIDER_DOWN":"MODEL_ERROR";return Object.assign(new Error(body?.error?.message||body?.message||"Anthropic request failed"),{code,status,provider:"anthropic",details:body});}
}