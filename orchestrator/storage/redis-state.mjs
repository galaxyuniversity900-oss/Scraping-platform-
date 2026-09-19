export class RedisState {
  constructor({url,token}={}){this.url=url?.replace(/\/$/,"");this.token=token||process.env.REDIS_TOKEN;if(!this.url)throw Object.assign(new Error("REDIS_URL_REQUIRED"),{code:"CONFIGURATION_ERROR"});}
  async command(command){const headers={"content-type":"application/json"};if(this.token)headers.authorization="Bearer "+this.token;const r=await fetch(this.url,{method:"POST",headers,body:JSON.stringify({command})});if(!r.ok)throw Object.assign(new Error("REDIS_REQUEST_FAILED"),{code:"PROVIDER_DOWN",status:r.status});return r.json();}
  async get(key){return (await this.command(["GET",key])).result;}
  async set(key,value){await this.command(["SET",key,JSON.stringify(value)]);return value;}
}