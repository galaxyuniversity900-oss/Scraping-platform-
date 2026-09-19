export class AssetPipeline {
 constructor({maxBytes=50*1024*1024}={}){this.maxBytes=maxBytes;}
 inspect(asset){if(!asset||!asset.name)throw new Error("INVALID_ASSET");if(Number(asset.size??0)>this.maxBytes)throw new Error("ASSET_TOO_LARGE");return{name:asset.name,mime:asset.mime??"application/octet-stream",size:Number(asset.size??0),kind:this.kind(asset.mime??"")};}
 kind(mime){if(mime.startsWith("image/"))return"image";if(mime.startsWith("video/"))return"video";if(mime.startsWith("audio/"))return"audio";if(mime==="application/pdf"||mime.startsWith("text/"))return"document";return"binary";}
 async transform(asset,operation){if(!operation)return asset;return{...asset,lastOperation:operation};}
}