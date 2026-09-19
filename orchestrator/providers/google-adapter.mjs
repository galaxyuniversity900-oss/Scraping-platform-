export class GoogleAdapter {
  constructor({apiKey, baseUrl="https://generativelanguage.googleapis.com/v1beta", model="gemini-2.5-flash", timeoutMs=60000}={}) {
    if (!apiKey) throw Object.assign(new Error("GEMINI_API_KEY_REQUIRED"),{code:"CONFIGURATION_ERROR"});
    this.apiKey=apiKey; this.baseUrl=baseUrl.replace(/\/$/,""); this.model=model; this.timeoutMs=timeoutMs;
  }
  async invoke(request={}) {
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),this.timeoutMs);
    try {
      const contents=(request.messages||[]).filter(m=>m.role!=="system").map(m=>({role:m.role==="assistant"?"model":"user",parts:[{text:typeof m.content==="string"?m.content:JSON.stringify(m.content)}]}));
      const system=(request.messages||[]).find(m=>m.role==="system");
      const body={contents,generationConfig:{temperature:request.temperature,maxOutputTokens:request.max_tokens||request.maxTokens}};
      if(system) body.systemInstruction={parts:[{text:typeof system.content==="string"?system.content:JSON.stringify(system.content)}]};
      const url=this.baseUrl+"/models/"+encodeURIComponent(request.model||this.model)+":generateContent?key="+encodeURIComponent(this.apiKey);
      const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body),signal:controller.signal});
      const data=await r.json().catch(()=>({}));
      if(!r.ok) throw this.mapError(r.status,data);
      return data;
    } catch(e){if(e.name==="AbortError")throw Object.assign(new Error("REQUEST_TIMEOUT"),{code:"TIMEOUT"});throw e;}
    finally{clearTimeout(timer);}
  }
  mapError(status,body){const code=status===401||status===403?"AUTH_ERROR":status===429?"RATE_LIMIT":status>=500?"PROVIDER_DOWN":"MODEL_ERROR";return Object.assign(new Error(body?.error?.message||"Google request failed"),{code,status,provider:"google",details:body});}
}