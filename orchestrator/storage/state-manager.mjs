import {DurableStore} from "./durable-store.mjs";
import {RedisState} from "./redis-state.mjs";
export class StateManager {
  constructor({file="./data/state.json",redisUrl,redisToken}={}){this.local=new DurableStore(file);this.remote=redisUrl?new RedisState({url:redisUrl,token:redisToken}):null;}
  async get(key){if(this.remote){const v=await this.remote.get(key);if(v!=null)return typeof v==="string"?JSON.parse(v):v;}return this.local.get(key);}
  async set(key,value){await this.local.set(key,value);if(this.remote)await this.remote.set(key,value);return value;}
  async update(key,fn){const current=await this.get(key);return this.set(key,await fn(current));}
}