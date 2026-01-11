import { hasSmallStraight, hasLargeStraight } from "../engine.js";

const spiderman = {
  id: "spiderman",
  name: "Spider-Man (Miles Morales)",
  hpMax: 50,

  tokensDefault: {
    combo: 0, // unique
    invis: 0  // unique
  },

  // Mapping dés : 1-3 THWIP, 4-5 TOILE, 6 ARAIGNÉE
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

  getAbilities(ctx) {
    const { nums, actor, log, attack, attackUnblockable, applyEntoile } = ctx;
    const f = this.countFaces(nums);
    const abs = [];

    actor.tokens = actor.tokens || {};
    actor.tokens.combo = actor.tokens.combo || 0;
    actor.tokens.invis = actor.tokens.invis || 0;

    // ALLONGE : THWIP 3/4/5 => 4/5/6
    if (f.THWIP >= 3) {
      const dmg = f.THWIP >= 5 ? 6 : (f.THWIP === 4 ? 5 : 4);
      abs.push({
        id: "m_allonge",
        name: "Allonge",
        reqText: `THWIP ≥ 3 (actuel ${f.THWIP}) → ${dmg} dégâts`,
        score: dmg,
        run: () => attack(dmg),
      });
    }

    // C-C-C-COMBO : 2 THWIP + 2 ARAIGNEE => 6 dmg + gagne Combo
    if (f.THWIP >= 2 && f.ARAIGNEE >= 2) {
      abs.push({
        id: "m_ccccombo",
        name: "C-C-C-Combo",
        reqText: "THWIP ≥ 2 & ARAIGNEE ≥ 2 → 6 dégâts, gagne COMBO",
        score: 6.5,
        run: () => {
          attack(6);
          actor.tokens.combo = 1;
          log("Gain: COMBO (unique).");
        },
      });
    }

    // JET DE TOILE : 2 TOILE + 1 ARAIGNEE => gagne Invis + inflige Entoilé
    if (f.TOILE >= 2 && f.ARAIGNEE >= 1) {
      abs.push({
        id: "m_jet_toile",
        name: "Jet de toile",
        reqText: "TOILE ≥ 2 & ARAIGNEE ≥ 1 → gagne INVISIBILITÉ, inflige ENTOILÉ",
        score: 4.0,
        run: () => {
          actor.tokens.invis = 1;
          log("Gain: INVISIBILITÉ (unique).");
          applyEntoile();
        },
      });
    }

    // GRIMPE-MURS : 2 THWIP + 3 TOILE => gagne Invis + 7 dmg
    if (f.THWIP >= 2 && f.TOILE >= 3) {
      abs.push({
        id: "m_grimpe",
        name: "Grimpe-murs",
        reqText: "THWIP ≥ 2 & TOILE ≥ 3 → gagne INVISIBILITÉ, inflige 7 dégâts",
        score: 7.8,
        run: () => {
          actor.tokens.invis = 1;
          log("Gain: INVISIBILITÉ (unique).");
          attack(7);
        },
      });
    }

    // RÉFLEXES D’ARAIGNÉE : 2 THWIP + 2 TOILE + 1 ARAIGNEE
    // Lance 2 dés: dégâts = total. Si total <=5, gagne Combo.
    if (f.THWIP >= 2 && f.TOILE >= 2 && f.ARAIGNEE >= 1) {
      abs.push({
        id: "m_reflexes",
        name: "Réflexes d’araignée",
        reqText: "THWIP ≥ 2 & TOILE ≥ 2 & ARAIGNEE ≥ 1 → lance 2 dés (dégâts=total), si ≤5 gagne COMBO",
        score: 6.0,
        run: () => {
          const d1 = 1 + Math.floor(Math.random() * 6);
          const d2 = 1 + Math.floor(Math.random() * 6);
          const total = d1 + d2;
          log(`Réflexes: jets = ${d1} + ${d2} = ${total}.`);
          attack(total);
          if (total <= 5) {
            actor.tokens.combo = 1;
            log("Réflexes: total ≤ 5 → Gain: COMBO (unique).");
          }
        },
      });
    }

    // PIÈGE : petite suite / grande suite
    // Petite: 5 dmg puis Entoilé
    // Grande: pioche 1 (log), 8 dmg puis Entoilé
    if (hasSmallStraight(nums) || hasLargeStraight(nums)) {
      if (hasLargeStraight(nums)) {
        abs.push({
          id: "m_piege_grande",
          name: "Piège (grande suite)",
          reqText: "Grande suite → pioche 1 (log), inflige 8 dégâts, puis ENTOILÉ",
          score: 8.8,
          run: () => {
            log("Piège (grande suite): Pioche 1 (log).");
            attack(8);
            applyEntoile();
          },
        });
      } else {
        abs.push({
          id: "m_piege_petite",
          name: "Piège (petite suite)",
          reqText: "Petite suite → inflige 5 dégâts, puis ENTOILÉ",
          score: 5.8,
          run: () => {
            attack(5);
            applyEntoile();
          },
        });
      }
    }

    // ALLONGE VENIMEUSE : 4 ARAIGNEE => gagne Invis + 8 dégâts imparables
    if (f.ARAIGNEE >= 4) {
      abs.push({
        id: "m_allonge_venimeuse",
        name: "Allonge venimeuse",
        reqText: `ARAIGNEE ≥ 4 (actuel ${f.ARAIGNEE}) → gagne INVISIBILITÉ, inflige 8 dégâts IMPARABLES`,
        score: 9.2,
        run: () => {
          actor.tokens.invis = 1;
          log("Gain: INVISIBILITÉ (unique).");
          attackUnblockable(8);
        },
      });
    }

    // ENCHAÎNEMENT DE COMBOS : 3 ARAIGNEE => gagne Combo + 2 dégâts imparables
    if (f.ARAIGNEE >= 3) {
      abs.push({
        id: "m_enchainement",
        name: "Enchaînement de combos",
        reqText: `ARAIGNEE ≥ 3 (actuel ${f.ARAIGNEE}) → gagne COMBO, inflige 2 dégâts IMPARABLES`,
        score: 4.0,
        run: () => {
          actor.tokens.combo = 1;
          log("Gain: COMBO (unique).");
          attackUnblockable(2);
        },
      });
    }

    // ULT : 5 ARAIGNEE => gagne Invis, inflige Entoilé, puis 13 dmg
    if (f.ARAIGNEE >= 5) {
      abs.push({
        id: "m_ult",
        name: "ULT: Onde de choc venimeuse !",
        reqText: "ARAIGNEE = 5 → gagne INVISIBILITÉ, inflige ENTOILÉ, puis inflige 13 dégâts",
        score: 15.5,
        run: () => {
          actor.tokens.invis = 1;
          log("Gain: INVISIBILITÉ (unique).");
          applyEntoile();
          attack(13);
          log("ULT: prévention d’Ultime (non simulé).");
        },
      });
    }

    return abs;
  },
};

export default spiderman;
