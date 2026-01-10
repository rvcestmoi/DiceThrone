export function makeState(playerChar, botChar){
  return {
    turn: "player",
    rerollsLeft: 2,
    dice: Array.from({length:5}, ()=>({v:1, locked:false})),
    player: makeFighter(playerChar),
    bot: makeFighter(botChar),
    log: []
  };
}

function makeFighter(char){
  return {
    charId: char.id,
    name: char.name,
    hp: char.hpMax ?? 50,
    hpMax: char.hpMax ?? 50,
    tokens: structuredClone(char.tokensDefault ?? {}),
  };
}

export function rollDice(state){
  for(const d of state.dice){
    if(!d.locked) d.v = 1 + Math.floor(Math.random()*6);
  }
}

export function resetRollPhase(state){
  state.rerollsLeft = 2;
  state.dice.forEach(d => { d.v = 1; d.locked = false; });
}

export function nums(state){
  return state.dice.map(d => d.v);
}

export function log(state, msg){
  const t = new Date().toLocaleTimeString();
  state.log.push(`[${t}] ${msg}`);
}

export function dealDamage(target, amount){
  target.hp = Math.max(0, target.hp - Math.max(0, amount));
}

export function heal(target, amount){
  target.hp = Math.min(target.hpMax, target.hp + Math.max(0, amount));
}

// Suites (utilisées par plusieurs persos)
export function hasSmallStraight(arr){
  const s = [...new Set(arr)].sort((a,b)=>a-b);
  const seqs = [[1,2,3,4],[2,3,4,5],[3,4,5,6]];
  return seqs.some(seq => seq.every(n=>s.includes(n)));
}
export function hasLargeStraight(arr){
  const s = [...new Set(arr)].sort((a,b)=>a-b);
  return s.length===5 && (
    [1,2,3,4,5].every(n=>s.includes(n)) ||
    [2,3,4,5,6].every(n=>s.includes(n))
  );
}
