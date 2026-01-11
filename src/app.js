import { CHARACTERS, byId } from "./registry.js";
import { makeState, rollDice, resetRollPhase, nums, log, pushSummary, dealDamage, clamp } from "./engine.js";
import { fillSelect, renderAll } from "./ui.js";

const playerSelect = document.getElementById("playerSelect");
const botSelect = document.getElementById("botSelect");
const difficultySelect = document.getElementById("difficultySelect");

fillSelect(playerSelect, CHARACTERS);
fillSelect(botSelect, CHARACTERS);

playerSelect.value = "spiderman";
botSelect.value = "thor";
difficultySelect.value = "easy";

let state = makeState(byId(playerSelect.value), byId(botSelect.value), difficultySelect.value);

function currentChars(){
  return { playerChar: byId(playerSelect.value), botChar: byId(botSelect.value) };
}

/* =========================
   DIFFICULTÉ / COMBO
========================= */

function comboExtraCount(){
  // Facile/Moyen: 1 attaque bonus ; Difficile: 2 attaques bonus
  return state.difficulty === "hard" ? 2 : 1;
}

function spendComboAndGrantExtraAttacksIfAny(){
  if((state.player.tokens?.combo || 0) >= 1){
    state.player.tokens.combo = 0; // max 1, consommé
    const extra = comboExtraCount();
    state.flow.extraAttacksRemaining = extra;

    log(state, `COMBO consommé → +${extra} attaque(s) bonus (difficulté=${state.difficulty}).`);
    pushSummary(state, { tag:"good", title:"COMBO", detail:`+${extra} attaque(s) bonus. Dés/relances reset.` });

    resetRollPhase(state);
    return true;
  }
  return false;
}

function afterPlayerAttackMaybeContinueCombo(){
  if(state.flow.extraAttacksRemaining > 0){
    state.flow.extraAttacksRemaining--;
    log(state, `Attaque bonus restante(s): ${state.flow.extraAttacksRemaining}. Dés/relances reset.`);
    pushSummary(state, { tag:"good", title:"Attaque bonus", detail:`Encore ${state.flow.extraAttacksRemaining} attaque(s) bonus.` });
    resetRollPhase(state);
  }
}

/* =========================
   ENTOILÉ (ROLLBACK)
   - Jeton sur la cible
   - Prochaine attaque PARABLE devient IMPARABLE + jeton défaussé
   - MAIS: on n'utilise PAS entoilé avec le COMBO (attaques bonus)
========================= */

function giveEntoile(target, whoLabel){
  target.statuses = target.statuses || {};
  target.statuses.entoile = { stacks: 1, meta: {} };
  log(state, `${whoLabel} applique ENTOILÉ (prochaine attaque PARABLE → IMPARABLE, puis jeton défaussé).`);
  pushSummary(state, { tag:"warn", title:"Entoilé", detail:`Jeton posé sur ${whoLabel === "Joueur" ? "le bot" : "le joueur"}.` });
}

/** Applique la règle entoilé si applicable.
 *  - Ne s'applique pas pendant les attaques bonus COMBO (extraAttacksRemaining>0)
 *  - Retourne { parryableFinal, consumed }
 */
function applyEntoileRuleOnTarget({ target, parryable, isComboAttack }){
  if(!parryable) return { parryableFinal: false, consumed: false };
  if(isComboAttack) return { parryableFinal: true, consumed: false }; // ✅ pas d'entoilé avec combo

  if(target.statuses?.entoile?.stacks > 0){
    delete target.statuses.entoile;
    return { parryableFinal: false, consumed: true }; // devient imparable + jeton consommé
  }
  return { parryableFinal: true, consumed: false };
}

/* =========================
   ATTAQUES JOUEUR -> BOT
========================= */

function applyPlayerAttackToBot({ dmg, parryable, label }){
  const isComboAttack = state.flow.extraAttacksRemaining > 0;
  const entoile = applyEntoileRuleOnTarget({ target: state.bot, parryable, isComboAttack });

  const finalParryable = entoile.parryableFinal;
  if(entoile.consumed){
    log(state, "ENTOILÉ (bot): attaque PARABLE → devient IMPARABLE, jeton défaussé.");
    pushSummary(state, { tag:"warn", title:"Entoilé consommé", detail:"Attaque devenue IMPARABLE." });
  }

  dealDamage(state.bot, dmg);
  log(state, `Joueur inflige ${dmg} dégâts (${finalParryable ? "PARABLES" : "IMPARABLES"}) — ${label}`);
  pushSummary(state, { tag:"info", title:"Joueur attaque", detail:`${dmg} (${finalParryable ? "PARABLE" : "IMPARABLE"}) — ${label}` });

  // COMBO flow: si on n'est pas déjà en chaîne bonus, on consomme COMBO pour démarrer la chaîne.
  // Si on est déjà en chaîne, on décrémente.
  if(state.flow.extraAttacksRemaining === 0){
    spendComboAndGrantExtraAttacksIfAny();
  } else {
    afterPlayerAttackMaybeContinueCombo();
  }
}

