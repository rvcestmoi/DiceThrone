import { hasSmallStraight, hasLargeStraight } from "../engine.js";

const spiderman = {
  id: "spiderman",
  name: "Spider-Man (Miles Morales)",
  hpMax: 50,

  tokensDefault: {
    combo: 0, // max 1
    invis: 0  // max 1
  },

  tokenControls: [
    { id:"combo", kind:"token", label:"COMBO", min:0, max:1 },
    { id:"invis", kind:"token", label:"INVISIBILITÉ", min:0, max:1 },
  ],

  face(n) {
    if (n <= 3) return "THWIP";
    if (n <= 5) return "TOILE";
    return "ARAIGNEE";
  },

  countFaces(nums) {
    const c = { THWIP: 0, TOILE: 0, ARAIGNEE: 0 };
    for (const n of nums) c[this.face(n)]++;
    return c;
  },

  // Défense Miles (fiche) :
  // 3 dés ; chaque THWIP => +1 prévention + 1 dégât imparable (renvoi)
  getDefense({ rollDice, face }) {
    const rolls = rollDice(3);
    const faces = rolls.map(face);
    const thwip = faces.filter(f=>f==="THWIP").length;

    return {
      prevented: thwip,
      retaliateUnblockable: thwip,
      detail: `Miles: rolls [${rolls.join(", ")}] → faces [${faces.join(", ")}] → THWIP=${thwip}`
    };
  },

  getAbilities(ctx) {
    const { nums, actor, log, attackParryable, attackUnblockable, applyEntoile } = ctx;
    const f = this.countFaces(nums);
    const abs = [];

    actor.tokens = actor.tokens || {};
    actor.tokens.combo = actor.tokens.combo || 0;
    actor.tokens.invis = actor.tokens.invis || 0;

    // Allonge : 3/4/5 THWIP -> 4/5/6 parables
    if (f.THWIP >= 3) {
      const dmg = f.THWIP >= 5 ? 6 : (f.THWIP === 4 ? 5 : 4);
      abs.push({
        name: "Allonge",
        reqText: `THWIP ≥ 3 (actuel ${f.THWIP}) → ${dmg} PARABLES`,
        score: dmg,
        run: () => attackParryable(dmg, "Allonge"),
      });
    }

    // CCCOMBO : 2 THWIP + 2 ARAIGNEES : 5 parables + jeton combo
    if (f.THWIP >= 2 && f.ARAIGNEE >= 2) {
      abs.push({
        name: "CCC O M B O",
        reqText: "THWIP ≥ 2 & ARAIGNEE ≥ 2 → 5 PARABLES + COMBO",
        score: 5.6,
        run: () => {
          attackParryable(5, "CCC O M B O");
          actor.tokens.combo = 1; // max 1
          log("Gain: COMBO (max 1).");
        },
      });
    }

    // Grimpe-murs : 2 THWIP + 3 TOILES : invis + 7 parables
    if (f.THWIP >= 2 && f.TOILE >= 3) {
      abs.push({
        name: "Grimpe-murs",
        reqText: "THWIP ≥ 2 & TOILE ≥ 3 → INVIS + 7 PARABLES",
        score: 7.8,
        run: () => {
          actor.tokens.invis = 1;
          log("Gain: INVISIBILITÉ (max 1).");
          attackParryable(7, "Grimpe-murs");
        },
      });
    }

    // Réflexes : 1 THWIP + 2 TOILES + 1 ARAIGNEE
    // dégâts parables = total de 2 dés ; si total < 6 => combo
    if (f.THWIP >= 1 && f.TOILE >= 2 && f.ARAIGNEE >= 1) {
      abs.push({
        name: "Réflexes d’araignée",
        reqText: "THWIP ≥ 1 & TOILE ≥ 2 & ARAIGNEE ≥ 1 → 2 dés (dégâts=total). Si total < 6 → COMBO",
        score: 6.0,
        run: () => {
          const d1 = 1 + Math.floor(Math.random() * 6);
          const d2 = 1 + Math.floor(Math.random() * 6);
          const total = d1 + d2;
          log(`Réflexes: jets = ${d1} + ${d2} = ${total}.`);
          attackParryable(total, "Réflexes (2 dés)");
          if (total < 6) {
            actor.tokens.combo = 1;
            log("Réflexes: total < 6 → Gain: COMBO (max 1).");
          }
        },
      });
    }

    // Piège petite/grande suite
    if (hasSmallStraight(nums) || hasLargeStraight(nums)) {
      if (hasLargeStraight(nums)) {
        abs.push({
          name: "Piège (grande suite)",
          reqText: "Grande suite → 8 PARABLES + ENTOILÉ",
          score: 8.6,
          run: () => {
            attackParryable(8, "Piège (grande suite)");
            applyEntoile();
          },
        });
      } else {
        abs.push({
          name: "Piège (petite suite)",
          reqText: "Petite suite → 5 PARABLES + ENTOILÉ",
          score: 5.6,
          run: () => {
            attackParryable(5, "Piège (petite suite)");
            applyEntoile();
          },
        });
      }
    }

    // Allonge venimeuse : 4 araignées : invis + 7 imparables
    if (f.ARAIGNEE >= 4) {
      abs.push({
        name: "Allonge venimeuse",
        reqText: `ARAIGNEE ≥ 4 (actuel ${f.ARAIGNEE}) → INVIS + 7 IMPARABLES`,
        score: 8.5,
        run: () => {
          actor.tokens.invis = 1;
          log("Gain: INVISIBILITÉ (max 1).");
          attackUnblockable(7, "Allonge venimeuse");
        },
      });
    }

    return abs;
  },
};

export default spiderman;
