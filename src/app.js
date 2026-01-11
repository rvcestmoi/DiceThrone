import { CHARACTERS, byId } from "./registry.js";
import { makeState, rollDice, resetRollPhase, nums, log, pushSummary, dealDamage, clamp } from "./engine.js";
import { fillSelect, renderAll } from "./ui.js";

const playerSelect = document.getElementById("playerSelect");
const botSelect = document.getElementById("botSelect");

fillSelect(playerSelect, CHARACTERS);
fillSelect(botSelect, CHARACTERS);

playerSelect.value = "spiderman";
botSelect.value = "thor";

let state = makeState(byId(playerSelect.value), byId(botSelect.value));

function currentChars(){
  return { playerChar: byId(playerSelect.value), botChar: byId(botSelect.value) };
}

function applyPlayerAttackToBot({ dmg, parryable, label }){
  // ENTOILÉ sur bot: si attaque PARABLE -> devient IMPARABLE et consomme le jeton
  if(parryable && state.bot.statuses?.entoile?.stacks > 0){
    delete state.bot.statuses.entoile;
    parryable = false;
    log(state, "ENTOILÉ (bot): l’attaque PARABLE devient IMPARABLE et le jeton est retiré.");
    pushSummary(state, { tag:"warn", title:"Entoilé consommé", detail:"Attaque devenue IMPARABLE." });
  }

  dealDamage(state.bot, dmg);
  log(state, `Joueur inflige ${dmg} dégâts (${parryable ? "PARABLES" : "IMPARABLES"}) — ${label}`);
  pushSummary(state, { tag:"info", title:"Joueur attaque", detail:`${dmg} (${parryable ? "PARABLE" : "IMPARABLE"}) — ${label}` });

  // ✅ COMBO ultra simple: si Combo=1, il attaque 2 fois
  // -> on consomme le jeton et on reset la phase offensive
  if((state.player.tokens?.combo || 0) >= 1){
    state.player.tokens.combo = 0;
    log(state, "COMBO consommé → attaque bonus immédiate (relances remises).");
    pushSummary(state, { tag:"good", title:"COMBO", detail:"Attaque bonus immédiate (phase offensive reset)." });
    resetRollPhase(state);
  }
}

function applyEntoileOnBot(){
  state.bot.statuses = state.bot.statuses || {};
  if(!state.bot.statuses.entoile) state.bot.statuses.entoile = { stacks: 1, meta: {} };

  // à l'application: 2 dégâts IMPARABLES (isolés)
  dealDamage(state.bot, 2);
  log(state, "ENTOILÉ appliqué sur le bot → 2 dégâts IMPARABLES (isolés).");
  pushSummary(state, { tag:"warn", title:"Entoilé", detail:"Jeton posé + 2 dégâts IMPARABLES (isolés)." });
}

function botPlayImmediate(){
  const { botChar, playerChar } = currentChars();

  resetRollPhase(state);
  rollDice(state);
  log(state, `Bot lance: [${nums(state).join(", ")}]`);

  // Helper: applique ENTOILÉ sur le joueur (si bot Miles/Spidey le peut)
  function applyEntoileOnPlayer(){
    state.player.statuses = state.player.statuses || {};
    if(!state.player.statuses.entoile) state.player.statuses.entoile = { stacks: 1, meta: {} };

    // À l'application : 2 dégâts IMPARABLES (isolés)
    dealDamage(state.player, 2);
    log(state, "ENTOILÉ appliqué sur le joueur → 2 dégâts IMPARABLES (isolés).");
    pushSummary(state, { tag:"warn", title:"Entoilé", detail:"Jeton posé sur le joueur + 2 IMPARABLES (isolés)." });
  }

  // Helper: applique attaque bot immédiatement (en tenant compte d'ENTOILÉ éventuel sur le joueur)
  function botAttack({ dmg, parryable, label }){
    // Si le joueur est ENTOILÉ : la prochaine attaque PARABLE devient IMPARABLE et consomme le jeton
    if(parryable && state.player.statuses?.entoile?.stacks > 0){
      delete state.player.statuses.entoile;
      parryable = false;
      log(state, "ENTOILÉ (joueur): l’attaque PARABLE du bot devient IMPARABLE et le jeton est retiré.");
      pushSummary(state, { tag:"warn", title:"Entoilé consommé", detail:"Attaque du bot devenue IMPARABLE." });
    }

    dealDamage(state.player, dmg);
    log(state, `Bot inflige ${dmg} dégâts (${parryable ? "PARABLES" : "IMPARABLES"}) — ${label}`);
    pushSummary(state, { tag:"bad", title:"Bot attaque", detail:`${dmg} (${parryable ? "PARABLE" : "IMPARABLE"}) — ${label}` });
  }

  // ctx bot : COMPLET (inclut applyEntoile)
  const ctx = {
    nums: nums(state),
    actor: state.bot,
    defender: state.player,
    state,
    log: (m)=>log(state, m),

    attackParryable: (dmg, label)=> botAttack({ dmg, parryable:true, label: label || "Attaque" }),
    attackUnblockable: (dmg, label)=> botAttack({ dmg, parryable:false, label: label || "Attaque" }),

    // ✅ manquait : pour les persos qui posent ENTOILÉ (ex: Miles)
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

  // Renvoi si applicable (Miles)
  if(ret > 0){
    dealDamage(state.bot, ret);
    log(state, `Défense: renvoi ${ret} dégâts IMPARABLES au bot.`);
  }

  log(state, `Défense (${state.player.name}): prévention=${prevented}. ${out.detail || ""}`);
  pushSummary(state, { tag:"good", title:"Défense", detail:`Prévention=${prevented}${ret ? ` · Renvoi=${ret} IMPARABLES` : ""}` });

  rerender();
}

function computeAbilities(){
  const { playerChar } = currentChars();

  const ctx = {
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
    console.warn(`[bind] élément #${id} introuvable (GitHub Pages HTML pas à jour ?).`);
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

  bind("resetBtn", "click", () => location.reload());

  bind("clearLog", "click", () => {
    state.log = [];
    state.summary = [];
    rerender();
  });

  bind("playerSelect", "change", () => {
    state = makeState(byId(playerSelect.value), byId(botSelect.value));
    resetRollPhase(state);
    log(state, "Prêt.");
    rerender();
  });

  bind("botSelect", "change", () => {
    state = makeState(byId(playerSelect.value), byId(botSelect.value));
    resetRollPhase(state);
    log(state, "Prêt.");
    rerender();
  });

  // init
  resetRollPhase(state);
  log(state, "Prêt.");
  rerender();
});
