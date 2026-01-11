export function fillSelect(selectEl, characters){
  selectEl.innerHTML = "";
  for(const c of characters){
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    selectEl.appendChild(opt);
  }
}

export function renderAll({ state, characters, abilities, faceProvider, onRunAbility, onToggleLock, onIncToken, onDecToken }){
  const hud = document.getElementById("hud");
  const diffLabel = state.difficulty === "easy" ? "Facile" : (state.difficulty === "medium" ? "Moyen" : "Difficile");

  const entoileBot = state.bot.statuses?.entoile?.stacks || 0;
  const entoilePlayer = state.player.statuses?.entoile?.stacks || 0;

  hud.innerHTML = `
    <div class="small">
      <b>Difficulté:</b> ${diffLabel}
      · <b>Relances:</b> ${state.rerollsLeft}
      · <b>Attaques bonus restantes:</b> ${state.flow.extraAttacksRemaining}
      <br/>
      <b>Joueur:</b> ${state.player.name} HP ${state.player.hp}/${state.player.hpMax}
      · Combo:${state.player.tokens?.combo||0} · Invis:${state.player.tokens?.invis||0}
      · Entoilé:${entoilePlayer}
      <br/>
      <b>Bot:</b> ${state.bot.name} HP ${state.bot.hp}/${state.bot.hpMax}
      · Entoilé:${entoileBot}
    </div>
  `;

  // Dice row
  const diceRow = document.getElementById("diceRow");
  diceRow.innerHTML = "";
  state.dice.forEach((d,i)=>{
    const b = document.createElement("div");
    b.className = "die" + (d.locked ? " locked" : "");
    b.innerHTML = `
      <div class="n">${d.v}</div>
      <div class="f">${faceProvider(d.v)}</div>
    `;
    b.addEventListener("click", ()=>onToggleLock(i));
    diceRow.appendChild(b);
  });

  // Tokens panels
  renderTokens({
    hostId: "playerTokens",
    fighter: state.player,
    fighterChar: characters.find(c=>c.id===state.player.charId),
    who: "player",
    onIncToken, onDecToken
  });

  renderTokens({
    hostId: "botTokens",
    fighter: state.bot,
    fighterChar: characters.find(c=>c.id===state.bot.charId),
    who: "bot",
    onIncToken, onDecToken
  });

  // Abilities
  const abilitiesHost = document.getElementById("abilities");
  abilitiesHost.innerHTML = "";
  if(!abilities.length){
    abilitiesHost.innerHTML = `<div class="ab"><div><div class="name">Aucune capacité</div><div class="small">Relance ou joue le bot.</div></div></div>`;
  } else {
    abilities.forEach((a, idx)=>{
      const el = document.createElement("div");
      el.className = "ab";
      el.innerHTML = `
        <div>
          <div class="name">${a.name}</div>
          <div class="small">${a.reqText ?? ""}</div>
        </div>
        <button data-i="${idx}">Activer</button>
      `;
      el.querySelector("button").addEventListener("click", ()=>onRunAbility(idx));
      abilitiesHost.appendChild(el);
    });
  }

  // Summary
  const summary = document.getElementById("summary");
  summary.innerHTML = "";
  state.summary.forEach(item=>{
    const el = document.createElement("div");
    el.className = "sItem";
    el.innerHTML = `
      <div class="sTop">
        <b>${escapeHtml(item.title)}</b>
        <span class="tag ${item.tag}">${item.tag.toUpperCase()}</span>
      </div>
      <div class="small">${escapeHtml(item.detail || "")}</div>
    `;
    summary.appendChild(el);
  });

  // Log
  document.getElementById("log").textContent = state.log.join("\n");
}

function renderTokens({ hostId, fighter, fighterChar, who, onIncToken, onDecToken }){
  const host = document.getElementById(hostId);
  host.innerHTML = "";

  const controls = fighterChar?.tokenControls || [];
  if(!controls.length){
    host.innerHTML = `<div class="small">Aucun jeton</div>`;
    return;
  }

  for(const c of controls){
    const cur = readValue(fighter, c);
    const el = document.createElement("div");
    el.className = "tok";
    el.innerHTML = `
      <div>
        <b>${c.label}</b>
        <div class="small">${cur} / ${c.max ?? "∞"}</div>
      </div>
      <div class="btns">
        <button>-</button>
        <button>+</button>
      </div>
    `;
    const [bMinus, bPlus] = el.querySelectorAll("button");
    bMinus.addEventListener("click", ()=>onDecToken(who, c.id));
    bPlus.addEventListener("click", ()=>onIncToken(who, c.id));
    host.appendChild(el);
  }
}

function readValue(fighter, control){
  if(control.kind === "token") return fighter.tokens?.[control.id] ?? 0;
  if(control.kind === "status") return fighter.statuses?.[control.id]?.stacks ?? 0;
  return 0;
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
