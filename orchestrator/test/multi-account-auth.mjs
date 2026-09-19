import {ConnectionManager} from "../auth/connection-manager.mjs";
import {completeDeepSeekConnection} from "../auth/deepseek-flow.mjs";
const cm=new ConnectionManager({masterKey:"test-master-key"});
for(let i=0;i<10;i++)completeDeepSeekConnection({connectionManager:cm,apiKey:"sk-test_"+String(i).padStart(10,"0"),accountId:"account-"+i});
if(cm.list("deepseek").length!==10)throw new Error("TEN_ACCOUNT_TEST_FAILED");
const id=cm.list("deepseek")[0].id;if(cm.secret(id)!=="sk-test_0000000000")throw new Error("ENCRYPTION_TEST_FAILED");
console.log("multi-account-auth: ok");