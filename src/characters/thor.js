// src/characters/thor.js
import {
  dealDamage,
  heal,
  hasSmallStraight,
  hasLargeStraight,
  log as engineLog,
} from "../engine.js";

function rollD6() {
  return 1 + Math.floor(Math.random() * 6);
}

function hasTriple(nums) {
  const c = {};
  for (const n of nums) c[n] = (c[n] || 0) + 1;
  return Object.values(c).some((v) => v >= 3);
}

function spendBriseGardeIfWanted(ctx, actor) {
  // Simplifié: si token dispo -> propose de tenter rendre l'attaque "imparable" (log only)
  if (!actor.tokens || (actor.tokens.brise || 0) <= 0) return false;

  // Sur GitHub Pages, confirm() marche. Si tu veux une UI plus propre, on le fera ensuite.
  const ok = confirm("Brise-garde dispo. Dépenser 1 pour tenter rendre l'attaque imparable (sur 4-5) ?");
  if (!ok) return false;

  actor.tokens.brise = Math.max(0, (actor.tokens.brise || 0) - 1);
  const r = rollD6();
  const success = r === 4 || r === 5;
  ctx.log(`Brise-garde dépensé: dé=${r} → ${success ? "IMPARABLE (log)" : "raté"}.`);
  return success;
}

function canThrowMjollnir(actor) {
  return actor.tokens && actor.tokens.mjollnir === "self";
}
function canRecallMjollnir(actor) {
  return actor.tokens && actor.tokens.mjollnir === "opponent";
}

