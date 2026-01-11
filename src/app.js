import { CHARACTERS, byId } from "./registry.js";
import { makeState, rollDice, resetRollPhase, nums, log, dealDamage } from "./engine.js";
import { fillSelect, render } from "./ui.js";

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

function ensureFlow(){
  state.flow = state.flow || { pendingAttack:null, lastPlayerAttackResolved:false, comboUsedThisTurn:false };
}

function startTurn(who){
  ensureFlow();
  state.turn = who;
  state.flow.pendingAttack = null;
  if (who === "player") {
    state.flow.comboUsedThisTurn = false;
    state.flow.lastPlayerAttackResolved = false;
  }
  resetRollPhase(state);
}

function queueAttack({ from, dmg, unblockable }){
  ensureFlow();
  const target = from === "player" ? state.bot : state.player;

  // ✅ ENTOILÉ : la prochaine attaque NORMALE devient IMPARABLE et retire le jeton
  if (!unblockable && target.statuses?.entoile?.stacks > 0) {
    delete target.statuses.entoile;
    unblockable = true;
    log(state, "ENTOILÉ : la prochaine attaque NORMALE devient IMPARABLE et le jeton est retiré.");
  }

  state.flow.pendingAttack = { from, dmg, unblockable: !!unblockable };
}

function canDefend(){
  ensureFlow();
  const atk = state.flow.pendingAttack;
  if(!atk) return false;

  const defender = atk.from === "player" ? state.bot : state.player;

  if(!atk.unblockable) return true;

  // attaque imparable -> défense seulement si Invisibilité
  return (defender.tokens?.invis || 0) >= 1;
}

function doDefense(){
  ensureFlow();
  const atk = state.flow.pendingAttack;
  if(!atk) return;

  const defender = atk.from === "player" ? state.bot : state.player;

  if(atk.unblockable){
    // Invisibilité dépensée pour autoriser un jet défensif
    defender.tokens.invis = 0;
    log(state, "Invisibilité dépensée → jet défensif autorisé contre attaque imparable.");
  }

  // Défense simple: 1d6 prévention
  const r = 1 + Math.floor(Math.random()*6);
  const prevented = Math.min(atk.dmg, r);
  const final = Math.max(0, atk.dmg - prevented);

  log(state, `Jet défensif: dé=${r} → prévient ${prevented}. Dégâts finaux: ${final}${atk.unblockable ? " (attaque imparable)" : ""}.`);
  dealDamage(defender, final);

  state.flow.pendingAttack = null;

  if(atk.from === "player") state.flow.lastPlayerAttackResolved = true;
}

function skipDefense(){
  ensureFlow();
  const atk = state.flow.pendingAttack;
  if(!atk) return;

  const defender = atk.from === "player" ? state.bot : state.player;

  dealDamage(defender, atk.dmg);
  log(state, `${atk.from === "player" ? "Joueur" : "Bot"} inflige ${atk.dmg} dégâts${atk.unblockable ? " IMPARABLES" : ""}. (pas de défense)`);

  state.flow.pendingAttack = null;

  if(atk.from === "player") state.flow.lastPlayerAttackResolved = true;
}

function tryCombo(){
  ensureFlow();
  if(!state.flow.lastPlayerAttackResolved) return;

  const player = state.player;
  if((player.tokens?.combo || 0) < 1) return;
  if(state.flow.comboUsedThisTurn) return;

  const ok = confirm("COMBO : dépenser pour rejouer une Phase de Lancer Offensif ?");
  if(!ok) return;

  player.tokens.combo = 0;
  state.flow.comboUsedThisTurn = true;
  state.flow.lastPlayerAttackResolved = false;

  log(state, "COMBO dépensé → nouvelle Phase de Lancer Offensif.");
  state.turn = "player";
  resetRollPhase(state);
}

