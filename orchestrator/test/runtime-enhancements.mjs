import assert from "node:assert/strict";
import {createRuntime} from "../runtime.mjs";

const r=createRuntime({masterKey:"runtime-test-master",routing:{preferredProviders:["nvidia","openai"]}});
r.registry.register({id:"nvidia-code",provider:"nvidia",capabilities:["chat","code"],priority:80});
r.registry.register({id:"openai-code",provider:"openai",capabilities:["chat","code"],priority:60});

const plan=r.scheduler.plan({taskClass:"code",capabilities:["code"]});
assert.deepEqual(plan.candidates,["nvidia-code","openai-code"]);
assert.equal(plan.maxAttempts,2);

const k1=r.contextCache.set({system:"x",messages:[{role:"user",content:"hello"}]},{tokens:12});
assert.deepEqual(r.contextCache.get({messages:[{content:"hello",role:"user"}],system:"x"}),{tokens:12});
assert.equal(typeof k1,"string");

r.circuitBreaker.failure("nvidia-code");
r.circuitBreaker.failure("nvidia-code");
r.circuitBreaker.failure("nvidia-code");
assert.equal(r.scheduler.plan({capabilities:["code"]}).candidates.includes("nvidia-code"),false);

console.log("RUNTIME ENHANCEMENTS TEST: PASS");
