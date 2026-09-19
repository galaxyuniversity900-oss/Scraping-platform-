import {createRuntime} from "../runtime.mjs";
import {createNativeAdapter} from "../providers/native-adapters.mjs";
import {OpenAICompatibleAdapter} from "../providers/openai-compatible.mjs";
import {getConnector,listConnectors} from "../providers/connectors.mjs";
export function createUniversalPlugin(config={}) {
  const runtime=createRuntime(config);
  return {
    runtime,
    connectors:listConnectors,
    connector:getConnector,
    bindModel({id,provider,apiKey,model,baseUrl,capabilities=[]}={}) {
      const connector=getConnector(provider);
      if(!connector) throw Object.assign(new Error("UNKNOWN_CONNECTOR"),{code:"INVALID_REQUEST"});
      const adapter=provider==="anthropic"||provider==="google"
        ? createNativeAdapter({provider,apiKey,model,baseUrl})
        : new OpenAICompatibleAdapter({apiKey,baseUrl:baseUrl||connector.baseUrl,model});
      return runtime.registry.register({id:id||provider+"-"+(model||"default"),provider,model,capabilities,adapter});
    },
    async chat(request){return runtime.router.execute(request,async(model)=>model.adapter.invoke(request));},
    manifest:pluginManifest()
  };
}
export function pluginManifest(){return {name:"creazzy-universal-ai-plugin",version:"1.0.0",protocol:"universal-agent-plugin-v1"};}
