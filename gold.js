const SAVE_KEY = "gold_mine_idle_save_v1";
const GOAL_GOLD = 10000;
const ROUGH_STONE_CLICK_CHANCE = 0.01;
const ROUGH_STONE_AUTO_CHANCE = 0.001;
const STONE_SELL_VALUE = 300;
const MAX_ACTORS_PER_TYPE = 5;

const SHOP_ITEMS = [
  {
    id: "miner",
    name: "矿工",
    description: "戴上安全帽，稳定敲出第一桶金。",
    baseCost: 15,
    production: 1,
    clickBonus: 0,
    image: "assets/gold/miner.png",
    unit: "+1/s",
  },
  {
    id: "cart",
    name: "矿车",
    description: "把碎金矿运得更快，产线开始转起来。",
    baseCost: 120,
    production: 6,
    clickBonus: 0,
    image: "assets/gold/mine-cart.png",
    unit: "+6/s",
  },
  {
    id: "mine",
    name: "铲车",
    description: "大型铲车把高产金矿一路运回仓库。",
    baseCost: 900,
    production: 35,
    clickBonus: 0,
    image: "assets/gold_new/sprites/loader-full.png",
    unit: "+35/s",
  },
  {
    id: "pickaxe",
    name: "点击镐升级",
    description: "每次点击都更有力。",
    baseCost: 50,
    production: 0,
    clickBonus: 1,
    image: "assets/gold/gold-coin.png",
    unit: "+1/click",
  },
];

const DEFAULT_STATE = {
  gold: 0,
  totalGold: 0,
  clickPower: 1,
  roughStones: 0,
  gems: {
    low: 0,
    mid: 0,
    high: 0,
  },
  owned: {
    miner: 0,
    cart: 0,
    mine: 0,
    pickaxe: 0,
  },
};

const goldAmountEl = document.querySelector("#goldAmount");
const gpsAmountEl = document.querySelector("#gpsAmount");
const clickPowerEl = document.querySelector("#clickPower");
const sceneMineButton = document.querySelector("#sceneMineButton");
const sceneActorsEl = document.querySelector("#sceneActors");
const sceneEffectsEl = document.querySelector("#sceneEffects");
const shopList = document.querySelector("#shopList");
const mineMessageEl = document.querySelector("#mineMessage");
const goalTextEl = document.querySelector("#goalText");
const progressTextEl = document.querySelector("#progressText");
const progressBarEl = document.querySelector("#progressBar");
const resetSaveButton = document.querySelector("#resetSave");
const roughStoneCountEl = document.querySelector("#roughStoneCount");
const chiselStoneButton = document.querySelector("#chiselStone");
const sellStoneButton = document.querySelector("#sellStone");
const chiselCostEl = document.querySelector("#chiselCost");
const lowGemCountEl = document.querySelector("#lowGemCount");
const midGemCountEl = document.querySelector("#midGemCount");
const highGemCountEl = document.querySelector("#highGemCount");
const gemBonusTextEl = document.querySelector("#gemBonusText");

let state = loadState();
let sceneSignature = "";

function freshDefaultState() {
  return {
    ...DEFAULT_STATE,
    owned: { ...DEFAULT_STATE.owned },
    gems: { ...DEFAULT_STATE.gems },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return freshDefaultState();
    return normalizeState(JSON.parse(raw));
  } catch {
    return freshDefaultState();
  }
}

