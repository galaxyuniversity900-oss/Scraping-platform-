import {mkdir,readFile,rename,writeFile} from "node:fs/promises";
import {dirname} from "node:path";
export class DurableStore {
  constructor(file){this.file=file;this.queue=Promise.resolve();}
  async init(){await mkdir(dirname(this.file),{recursive:true});try{await readFile(this.file,"utf8");}catch(e){if(e.code==="ENOENT")await writeFile(this.file,"{}","utf8");else throw e;}}
  async read(){await this.init();return JSON.parse(await readFile(this.file,"utf8"));}
  async write(value){this.queue=this.queue.then(async()=>{await this.init();const tmp=this.file+".tmp";await writeFile(tmp,JSON.stringify(value,null,2),"utf8");await rename(tmp,this.file);});return this.queue;}
  async update(fn){const current=await this.read();const next=await fn(structuredClone(current));await this.write(next);return next;}
  async get(key){return (await this.read())[key];}
  async set(key,value){return this.update(s=>{s[key]=value;return s;});}
}