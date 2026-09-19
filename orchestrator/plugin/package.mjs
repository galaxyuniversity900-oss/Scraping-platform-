import {readFile,writeFile,mkdir} from "node:fs/promises"; import {join} from "node:path";
const root=new URL("./",import.meta.url); const out=new URL("./dist/",root); await mkdir(out,{recursive:true});
const manifest=JSON.parse(await readFile(new URL("./manifest.json",root),"utf8"));
await writeFile(new URL("./dist/manifest.json",root),JSON.stringify(manifest,null,2));
await writeFile(new URL("./dist/README.txt",root),"Creazzy Universal AI Plugin v1. Copy the plugin directory as a portable package.\n");
console.log("plugin package prepared in plugin/dist");