function normalizeState(saved) {
  const owned = { ...DEFAULT_STATE.owned, ...(saved.owned || {}) };
  const gems = { ...DEFAULT_STATE.gems, ...(saved.gems || {}) };
  return {
    gold: finiteNumber(saved.gold, 0),
    totalGold: finiteNumber(saved.totalGold, 0),
    clickPower: Math.max(1, Math.floor(finiteNumber(saved.clickPower, 1))),
    roughStones: Math.max(0, Math.floor(finiteNumber(saved.roughStones, 0))),
    gems: Object.fromEntries(
      Object.keys(DEFAULT_STATE.gems).map((id) => [id, Math.max(0, Math.floor(finiteNumber(gems[id], 0)))])
    ),
    owned: Object.fromEntries(
      Object.keys(DEFAULT_STATE.owned).map((id) => [id, Math.max(0, Math.floor(finiteNumber(owned[id], 0)))])
    ),
  };
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function saveState() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function formatNumber(value) {
  if (value < 1000) return Number.isInteger(value) ? value.toString() : value.toFixed(1);
  if (value < 1000000) return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)}K`;
  return `${(value / 1000000).toFixed(2)}M`;
}

function formatPercent(value) {
  const percent = value * 100;
  if (percent < 10) return `+${percent.toFixed(1)}%`;
  return `+${percent.toFixed(0)}%`;
}

function itemCost(item) {
  return Math.ceil(item.baseCost * 1.18 ** state.owned[item.id]);
}

function chiselCost() {
  return 100 + Math.floor(Math.max(0, state.totalGold - 10000) * 0.1);
}

function gemBonus() {
  return state.gems.low * 0.001 + state.gems.mid * 0.002 + state.gems.high * 0.01;
}

function productionMultiplier() {
  return 1 + gemBonus();
}

function baseGoldPerSecond() {
  return SHOP_ITEMS.reduce((sum, item) => sum + item.production * state.owned[item.id], 0);
}

function goldPerSecond() {
  return baseGoldPerSecond() * productionMultiplier();
}

function clickYield() {
  return state.clickPower * productionMultiplier();
}

function addGold(amount) {
  state.gold += amount;
  state.totalGold += amount;
}

function maybeFindRoughStone(chance, source) {
  if (Math.random() >= chance) return false;
  state.roughStones += 1;
  mineMessageEl.textContent = source === "auto" ? "自动矿场发现了一块包石原石！" : "你挖到了一块包石原石！";
  return true;
}

function mineGold() {
  const amount = clickYield();
  addGold(amount);
  createSceneClickBurst(amount);

  const foundStone = maybeFindRoughStone(ROUGH_STONE_CLICK_CHANCE, "click");
  if (!foundStone) {
    mineMessageEl.textContent = `+${formatNumber(amount)} 金币`;
  }

  saveState();
  render();
}

function createSceneClickBurst(amount) {
  const burst = document.createElement("span");
  burst.className = "scene-score-burst";
  burst.textContent = `+${formatNumber(amount)}`;
  sceneEffectsEl.append(burst);
  burst.addEventListener("animationend", () => burst.remove(), { once: true });

  for (let index = 0; index < 8; index += 1) {
    const particle = document.createElement("img");
    particle.className = "scene-gold-particle";
    particle.src = "assets/gold_new/sprites/gold-small.png";
    particle.alt = "";
    const angle = -150 + index * 34;
    const distance = 30 + (index % 4) * 11;
    particle.style.setProperty("--x", `${Math.cos((angle * Math.PI) / 180) * distance}px`);
    particle.style.setProperty("--y", `${Math.sin((angle * Math.PI) / 180) * distance}px`);
    particle.style.animationDelay = `${index * 16}ms`;
    sceneEffectsEl.append(particle);
    particle.addEventListener("animationend", () => particle.remove(), { once: true });
  }
}

function buyItem(id) {
  const item = SHOP_ITEMS.find((entry) => entry.id === id);
  if (!item) return;

  const cost = itemCost(item);
  if (state.gold < cost) {
    mineMessageEl.textContent = "金币还不够，继续开采。";
    return;
  }

  state.gold -= cost;
  state.owned[id] += 1;
  if (item.clickBonus) state.clickPower += item.clickBonus;
  mineMessageEl.textContent = `购买了 ${item.name}。`;
  saveState();
  render();
}

function chiselStone() {
  const cost = chiselCost();
  if (state.roughStones <= 0) {
    mineMessageEl.textContent = "还没有包石原石可以凿开。";
    return;
  }
  if (state.gold < cost) {
    mineMessageEl.textContent = "金币不够支付凿开费用。";
    return;
  }

  state.roughStones -= 1;
  state.gold -= cost;

  const roll = Math.random();
  if (roll < 0.01) {
    state.gems.high += 1;
    mineMessageEl.textContent = "凿出了高级宝石！总产量大幅提升。";
  } else if (roll < 0.11) {
    state.gems.mid += 1;
    mineMessageEl.textContent = "凿出了中级宝石，矿场更稳了。";
  } else if (roll < 0.31) {
    state.gems.low += 1;
    mineMessageEl.textContent = "凿出了低级宝石，产量小幅提升。";
  } else {
    mineMessageEl.textContent = "凿开后里面是空的，只剩一堆碎石。";
  }

  saveState();
  render();
}

function sellStone() {
  if (state.roughStones <= 0) {
    mineMessageEl.textContent = "还没有包石原石可以出售。";
    return;
  }

  state.roughStones -= 1;
  addGold(STONE_SELL_VALUE);
  mineMessageEl.textContent = `出售原石，获得 ${STONE_SELL_VALUE} 金币。`;
  saveState();
  render();
}

function renderShop() {
  shopList.innerHTML = "";
  const fragment = document.createDocumentFragment();

  SHOP_ITEMS.forEach((item) => {
    const cost = itemCost(item);
    const canBuy = state.gold >= cost;
    const card = document.createElement("button");
    card.className = "shop-card";
    card.type = "button";
    card.disabled = !canBuy;
    card.dataset.item = item.id;
    card.innerHTML = `
      <img src="${item.image}" alt="">
      <span class="shop-copy">
        <strong>${item.name}</strong>
        <small>${item.description}</small>
        <em>拥有 ${state.owned[item.id]} · ${item.unit}</em>
      </span>
      <span class="shop-cost">${formatNumber(cost)}</span>
    `;
    card.addEventListener("click", () => buyItem(item.id));
    fragment.append(card);
  });

  shopList.append(fragment);
}

function createActor(kind, index, count) {
  const route = document.createElement("span");
  route.className = `scene-actor actor-${kind}`;
  route.style.setProperty("--delay", `${-(index * 8.5) / Math.max(count, 1)}s`);
  route.style.setProperty("--lane", `${index % 5}`);

  const sprite = document.createElement("img");
  sprite.alt = "";
  sprite.className = "actor-sprite";
  sprite.src = {
    miner: index % 2 === 0 ? "assets/gold_new/sprites/miner-carry.png" : "assets/gold_new/sprites/miner-pick.png",
    cart: "assets/gold_new/sprites/cart-full.png",
    loader: "assets/gold_new/sprites/loader-full.png",
  }[kind];

  route.append(sprite);
  return route;
}

function renderSceneActors() {
  const counts = {
    miner: Math.min(state.owned.miner, MAX_ACTORS_PER_TYPE),
    cart: Math.min(state.owned.cart, MAX_ACTORS_PER_TYPE),
    loader: Math.min(state.owned.mine, MAX_ACTORS_PER_TYPE),
  };
  const nextSignature = `${counts.miner}:${counts.cart}:${counts.loader}`;
  if (nextSignature === sceneSignature) return;
  sceneSignature = nextSignature;

  sceneActorsEl.innerHTML = "";
  const fragment = document.createDocumentFragment();
  Object.entries(counts).forEach(([kind, count]) => {
    for (let index = 0; index < count; index += 1) {
      fragment.append(createActor(kind, index, count));
    }
  });
  sceneActorsEl.append(fragment);
}

function renderGoal() {
  const ratio = Math.min(1, state.totalGold / GOAL_GOLD);
  const percent = Math.floor(ratio * 100);
  progressTextEl.textContent = `${percent}%`;
  progressBarEl.style.width = `${percent}%`;

  if (state.totalGold >= GOAL_GOLD) {
    goalTextEl.textContent = "矿场起飞：10,000 金币目标已完成！";
    goalTextEl.classList.add("is-complete");
  } else {
    goalTextEl.textContent = `目标：累计开采 ${formatNumber(GOAL_GOLD)} 金币`;
    goalTextEl.classList.remove("is-complete");
  }
}

function renderGems() {
  const cost = chiselCost();
  roughStoneCountEl.textContent = state.roughStones;
  chiselCostEl.textContent = formatNumber(cost);
  lowGemCountEl.textContent = state.gems.low;
  midGemCountEl.textContent = state.gems.mid;
  highGemCountEl.textContent = state.gems.high;
  gemBonusTextEl.textContent = formatPercent(gemBonus());

  chiselStoneButton.disabled = state.roughStones <= 0 || state.gold < cost;
  sellStoneButton.disabled = state.roughStones <= 0;
}

function render() {
  goldAmountEl.textContent = formatNumber(state.gold);
  gpsAmountEl.textContent = formatNumber(goldPerSecond());
  clickPowerEl.textContent = formatNumber(clickYield());
  renderGoal();
  renderShop();
  renderGems();
  renderSceneActors();
}

function tick() {
  const gps = goldPerSecond();
  if (gps > 0) {
    addGold(gps);
    const foundStone = maybeFindRoughStone(ROUGH_STONE_AUTO_CHANCE, "auto");
    if (!foundStone) mineMessageEl.textContent = `矿场自动产出 +${formatNumber(gps)} 金币`;
    saveState();
    render();
  }
}

function resetSave() {
  localStorage.removeItem(SAVE_KEY);
  state = freshDefaultState();
  sceneSignature = "";
  mineMessageEl.textContent = "存档已重置，重新开采吧。";
  render();
}

sceneMineButton.addEventListener("click", mineGold);
chiselStoneButton.addEventListener("click", chiselStone);
sellStoneButton.addEventListener("click", sellStone);
resetSaveButton.addEventListener("click", resetSave);
setInterval(tick, 1000);
render();
