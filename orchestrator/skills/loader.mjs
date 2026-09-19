export class SkillLoader {
  constructor(){this.skills=new Map();}
  register(skill){if(!skill?.id||!skill.instructions)throw new Error("INVALID_SKILL");this.skills.set(skill.id,{enabled:true,...skill});return skill.id;}
  compose(ids=[]){return ids.map(id=>this.skills.get(id)).filter(Boolean).filter(s=>s.enabled).map(s=>"# "+s.name+"\n"+s.instructions).join("\n\n");}
}