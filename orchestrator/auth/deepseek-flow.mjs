// DeepSeek does not expose a standard OAuth authorization flow for API keys.
// Therefore this flow never automates a DeepSeek login or extracts browser cookies/tokens.
// The supported secure flow is: app login -> DeepSeek API-key instructions -> user enters key -> server encrypts it.
export function beginDeepSeekConnection({returnTo="/settings/connections"}={}){return {provider:"deepseek",authType:"api_key",returnTo,requiresUserSuppliedKey:true,instructionsUrl:"https://platform.deepseek.com/api_keys"};}
export function completeDeepSeekConnection({connectionManager,apiKey,label="",accountId=""}){if(!/^sk-[A-Za-z0-9_-]{10,}$/.test(apiKey))throw Object.assign(new Error("INVALID_DEEPSEEK_API_KEY"),{code:"INVALID_CREDENTIAL"});return connectionManager.add({provider:"deepseek",secret:apiKey,label,accountId});}
