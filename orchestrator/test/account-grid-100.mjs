import {ConnectionManager} from "../auth/connection-manager.mjs";
const cm=new ConnectionManager({masterKey:"test",maxAccounts:100,maxProviders:10,perProvider:10});
const providers=["deepseek","openai","anthropic","google","xai","nvidia","groq","mistral","openrouter","cohere"];
for(const p of providers) for(let i=0;i<10;i++) cm.add({provider:p,secret:"sk-"+p+"-"+i.toString().padStart(4,"0")});
const s=cm.stats();
if(s.total!==100||s.providers!==10)throw new Error("ACCOUNT_GRID_100_FAILED");
try{cm.add({provider:"deepseek",secret:"sk-extra-0000"});throw new Error("CAPACITY_NOT_ENFORCED")}catch(e){if(e.code!=="PROVIDER_ACCOUNT_CAPACITY_REACHED")throw e;}
console.log("account-grid-100: ok");