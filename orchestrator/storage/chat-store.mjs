export class ChatStore {
 constructor(){this.chats=new Map();}
 create({id,title="New chat",metadata={}}={}){id=id??crypto.randomUUID();const c={id,title,metadata,messages:[],createdAt:Date.now(),updatedAt:Date.now()};this.chats.set(id,c);return c;}
 append(id,message){const c=this.chats.get(id);if(!c)throw new Error("CHAT_NOT_FOUND");const m={...message,id:message.id??crypto.randomUUID(),createdAt:Date.now()};c.messages.push(m);c.updatedAt=Date.now();return m;}
 get(id){return this.chats.get(id)??null;}
 list(){return[...this.chats.values()].map(({messages,...c})=>({...c,messageCount:messages.length}));}
}