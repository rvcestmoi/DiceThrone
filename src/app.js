import { CHARACTERS, byId } from "./registry.js";
import { makeState, rollDice, resetRollPhase, nums, log, dealDamage } from "./engine.js";
import { fillSelect, render } from "./ui.js";

let playerId = "spiderman";
let botId = "thor";

const playerSelect = document.getElementById("playerSelect");
const botSelect = document.getElementById("botSelect");

fillSelect(playerSelect, CHARACTERS);
fillSelect(botSelect, CHARACTERS);

playerSelect.value = playerId;
botSelect.value = botId;

let state = makeState(byId(playerId), byId(botId));

function currentChars(){
  return { playerChar: byId(playerSelect.value), botChar: byId(botSelect.value) };
}

function computeAbilities(){
  const { playerChar, botChar } = currentChars();
  const actorChar = state.turn === "player" ? playerChar : botChar;
  const actor = state.turn === "player" ? state.player : state.bot;
  const defender = state.turn === "player" ? state.bot : state.player;

  // ask character module for abilities
  const abilities = actorChar.getAbilities({
    nums: nums(state),
    actor,
    defender,
    state,
    log: (m)=>log(state, m),
  });

  return abilities;
}

function rerender(){
  const { playerChar, botChar } = currentChars();
  const abilities = computeAbilities();
  render(state, { playerChar, botChar, abilities });

  // bind ability buttons
  document.querySelectorAll("[data-ab]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      if(state.turn !== "player") return alert("Ce n'est pas ton tour.");
      const abilities = computeAbilities();
      const a = abilities[Number(btn.dataset.ab)];
      if(!a) return;
      a.run();
      log(state, "Capacité jouée. Clique “Fin tour joueur”.");
      rerender();
    });
  });
}

function botPlay(){
  // bot = simple: roll, reroll x2 if no good ability, pick max score
  resetRollPhase(state);
  state.turn = "bot";
  rollDice(state);
  log(state, `Bot lance: [${nums(state).join(", ")}]`);

  for(let k=0;k<2;k++){
    const abs = computeAbilities().slice().sort((a,b)=>b.score-a.score);
    if(abs[0] && abs[0].score >= 9) break;
    state.rerollsLeft--;
    rollDice(state);
    log(state, `Bot relance: [${nums(state).join(", ")}]`);
  }

  const abs = computeAbilities().slice().sort((a,b)=>b.score-a.score);
  const best = abs[0];
  if(best){
    log(state, `Bot choisit: ${best.name}`);
    best.run();
  } else {
    dealDamage(state.player, 2);
    log(state, "Bot attaque basique → 2 dégâts.");
  }

  state.turn = "player";
  resetRollPhase(state);
  log(state, "---- Tour joueur ----");
  rerender();
}

// UI events
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
  state.turn = "bot";
  log(state, "---- Tour bot ---- (clique “Jouer bot”)");
  rerender();
});

document.getElementById("playBotBtn").addEventListener("click", ()=>{
  if(state.turn !== "bot") return alert("Ce n'est pas le tour du bot.");
  botPlay();
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

log(state, "---- Tour joueur ----");
log(state, "Prêt.");
rerender();
