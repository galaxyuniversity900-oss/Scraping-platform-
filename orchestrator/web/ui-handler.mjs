import {readFile} from "node:fs/promises"; import {extname,join} from "node:path";
const root=new URL("./ui/",import.meta.url);
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8"};
export async function serveUI(req,res){const path=req.url==="/ui"||req.url==="/ui/"?"index.html":req.url.replace(/^\/ui\//,"");if(path.includes(".."))return false;try{const body=await readFile(new URL(path,root));res.writeHead(200,{"content-type":types[extname(path)]||"text/plain; charset=utf-8","cache-control":"no-store"});res.end(body);return true;}catch{return false;}}