const thor = {
  id: "thor",
  name: "Thor",
  hpMax: 50,

  tokensDefault: {
    brise: 0,          // 0..2
    electro: 0,        // 0..4
    mjollnir: "self",  // "self" | "opponent"
  },

  face(n) {
    // mapping classique : 1-3 marteau, 4-5 grandeur, 6 foudre
    if (n <= 3) return "MARTEAU";
    if (n <= 5) return "GRANDEUR";
    return "FOUDRE";
  },

  countFaces(nums) {
    const c = { MARTEAU: 0, GRANDEUR: 0, FOUDRE: 0 };
    for (const n of nums) c[this.face(n)]++;
    return c;
  },

  getAbilities(ctx) {
    const { nums, actor, defender } = ctx;
    const f = this.countFaces(nums);

    // helpers safe
    actor.tokens = actor.tokens || {};
    actor.tokens.brise = actor.tokens.brise || 0;
    actor.tokens.electro = actor.tokens.electro || 0;
    actor.tokens.mjollnir = actor.tokens.mjollnir || "self";

    const abilities = [];

    // --- Utilities: always available when relevant ---
    if (canThrowMjollnir(actor)) {
      abilities.push({
        id: "thor_throw_mjollnir",
        name: "Lancer Mjöllnir (utilitaire)",
        reqText: "Mjöllnir est chez Thor → inflige 1 dégât (imparable, log) et passe chez l’adversaire",
        score: 1.2,
        run: () => {
          actor.tokens.mjollnir = "opponent";
          dealDamage(defender, 1);
          ctx.log("Mjöllnir lancé → 1 dégât (imparable log) et Mjöllnir passe chez l’adversaire.");
        },
      });
    }

    if (canRecallMjollnir(actor)) {
      abilities.push({
        id: "thor_recall_mjollnir",
        name: "Récupérer Mjöllnir (utilitaire)",
        reqText: "Mjöllnir est chez l’adversaire → revient chez Thor",
        score: 0.6,
        run: () => {
          actor.tokens.mjollnir = "self";
          ctx.log("Mjöllnir récupéré → il revient sur le plateau de Thor.");
        },
      });
    }

    // --- Core attacks / skills ---
    // 1) Martèlement III : >=3 marteaux (3->5 / 4->6 / 5->8) + triple => +1 electro
    if (f.MARTEAU >= 3) {
      const dmg = f.MARTEAU >= 5 ? 8 : f.MARTEAU === 4 ? 6 : 5;
      abilities.push({
        id: "thor_martelement",
        name: "Martèlement III",
        reqText: `MARTEAU ≥ 3 (actuel ${f.MARTEAU}) → ${dmg} dégâts (triple: +1 Électro)`,
        score: dmg + (actor.tokens.electro || 0) * 0.1,
        run: () => {
          spendBriseGardeIfWanted(ctx, actor);
          if (hasTriple(nums)) {
            actor.tokens.electro = Math.min(4, (actor.tokens.electro || 0) + 1);
            ctx.log("Martèlement: triple → +1 Électrokinésie.");
          }
          dealDamage(defender, dmg);
          ctx.log(`Martèlement III → ${dmg} dégâts.`);
        },
      });
    }

    // 2) Boum boum ! : >=2 marteaux & >=2 foudres => 6 dmg +2 electro
    if (f.MARTEAU >= 2 && f.FOUDRE >= 2) {
      abilities.push({
        id: "thor_boum",
        name: "Boum boum !",
        reqText: `MARTEAU ≥ 2 & FOUDRE ≥ 2 → 6 dégâts +2 Électro`,
        score: 6.8,
        run: () => {
          spendBriseGardeIfWanted(ctx, actor);
          actor.tokens.electro = Math.min(4, (actor.tokens.electro || 0) + 2);
          dealDamage(defender, 6);
          ctx.log("Boum boum ! → 6 dégâts. +2 Électrokinésie.");
        },
      });
    }

    // 3) Puissante invocation II : marteau>=1 grandeur>=2 foudre>=1
    // +2 brise (max2), heal3,
    // si mjollnir self: +3 electro sinon: récupère et 4 dégâts collatéraux
    if (f.MARTEAU >= 1 && f.GRANDEUR >= 2 && f.FOUDRE >= 1) {
      abilities.push({
        id: "thor_invocation",
        name: "Puissante invocation II",
        reqText:
          "MARTEAU ≥ 1, GRANDEUR ≥ 2, FOUDRE ≥ 1 → +2 Brise (max2), soigne 3, bonus Mjöllnir/Électro",
        score: 5.2,
        run: () => {
          actor.tokens.brise = Math.min(2, (actor.tokens.brise || 0) + 2);
          heal(actor, 3);
          ctx.log("Invocation → +2 Brise-garde (max2) et soigne 3.");

          if (actor.tokens.mjollnir === "self") {
            actor.tokens.electro = Math.min(4, (actor.tokens.electro || 0) + 3);
            ctx.log("Mjöllnir est chez Thor → +3 Électrokinésie.");
          } else {
            actor.tokens.mjollnir = "self";
            dealDamage(defender, 4);
            ctx.log("Mjöllnir récupéré → 4 dégâts collatéraux (imparable log).");
          }
        },
      });
    }

    // 4) Muscles Asgardiens : >=3 grandeur => heal4
    if (f.GRANDEUR >= 3) {
      abilities.push({
        id: "thor_heal",
        name: "Muscles Asgardiens",
        reqText: `GRANDEUR ≥ 3 (actuel ${f.GRANDEUR}) → soigne 4`,
        score: actor.hp < actor.hpMax ? 4.0 : 1.0,
        run: () => {
          heal(actor, 4);
          ctx.log("Muscles Asgardiens → soigne 4.");
        },
      });
    }

    // 5) Odinforce II (approx) : >=2 marteaux & >=3 grandeur
    // inflige 6 + (electro) et +1 electro
    if (f.MARTEAU >= 2 && f.GRANDEUR >= 3) {
      const extra = actor.tokens.electro || 0;
      abilities.push({
        id: "thor_odinforce",
        name: "Odinforce II (approx)",
        reqText: "MARTEAU ≥ 2 & GRANDEUR ≥ 3 → 6 + Électro dégâts, +1 Électro",
        score: 6 + extra + 0.5,
        run: () => {
          spendBriseGardeIfWanted(ctx, actor);
          actor.tokens.electro = Math.min(4, (actor.tokens.electro || 0) + 1);
          const bonus = extra;
          dealDamage(defender, 6 + bonus);
          ctx.log(`Odinforce II → ${6}+${bonus} = ${6 + bonus} dégâts. (+1 Électro)`);
        },
      });
    }

    // 6) Chaîne d’éclairs II (approx) : petite suite => 7 dégâts +1 electro
    if (hasSmallStraight(nums)) {
      abilities.push({
        id: "thor_chaine",
        name: "Chaîne d’éclairs II (approx)",
        reqText: "Petite suite → 7 dégâts +1 Électro",
        score: 7.4,
        run: () => {
          spendBriseGardeIfWanted(ctx, actor);
          actor.tokens.electro = Math.min(4, (actor.tokens.electro || 0) + 1);
          dealDamage(defender, 7);
          ctx.log("Chaîne d’éclairs II → 7 dégâts. +1 Électro.");
        },
      });
    }

    // 7) Paratonnerre II (approx) : >=4 grandeur => 5 dégâts +1 brise
    if (f.GRANDEUR >= 4) {
      abilities.push({
        id: "thor_paratonnerre",
        name: "Paratonnerre II (approx)",
        reqText: "GRANDEUR ≥ 4 → 5 dégâts +1 Brise-garde",
        score: 5.6,
        run: () => {
          spendBriseGardeIfWanted(ctx, actor);
          actor.tokens.brise = Math.min(2, (actor.tokens.brise || 0) + 1);
          dealDamage(defender, 5);
          ctx.log("Paratonnerre II → 5 dégâts. +1 Brise-garde.");
        },
      });
    }

    // 8) Foudre en bouteille II (approx) : >=3 foudres => 6 dégâts +2 electro
    if (f.FOUDRE >= 3) {
      abilities.push({
        id: "thor_bouteille",
        name: "Foudre en bouteille II (approx)",
        reqText: `FOUDRE ≥ 3 (actuel ${f.FOUDRE}) → 6 dégâts +2 Électro`,
        score: 6.7,
        run: () => {
          spendBriseGardeIfWanted(ctx, actor);
          actor.tokens.electro = Math.min(4, (actor.tokens.electro || 0) + 2);
          dealDamage(defender, 6);
          ctx.log("Foudre en bouteille II → 6 dégâts. +2 Électro.");
        },
      });
    }

    // 9) Ricochet ! (approx) : >=2 marteaux & >=1 foudre => 5 dégâts +1 (collatéral)
    if (f.MARTEAU >= 2 && f.FOUDRE >= 1) {
      abilities.push({
        id: "thor_ricochet",
        name: "Ricochet ! (approx)",
        reqText: "MARTEAU ≥ 2 & FOUDRE ≥ 1 → 5 dégâts (+1 collatéral log)",
        score: 6.0,
        run: () => {
          spendBriseGardeIfWanted(ctx, actor);
          dealDamage(defender, 5);
          // collatéral log (Dice Throne: cible multiple / dégâts isolés)
          dealDamage(defender, 1);
          ctx.log("Ricochet ! → 5 dégâts + 1 dégât collatéral (log).");
        },
      });
    }

    // 10) Éclair II : grande suite => 12 dégâts +2 electro (+ log mjollnir)
    if (hasLargeStraight(nums)) {
      abilities.push({
        id: "thor_eclair",
        name: "Éclair II",
        reqText: "Grande suite → 12 dégâts +2 Électro (Mjöllnir effets: log)",
        score: 12.8,
        run: () => {
          spendBriseGardeIfWanted(ctx, actor);
          actor.tokens.electro = Math.min(4, (actor.tokens.electro || 0) + 2);
          dealDamage(defender, 12);
          ctx.log("Éclair II → 12 dégâts. +2 Électro. (Mjöllnir: effets non auto).");
        },
      });
    }

    // 11) ULT Pour Asgard ! : 5 foudres => 14 dégâts +1 brise (+ log mjollnir x4)
    if (f.FOUDRE >= 5) {
      abilities.push({
        id: "thor_ult",
        name: "POUR ASGARD ! (ULT)",
        reqText: "FOUDRE = 5 → 14 dégâts +1 Brise-garde (Mjöllnir x4: log)",
        score: 15.0,
        run: () => {
          actor.tokens.brise = Math.min(2, (actor.tokens.brise || 0) + 1);
          dealDamage(defender, 14);
          ctx.log("ULT → 14 dégâts. +1 Brise-garde. (Mjöllnir x4 non auto).");
        },
      });
    }

    return abilities;
  },
};

export default thor;