function applyEntoileOnBot(){
  // ✅ rollback: pas de dégâts, juste jeton
  // ✅ ET: "on utilise pas entoilée avec le combo" => poser entoilé ne déclenche pas/comptabilise pas dans le combo
  giveEntoile(state.bot, "Joueur");
  // IMPORTANT: on ne touche pas au flow COMBO ici.
}

/* =========================
   BOT PLAY (immédiat)
========================= */

function botPlayImmediate(){
  const { botChar } = currentChars();

  resetRollPhase(state);
  rollDice(state);
  log(state, `Bot lance: [${nums(state).join(", ")}]`);

  function botAttack({ dmg, parryable, label }){
    // Bot n'a pas de "combo chain" géré pour l’instant → isComboAttack=false
    const entoile = applyEntoileRuleOnTarget({ target: state.player, parryable, isComboAttack: false });
    const finalParryable = entoile.parryableFinal;

    if(entoile.consumed){
      log(state, "ENTOILÉ (joueur): attaque PARABLE du bot → devient IMPARABLE, jeton défaussé.");
      pushSummary(state, { tag:"warn", title:"Entoilé consommé", detail:"Attaque du bot devenue IMPARABLE." });
    }

    dealDamage(state.player, dmg);
    log(state, `Bot inflige ${dmg} dégâts (${finalParryable ? "PARABLES" : "IMPARABLES"}) — ${label}`);
    pushSummary(state, { tag:"bad", title:"Bot attaque", detail:`${dmg} (${finalParryable ? "PARABLE" : "IMPARABLE"}) — ${label}` });
  }

  function applyEntoileOnPlayer(){
    giveEntoile(state.player, "Bot");
  }

  const ctx = {
    difficulty: state.difficulty,
    nums: nums(state),
    actor: state.bot,
    defender: state.player,
    state,
    log: (m)=>log(state, m),
    attackParryable: (dmg, label)=> botAttack({ dmg, parryable:true, label: label || "Attaque" }),
    attackUnblockable: (dmg, label)=> botAttack({ dmg, parryable:false, label: label || "Attaque" }),
    applyEntoile: ()=> applyEntoileOnPlayer(),
  };

  const abilities = (botChar.getAbilities(ctx) || []).slice().sort((a,b)=>(b.score||0)-(a.score||0));
  const best = abilities[0];

  if(best){
    log(state, `Bot choisit: ${best.name}`);
    pushSummary(state, { tag:"bad", title:"Bot joue", detail: best.name });
    best.run();
  } else {
    ctx.attackParryable(2, "Attaque basique");
  }
}

/* =========================
   DEFENSE (info)
========================= */

function doDefenseInfo(){
  const { playerChar } = currentChars();

  if(typeof playerChar.getDefense !== "function"){
    log(state, "Défense: aucune règle définie pour ce perso.");
    pushSummary(state, { tag:"warn", title:"Défense", detail:"Aucune règle définie." });
    rerender();
    return;
  }

  const out = playerChar.getDefense({
    rollDice: (n)=>{
      const arr = [];
      for(let i=0;i<n;i++) arr.push(1 + Math.floor(Math.random()*6));
      return arr;
    },
    face: (n)=>playerChar.face(n),
  });

  const prevented = Math.max(0, out.prevented ?? 0);
  const ret = Math.max(0, out.retaliateUnblockable ?? 0);

  if(ret > 0){
    dealDamage(state.bot, ret);
    log(state, `Défense: renvoi ${ret} dégâts IMPARABLES au bot.`);
    pushSummary(state, { tag:"good", title:"Renvoi", detail:`${ret} dégâts IMPARABLES au bot.` });
  }

  log(state, `Défense (${state.player.name}): prévention=${prevented}. ${out.detail || ""}`);
  pushSummary(state, { tag:"good", title:"Défense", detail:`Prévention=${prevented}` });

  rerender();
}

/* =========================
   ABILITIES PLAYER
========================= */

