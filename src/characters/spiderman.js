import { dealDamage, heal, hasSmallStraight, hasLargeStraight } from "../engine.js";

const spiderman = {
  id: "spiderman",
  name: "Spider-Man (Miles)",
  hpMax: 50,
  tokensDefault: {
    combo: 0, invis: 0, // côté Miles
    webbedOnEnemy: 0    // exemple si tu veux tracker
  },

  // mapping dés (Miles) : 1-3 THWIP, 4-5 TOILE, 6 ARAIGNEE
  face(n){
    if(n<=3) return "THWIP";
    if(n<=5) return "TOILE";
    return "ARAIGNEE";
  },

  countFaces(nums){
    const c = {THWIP:0, TOILE:0, ARAIGNEE:0};
    for(const n of nums) c[this.face(n)]++;
    return c;
  },

  getAbilities(ctx){
    const { nums, actor, defender, log } = ctx;
    const f = this.countFaces(nums);
    const abs = [];

    // Exemple : Allonge II (3 THWIP) => 5
    if(f.THWIP >= 3){
      abs.push({
        name:"Allonge II",
        reqText:`THWIP ≥ 3 (actuel ${f.THWIP})`,
        score: 5 + (f.THWIP>=4?1:0) + (f.THWIP>=5?2:0),
        run:()=>{
          const dmg = f.THWIP>=5 ? 7 : (f.THWIP===4 ? 6 : 5);
          dealDamage(defender, dmg);
          log(`Allonge II → ${dmg} dégâts.`);
        }
      });
    }

    // ULT (5 ARAIGNEE) => 13
    if(f.ARAIGNEE >= 5){
      abs.push({
        name:"ULT: Onde de choc venimeuse",
        reqText:"ARAIGNEE = 5",
        score: 15,
        run:()=>{
          dealDamage(defender, 13);
          actor.tokens.invis = 1;
          log("ULT → 13 dégâts, gagne Invisibilité (simplifié).");
        }
      });
    }

    // Tu pourras compléter ici toutes les autres attaques Miles (comme dans ton fichier précédent)
    return abs;
  }
};

export default spiderman;
