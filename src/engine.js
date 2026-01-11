export function makeState(playerChar, botChar){
  return {
    rerollsLeft: 2,
    dice: Array.from({length:5}, ()=>({v:1, locked:false})),
    player: makeFighter(playerChar),
    bot: makeFighter(botChar),
    log: [],
    summary: []
  };
}

function makeFighter(char){
  return {
    charId: char.id,
    name: char.name,
    hp: char.hpMax ?? 50,
    hpMax: char.hpMax ?? 50,
    tokens: structuredClone(char.tokensDefault ?? {}),
    statuses: {}
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
export function nums(state){ return state.dice.map(d => d.v); }
export function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

export function log(state, msg){
  const t = new Date().toLocaleTimeString();
  state.log.push(`[${t}] ${msg}`);
}

export function pushSummary(state, item){
  state.summary.unshift(item);
  if(state.summary.length > 12) state.summary.length = 12;
}

export function dealDamage(target, amount){
  target.hp = Math.max(0, target.hp - Math.max(0, amount));
}

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
