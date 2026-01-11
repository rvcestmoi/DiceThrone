import { hasSmallStraight, hasLargeStraight } from "../engine.js";

function pickByDifficulty(difficulty, easy, medium, hard){
  if(difficulty === "hard") return hard;
  if(difficulty === "medium") return medium;
  return easy;
}

const spiderman = {
  id: "spiderman",
  name: "Spider-Man (Miles Morales)",
  hpMax: 50,

  tokensDefault: {
    combo: 0,
    invis: 0
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
    const { nums, actor, log, difficulty, attackParryable, attackUnblockable, applyEntoile } = ctx;
    const f = this.countFaces(nums);
    const abs = [];

    actor.tokens = actor.tokens || {};
    actor.tokens.combo = actor.tokens.combo || 0;
    actor.tokens.invis = actor.tokens.invis || 0;

    // Allonge (3/4/5 THWIP) : dégâts parables selon difficulté
    if (f.THWIP >= 3) {
      const dmg3 = pickByDifficulty(difficulty, 4, 5, 6);
      const dmg4 = pickByDifficulty(difficulty, 5, 6, 7);
      const dmg5 = pickByDifficulty(difficulty, 6, 7, 8);
      const dmg = (f.THWIP >= 5) ? dmg5 : (f.THWIP === 4 ? dmg4 : dmg3);

      abs.push({
        name: "Allonge",
        reqText: `THWIP ≥ 3 (actuel ${f.THWIP}) → ${dmg} PARABLES (${difficulty})`,
        score: dmg,
        run: () => attackParryable(dmg, "Allonge"),
      });
    }

    // CCCOMBO : dégâts parables selon difficulté + combo
    if (f.THWIP >= 2 && f.ARAIGNEE >= 2) {
      const dmg = pickByDifficulty(difficulty, 5, 6, 7);
      abs.push({
        name: "CCC O M B O",
        reqText: `THWIP ≥ 2 & ARAIGNEE ≥ 2 → ${dmg} PARABLES + COMBO (${difficulty})`,
        score: dmg + 0.6,
        run: () => {
          attackParryable(dmg, "CCC O M B O");
          actor.tokens.combo = 1;
          log("Gain: COMBO (max 1).");
        },
      });
    }

    // Grimpe-murs : invis + dégâts parables selon difficulté
    if (f.THWIP >= 2 && f.TOILE >= 3) {
      const dmg = pickByDifficulty(difficulty, 7, 8, 9);
      abs.push({
        name: "Grimpe-murs",
        reqText: `THWIP ≥ 2 & TOILE ≥ 3 → INVIS + ${dmg} PARABLES (${difficulty})`,
        score: dmg + 0.8,
        run: () => {
          actor.tokens.invis = 1;
          log("Gain: INVISIBILITÉ (max 1).");
          attackParryable(dmg, "Grimpe-murs");
        },
      });
    }

    // Réflexes : total de 2 dés (parable). Si total < 6 => combo
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

    // Piège : dégâts parables selon difficulté + ENTOILÉ (jeton)
    if (hasSmallStraight(nums) || hasLargeStraight(nums)) {
      if (hasLargeStraight(nums)) {
        const dmg = pickByDifficulty(difficulty, 8, 9, 10);
        abs.push({
          name: "Piège (grande suite)",
          reqText: `Grande suite → ${dmg} PARABLES + ENTOILÉ (prochaine attaque parable => imparable)`,
          score: dmg + 0.6,
          run: () => {
            attackParryable(dmg, "Piège (grande suite)");
            applyEntoile();
          },
        });
      } else {
        const dmg = pickByDifficulty(difficulty, 5, 6, 7);
        abs.push({
          name: "Piège (petite suite)",
          reqText: `Petite suite → ${dmg} PARABLES + ENTOILÉ (prochaine attaque parable => imparable)`,
          score: dmg + 0.6,
          run: () => {
            attackParryable(dmg, "Piège (petite suite)");
            applyEntoile();
          },
        });
      }
    }

    // Allonge venimeuse : invis + dégâts imparables selon difficulté
    if (f.ARAIGNEE >= 4) {
      const dmg = pickByDifficulty(difficulty, 7, 8, 9);
      abs.push({
        name: "Allonge venimeuse",
        reqText: `ARAIGNEE ≥ 4 → INVIS + ${dmg} IMPARABLES (${difficulty})`,
        score: dmg + 1.0,
        run: () => {
          actor.tokens.invis = 1;
          log("Gain: INVISIBILITÉ (max 1).");
          attackUnblockable(dmg, "Allonge venimeuse");
        },
      });
    }

    return abs;
  },
};

export default spiderman;
