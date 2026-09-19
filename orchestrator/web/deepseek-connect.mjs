export function connectDeepSeek({apiBase="/api"}={}) {
  window.location.assign(apiBase+"/connections/deepseek/start");
}
export async function submitDeepSeekKey({apiBase="/api",apiKey,label="",accountId=""}) {
  const r=await fetch(apiBase+"/connections/deepseek/complete",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({apiKey,label,accountId})});
  const body=await r.json();
  if(!r.ok) throw new Error(body?.error?.message||"DEEPSEEK_CONNECTION_FAILED");
  return body;
}