function computeAbilities(){
  const { playerChar, botChar } = currentChars();
  const actorChar = state.turn === "player" ? playerChar : botChar;
  const actor = state.turn === "player" ? state.player : state.bot;
  const defender = state.turn === "player" ? state.bot : state.player;

  const from = state.turn; // "player"|"bot"

  // ctx enrichi pour que les persos puissent créer une attaque "pending"
  const ctx = {
    nums: nums(state),
    actor,
    defender,
    state,
    log: (m)=>log(state, m),

    attack: (dmg)=> queueAttack({ from, dmg, unblockable:false }),
    attackUnblockable: (dmg)=> queueAttack({ from, dmg, unblockable:true }),

    // appliquer Entoilé sur la cible (2 dégâts imparables + jeton)
    applyEntoile: ()=>{
      defender.statuses = defender.statuses || {};
      if(!defender.statuses.entoile) defender.statuses.entoile = { stacks: 1, meta: {} };
      log(state, "ENTOILÉ appliqué sur la cible.");
      queueAttack({ from, dmg: 2, unblockable:true }); // dégâts isolés imparables
    },
  };

  return actorChar.getAbilities(ctx) || [];
}

function rerender(){
  const abilities = computeAbilities();
  render(state, abilities);

  document.querySelectorAll("[data-ab]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const idx = Number(btn.dataset.ab);
      const abilitiesNow = computeAbilities();
      const a = abilitiesNow[idx];
      if(!a) return;

      a.run();

      // après une capacité, on re-render pour afficher "attaque en attente"
      rerender();
    });
  });
}

// ===== UI Buttons =====

document.getElementById("rollBtn").addEventListener("click", ()=>{
  if(state.turn !== "player") return alert("Ce n'est pas ton tour.");
  rollDice(state);
  log(state, `Joueur lance: [${nums(state).join(", ")}]`);
  rerender();
});

document.getElementById("rerollBtn").addEventListener("click", ()=>{
  if(state.turn !== "player") return alert("Ce n'est pas ton tour.");
  if(state.rerollsLeft <= 0) return alert("Plus de relances.");
  state.rerollsLeft--;
  rollDice(state);
  log(state, `Joueur relance: [${nums(state).join(", ")}]`);
  rerender();
});

document.getElementById("endPlayerTurnBtn").addEventListener("click", ()=>{
  if(state.turn !== "player") return alert("Ce n'est pas ton tour.");
  startTurn("bot");
  log(state, "---- Tour bot ---- (clique “Jouer bot”)");
  rerender();
});

document.getElementById("playBotBtn").addEventListener("click", ()=>{
  if(state.turn !== "bot") return alert("Ce n'est pas le tour du bot.");

  // Bot simple: il lance, choisit meilleure capacité, et la joue
  resetRollPhase(state);
  rollDice(state);
  log(state, `Bot lance: [${nums(state).join(", ")}]`);

  const abilities = computeAbilities().slice().sort((a,b)=>(b.score||0)-(a.score||0));
  const best = abilities[0];

  if(best){
    log(state, `Bot choisit: ${best.name}`);
    best.run();
  } else {
    // attaque basique
    queueAttack({ from:"bot", dmg:2, unblockable:false });
    log(state, "Bot attaque basique → 2 dégâts (en attente).");
  }

  log(state, "Bot a une attaque en attente → défends ou passe défense.");
  rerender();
});

document.getElementById("defendBtn").addEventListener("click", ()=>{
  if(!state.flow?.pendingAttack) return alert("Aucune attaque à défendre.");
  if(!canDefend()) return alert("Défense impossible (attaque imparable sans Invisibilité).");
  doDefense();
  tryCombo(); // combo possible après la défense adverse (si attaque joueur résolue)
  // Si c'était une attaque du bot, on repasse au joueur après défense
  if(state.turn === "bot") startTurn("player");
  rerender();
});

document.getElementById("skipDefenseBtn").addEventListener("click", ()=>{
  if(!state.flow?.pendingAttack) return alert("Aucune attaque en attente.");
  skipDefense();
  tryCombo();
  if(state.turn === "bot") startTurn("player");
  rerender();
});

document.getElementById("resetBtn").addEventListener("click", ()=>location.reload());

playerSelect.addEventListener("change", ()=>{
  state = makeState(byId(playerSelect.value), byId(botSelect.value));
  log(state, "---- Tour joueur ----");
  rerender();
});

botSelect.addEventListener("change", ()=>{
  state = makeState(byId(playerSelect.value), byId(botSelect.value));
  log(state, "---- Tour joueur ----");
  rerender();
});

// init
log(state, "---- Tour joueur ----");
log(state, "Prêt.");
rerender();