function computeAbilities(){
  const { playerChar } = currentChars();

  const ctx = {
    difficulty: state.difficulty,
    nums: nums(state),
    actor: state.player,
    defender: state.bot,
    state,
    log: (m)=>log(state, m),

    attackParryable: (dmg, label)=> applyPlayerAttackToBot({ dmg, parryable:true, label: label || "Attaque" }),
    attackUnblockable: (dmg, label)=> applyPlayerAttackToBot({ dmg, parryable:false, label: label || "Attaque" }),
    applyEntoile: ()=> applyEntoileOnBot(),
  };

  return playerChar.getAbilities(ctx) || [];
}

/* =========================
   TOKENS +/- UI
========================= */

function adjustToken(who, tokenId, delta){
  const { playerChar, botChar } = currentChars();
  const fighter = who === "player" ? state.player : state.bot;
  const char = who === "player" ? playerChar : botChar;

  const controls = char.tokenControls || [];
  const c = controls.find(x=>x.id===tokenId);
  if(!c) return;

  if(c.kind === "token"){
    const cur = fighter.tokens?.[tokenId] ?? 0;
    const next = clamp(cur + delta, c.min ?? 0, c.max ?? 99);
    fighter.tokens[tokenId] = next;
    log(state, `${who === "player" ? "Joueur" : "Bot"}: ${c.label} → ${next}`);
  } else if(c.kind === "status"){
    fighter.statuses = fighter.statuses || {};
    const cur = fighter.statuses?.[tokenId]?.stacks ?? 0;
    const next = clamp(cur + delta, c.min ?? 0, c.max ?? 99);
    if(next <= 0) delete fighter.statuses[tokenId];
    else fighter.statuses[tokenId] = { stacks: next, meta: {} };
    log(state, `${who === "player" ? "Joueur" : "Bot"}: ${c.label} → ${next}`);
  }

  rerender();
}

/* =========================
   RENDER
========================= */

function rerender(){
  const abilities = computeAbilities();
  const { playerChar } = currentChars();

  renderAll({
    state,
    characters: CHARACTERS,
    abilities,
    faceProvider: (n)=>playerChar.face(n),
    onRunAbility: (idx)=>{
      const a = abilities[idx];
      if(!a) return;
      a.run();
      rerender();
    },
    onToggleLock: (i)=>{
      state.dice[i].locked = !state.dice[i].locked;
      rerender();
    },
    onIncToken: (who, tokenId)=>adjustToken(who, tokenId, +1),
    onDecToken: (who, tokenId)=>adjustToken(who, tokenId, -1),
  });
}

/* =========================
   UI EVENTS (safe)
========================= */

function bind(id, event, handler){
  const el = document.getElementById(id);
  if(!el){
    console.warn(`[bind] élément #${id} introuvable (HTML pas à jour/caché ?)`);
    return;
  }
  el.addEventListener(event, handler);
}

window.addEventListener("DOMContentLoaded", () => {
  bind("rollBtn", "click", () => {
    rollDice(state);
    log(state, `Joueur lance: [${nums(state).join(", ")}]`);
    rerender();
  });

  bind("rerollBtn", "click", () => {
    if(state.rerollsLeft <= 0) return alert("Plus de relances.");
    state.rerollsLeft--;
    rollDice(state);
    log(state, `Joueur relance: [${nums(state).join(", ")}]`);
    rerender();
  });

  bind("playBotBtn", "click", () => {
    botPlayImmediate();
    rerender();
  });

  bind("defenseBtn", "click", () => {
    doDefenseInfo();
  });

  bind("difficultySelect", "change", () => {
    state.difficulty = difficultySelect.value;
    log(state, `Difficulté -> ${state.difficulty}`);
    pushSummary(state, { tag:"info", title:"Difficulté", detail: state.difficulty });
    rerender();
  });

  bind("resetBtn", "click", () => location.reload());

  bind("clearLog", "click", () => {
    state.log = [];
    state.summary = [];
    rerender();
  });

  bind("playerSelect", "change", () => {
    state = makeState(byId(playerSelect.value), byId(botSelect.value), difficultySelect.value);
    resetRollPhase(state);
    log(state, "Prêt.");
    rerender();
  });

  bind("botSelect", "change", () => {
    state = makeState(byId(playerSelect.value), byId(botSelect.value), difficultySelect.value);
    resetRollPhase(state);
    log(state, "Prêt.");
    rerender();
  });

  // init
  resetRollPhase(state);
  log(state, "Prêt.");
  rerender();
});
