export function fillSelect(selectEl, characters){
  selectEl.innerHTML = "";
  for(const c of characters){
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    selectEl.appendChild(opt);
  }
}

export function render(state, abilities){
  // HUD
  const hud = document.getElementById("hud");
  const atk = state.flow?.pendingAttack;
  hud.innerHTML = `
    <div><b>Joueur:</b> ${state.player.name} — HP ${state.player.hp}/${state.player.hpMax} — Combo:${state.player.tokens?.combo||0} Invis:${state.player.tokens?.invis||0}</div>
    <div><b>Bot:</b> ${state.bot.name} — HP ${state.bot.hp}/${state.bot.hpMax} — Entoilé:${state.bot.statuses?.entoile?.stacks||0}</div>
    <div><b>Tour:</b> ${state.turn} — Relances:${state.rerollsLeft}</div>
    <div><b>Attaque en attente:</b> ${atk ? `${atk.from} → ${atk.dmg} ${atk.unblockable ? "(IMPARABLE)" : ""}` : "—"}</div>
  `;

  // Dice
  const diceRow = document.getElementById("diceRow");
  diceRow.innerHTML = state.dice.map((d,i)=>`
    <button data-i="${i}" style="margin:6px;padding:10px;border-radius:12px">
      ${d.v} ${d.locked ? "🔒" : ""}
    </button>
  `).join("");

  diceRow.querySelectorAll("button").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const i = Number(btn.dataset.i);
      state.dice[i].locked = !state.dice[i].locked;
      // l'app re-render ensuite
    });
  });

  // Abilities
  const ab = document.getElementById("abilities");
  ab.innerHTML = `
    <div style="margin-top:10px">
      <div><b>Capacités (${state.turn})</b></div>
      ${abilities.length ? abilities.map((a, idx)=>`
        <div style="margin-top:8px;border:1px solid rgba(255,255,255,.12);padding:8px;border-radius:12px">
          <div><b>${a.name}</b></div>
          <div style="opacity:.8;font-size:12px">${a.reqText ?? ""}</div>
          <button data-ab="${idx}" style="margin-top:8px">Activer</button>
        </div>
      `).join("") : `<div style="opacity:.7;margin-top:8px">Aucune capacité</div>`}
    </div>
  `;

  // Log
  const logEl = document.getElementById("log");
  logEl.textContent = state.log.join("\n");
}
