export class AdaptiveScheduler {
  constructor({registry,policy,circuitBreaker}={}) {
    this.registry=registry; this.policy=policy; this.circuitBreaker=circuitBreaker;
  }

  plan(request={}) {
    const candidates=this.registry.models
      .filter(m=>m.enabled!==false)
      .filter(m=>!this.policy||this.policy.accepts(m,request))
      .filter(m=>(request.capabilities??[]).every(c=>(m.capabilities??[]).includes(c)))
      .filter(m=>!this.circuitBreaker||this.circuitBreaker.canTry(m.id))
      .map(m=>({model:m,score:this.policy?.score?.(m,request)??(m.priority??50)}))
      .sort((a,b)=>b.score-a.score);

    return {
      candidates:candidates.map(x=>x.model.id),
      maxAttempts:Math.min(request.maxAttempts??this.policy?.forTask?.(request.taskClass)?.maxAttempts??4,candidates.length),
      parallel:Math.max(1,Math.min(request.maxParallel??this.policy?.maxParallel??4,candidates.length))
    };
  }

  async run(request, invoke) {
    const plan=this.plan(request);
    if(!plan.candidates.length) throw Object.assign(new Error("NO_SCHEDULED_MODEL"),{code:"NO_SCHEDULED_MODEL"});
    const failures=[];
    for(const id of plan.candidates.slice(0,plan.maxAttempts)){
      const model=this.registry.models.find(x=>x.id===id);
      try { return await invoke(model,request); }
      catch(error) {
        failures.push({model:id,code:error.code||"MODEL_ERROR"});
        this.circuitBreaker?.failure(id);
      }
    }
    const e=new Error("SCHEDULE_EXHAUSTED"); e.code="SCHEDULE_EXHAUSTED"; e.failures=failures; throw e;
  }
}
