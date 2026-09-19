export class AuthPolicy {
 constructor({tokens=new Map(),defaultScopes=[]}={}){this.tokens=tokens;this.defaultScopes=defaultScopes;}
 add(token,scopes=this.defaultScopes){this.tokens.set(token,{scopes:[...scopes]});}
 authenticate(token){const x=this.tokens.get(token);if(!x)throw Object.assign(new Error("UNAUTHORIZED"),{code:"UNAUTHORIZED"});return x;}
 authorize(token,scope){const x=this.authenticate(token);if(!x.scopes.includes("*")&&!x.scopes.includes(scope))throw Object.assign(new Error("FORBIDDEN"),{code:"FORBIDDEN"});return true;}
}