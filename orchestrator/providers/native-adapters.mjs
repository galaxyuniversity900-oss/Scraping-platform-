import {AnthropicAdapter} from "./anthropic-adapter.mjs";
import {GoogleAdapter} from "./google-adapter.mjs";
export function createNativeAdapter({provider,apiKey,model,baseUrl,timeoutMs}={}) {
  if(provider==="anthropic") return new AnthropicAdapter({apiKey,model,baseUrl,timeoutMs});
  if(provider==="google") return new GoogleAdapter({apiKey,model,baseUrl,timeoutMs});
  throw Object.assign(new Error("UNSUPPORTED_NATIVE_PROVIDER"),{code:"UNSUPPORTED_CAPABILITY"});
}