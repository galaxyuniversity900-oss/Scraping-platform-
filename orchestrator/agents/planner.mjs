export class Planner {
  constructor(router){this.router=router;}
  plan(request){const task=request.taskClass??"default";const capabilities=request.capabilities??["chat"];return{task,capabilities,steps:[{id:"execute",role:"executor",capabilities},{id:"review",role:"reviewer",dependsOn:["execute"],capabilities}],maxAttempts:this.router?.policy?.forTask?.(task)?.maxAttempts??4};}
}