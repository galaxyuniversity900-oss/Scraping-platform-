import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises"; import {tmpdir} from "node:os"; import {join} from "node:path";
import {DurableStore} from "../storage/durable-store.mjs"; import {StateManager} from "../storage/state-manager.mjs";
const dir=await mkdtemp(join(tmpdir(),"creazzy-state-")); const file=join(dir,"state.json");
const s=new DurableStore(file); await s.set("a",{n:1}); assert.deepEqual(await s.get("a"),{n:1});
const m=new StateManager({file}); await m.update("a",v=>({n:v.n+1})); assert.deepEqual(await m.get("a"),{n:2});
await rm(dir,{recursive:true,force:true}); console.log("durable-state: ok");