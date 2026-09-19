export class CircuitBreaker {
  constructor({failureThreshold=3,cooldownMs=30000}={}) { this.failureThreshold=failureThreshold; this.cooldownMs=cooldownMs; this.states=new Map(); }
  state(id) {
    const s=this.states.get(id) ?? {failures:0,openedAt:0};
    if (s.openedAt && Date.now()-s.openedAt >= this.cooldownMs) return {...s,openedAt:0,halfOpen:true};
    return s;
  }
  canTry(id) { const s=this.state(id); return !s.openedAt || s.halfOpen===true; }
  success(id) { this.states.delete(id); }
  failure(id) {
    const s=this.state(id), failures=s.failures+1;
    this.states.set(id, failures>=this.failureThreshold ? {failures,openedAt:Date.now()} : {failures,openedAt:s.openedAt});
  }
}
