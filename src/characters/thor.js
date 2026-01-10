import { dealDamage, heal, hasLargeStraight } from "../engine.js";

const thor = {
  id: "thor",
  name: "Thor",
  hpMax: 50,
  tokensDefault: { brise:0, electro:0, mjollnir:"self" },

  face(n){
    if(n<=3) return "MARTEAU";
    if(n<=5) return "GRANDEUR";
    return "FOUDRE";
  },
  countFaces(nums){
    const c = {MARTEAU:0, GRANDEUR:0, FOUDRE:0};
    for(const n of nums) c[this.face(n)]++;
    return c;
  },

  getAbilities(ctx){
    const { nums, actor, defender, log } = ctx;
    const f = this.countFaces(nums);
    const abs = [];

    if(f.MARTEAU >= 3){
      const dmg = f.MARTEAU>=5 ? 8 : (f.MARTEAU===4 ? 6 : 5);
      abs.push({
        name:"Martèlement III",
        reqText:`MARTEAU ≥ 3 (actuel ${f.MARTEAU})`,
        score:dmg,
        run:()=>{ dealDamage(defender, dmg); log(`Martèlement III → ${dmg} dégâts.`); }
      });
    }

    if(hasLargeStraight(nums)){
      abs.push({
        name:"Éclair II",
        reqText:"Grande suite",
        score:12,
        run:()=>{
          actor.tokens.electro = Math.min(4, (actor.tokens.electro||0)+2);
          dealDamage(defender, 12);
          log("Éclair II → 12 dégâts, +2 Électro (simplifié).");
        }
      });
    }

    if(f.GRANDEUR >= 3){
      abs.push({
        name:"Muscles Asgardiens",
        reqText:"GRANDEUR ≥ 3",
        score:3,
        run:()=>{ heal(actor, 4); log("Muscles Asgardiens → soigne 4."); }
      });
    }

    return abs;
  }
};

export default thor;
