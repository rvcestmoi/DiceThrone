import { dealDamage, hasSmallStraight } from "../engine.js";

const loki = {
  id:"loki",
  name:"Loki",
  hpMax:50,
  tokensDefault:{ illusion:0, sac:0, ensorcele:0 },

  face(n){
    if(n<=2) return "SCEPTRE";
    if(n<=4) return "ILLUSION";
    if(n===5) return "MENSONGE";
    return "FOURBERIE";
  },
  countFaces(nums){
    const c = {SCEPTRE:0, ILLUSION:0, MENSONGE:0, FOURBERIE:0};
    for(const n of nums) c[this.face(n)]++;
    return c;
  },

  getAbilities(ctx){
    const { nums, actor, defender, log } = ctx;
    const f = this.countFaces(nums);
    const abs = [];

    if(f.SCEPTRE >= 3){
      const dmg = f.SCEPTRE>=5 ? 8 : (f.SCEPTRE===4 ? 7 : 6);
      abs.push({
        name:"Raillerie",
        reqText:`SCEPTRE ≥ 3 (actuel ${f.SCEPTRE})`,
        score:dmg,
        run:()=>{ dealDamage(defender, dmg); log(`Raillerie → ${dmg} dégâts.`); }
      });
    }

    if(hasSmallStraight(nums)){
      abs.push({
        name:"Avarie",
        reqText:"Petite suite",
        score:7,
        run:()=>{
          actor.tokens.sac = Math.min(2, (actor.tokens.sac||0)+1);
          dealDamage(defender, 7);
          log("Avarie → 7 dégâts, +1 Sac (simplifié).");
        }
      });
    }

    return abs;
  }
};

export default loki;
