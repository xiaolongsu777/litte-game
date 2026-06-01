const SAVE_KEY = "gold_mine_idle_save_v1";
const GOAL_GOLD = 10000;
const ROUGH_STONE_CLICK_CHANCE = 0.01;
const ROUGH_STONE_AUTO_CHANCE = 0.001;
const STONE_SELL_VALUE = 300;
const MAX_ACTORS_PER_TYPE = 5;
const DAY_SECONDS = 180;
const NIGHT_SECONDS = 120;
const ENGINEER_TRAINING_SECONDS = 360;
const ENGINEER_TRAINING_COST = 100000;
const NIGHT_COSTS = {
  miner: 10,
  cart: 100,
  mine: 500,
};

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

const WORKER_PICKAXES = [
  { id: "iron", name: "铁镐", cost: 5000, bonus: 0.5 },
  { id: "steel", name: "钢镐", cost: 10000, bonus: 1 },
  { id: "titanium", name: "钛镐", cost: 50000, bonus: 1.5 },
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
  cyclePhase: "day",
  cycleRemaining: DAY_SECONDS,
  workerPickaxes: {
    iron: false,
    steel: false,
    titanium: false,
  },
  engineers: 0,
  engineerTraining: {
    active: false,
    remaining: 0,
  },
};

const goldAmountEl = document.querySelector("#goldAmount");
const gpsAmountEl = document.querySelector("#gpsAmount");
const clickPowerEl = document.querySelector("#clickPower");
const cyclePhaseTextEl = document.querySelector("#cyclePhaseText");
const cycleTimerEl = document.querySelector("#cycleTimer");
const scenePanelEl = document.querySelector("#scenePanel");
const sceneBgEl = document.querySelector("#sceneBg");
const sceneMineButton = document.querySelector("#sceneMineButton");
const sceneActorsEl = document.querySelector("#sceneActors");
const sceneEffectsEl = document.querySelector("#sceneEffects");
const shopList = document.querySelector("#shopList");
const pickaxeUpgradeListEl = document.querySelector("#pickaxeUpgradeList");
const workerBoostTextEl = document.querySelector("#workerBoostText");
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
const engineerCountEl = document.querySelector("#engineerCount");
const engineerBoostTextEl = document.querySelector("#engineerBoostText");
const trainingProgressBarEl = document.querySelector("#trainingProgressBar");
const trainingStatusEl = document.querySelector("#trainingStatus");
const trainEngineerButton = document.querySelector("#trainEngineer");

let state = loadState();
let sceneSignature = "";

function freshDefaultState() {
  return {
    ...DEFAULT_STATE,
    owned: { ...DEFAULT_STATE.owned },
    gems: { ...DEFAULT_STATE.gems },
    workerPickaxes: { ...DEFAULT_STATE.workerPickaxes },
    engineerTraining: { ...DEFAULT_STATE.engineerTraining },
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
  const base = freshDefaultState();
  const owned = { ...base.owned, ...(saved.owned || {}) };
  const gems = { ...base.gems, ...(saved.gems || {}) };
  const workerPickaxes = { ...base.workerPickaxes, ...(saved.workerPickaxes || {}) };
  const engineerTraining = { ...base.engineerTraining, ...(saved.engineerTraining || {}) };
  const cyclePhase = saved.cyclePhase === "night" ? "night" : "day";
  const cycleMax = cyclePhase === "night" ? NIGHT_SECONDS : DAY_SECONDS;

  return {
    gold: finiteNumber(saved.gold, 0),
    totalGold: finiteNumber(saved.totalGold, 0),
    clickPower: Math.max(1, Math.floor(finiteNumber(saved.clickPower, 1))),
    roughStones: Math.max(0, Math.floor(finiteNumber(saved.roughStones, 0))),
    gems: Object.fromEntries(
      Object.keys(base.gems).map((id) => [id, Math.max(0, Math.floor(finiteNumber(gems[id], 0)))])
    ),
    owned: Object.fromEntries(
      Object.keys(base.owned).map((id) => [id, Math.max(0, Math.floor(finiteNumber(owned[id], 0)))])
    ),
    cyclePhase,
    cycleRemaining: clampInteger(finiteNumber(saved.cycleRemaining, cycleMax), 1, cycleMax),
    workerPickaxes: Object.fromEntries(Object.keys(base.workerPickaxes).map((id) => [id, Boolean(workerPickaxes[id])])),
    engineers: Math.max(0, Math.floor(finiteNumber(saved.engineers, 0))),
    engineerTraining: {
      active: Boolean(engineerTraining.active),
      remaining: Math.max(0, Math.floor(finiteNumber(engineerTraining.remaining, 0))),
    },
  };
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampInteger(value, min, max) {
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function saveState() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function formatNumber(value) {
  const sign = value < 0 ? "-" : "";
  const amount = Math.abs(value);
  if (amount < 1000) return `${sign}${Number.isInteger(amount) ? amount.toString() : amount.toFixed(1)}`;
  if (amount < 1000000) return `${sign}${(amount / 1000).toFixed(amount < 10000 ? 1 : 0)}K`;
  return `${sign}${(amount / 1000000).toFixed(2)}M`;
}

function formatPercent(value) {
  const percent = value * 100;
  if (percent < 10) return `+${percent.toFixed(1)}%`;
  return `+${percent.toFixed(0)}%`;
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
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

function workerPickaxeBonus() {
  return WORKER_PICKAXES.reduce((sum, pickaxe) => sum + (state.workerPickaxes[pickaxe.id] ? pickaxe.bonus : 0), 0);
}

function workerMultiplier() {
  return 1 + workerPickaxeBonus();
}

function engineerMultiplier() {
  return 1 + state.engineers * 0.05;
}

function baseGoldPerSecond() {
  const miner = SHOP_ITEMS[0].production * state.owned.miner * workerMultiplier();
  const cart = SHOP_ITEMS[1].production * state.owned.cart * engineerMultiplier();
  const loader = SHOP_ITEMS[2].production * state.owned.mine * engineerMultiplier();
  return miner + cart + loader;
}

function goldPerSecond() {
  if (state.cyclePhase === "night") return 0;
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
    particle.src = "assets/gold/gold-nugget.png";
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

function buyWorkerPickaxe(id) {
  const pickaxe = WORKER_PICKAXES.find((entry) => entry.id === id);
  if (!pickaxe || state.workerPickaxes[id]) return;
  if (state.gold < pickaxe.cost) {
    mineMessageEl.textContent = "金币还不够，暂时买不起这把镐子。";
    return;
  }

  state.gold -= pickaxe.cost;
  state.workerPickaxes[id] = true;
  mineMessageEl.textContent = `矿工装备了${pickaxe.name}，白天采矿更快了。`;
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

function canStartEngineerTraining() {
  return (
    !state.engineerTraining.active &&
    state.gold >= ENGINEER_TRAINING_COST &&
    state.owned.miner >= 1 &&
    state.gems.low >= 1 &&
    state.gems.mid >= 1 &&
    state.gems.high >= 1
  );
}

function startEngineerTraining() {
  if (state.engineerTraining.active) {
    mineMessageEl.textContent = "已经有一名工人在训练中。";
    return;
  }
  if (!canStartEngineerTraining()) {
    mineMessageEl.textContent = "训练条件还不够：需要工人 1、三类宝石各 1、100K 金币。";
    return;
  }

  state.gold -= ENGINEER_TRAINING_COST;
  state.owned.miner -= 1;
  state.gems.low -= 1;
  state.gems.mid -= 1;
  state.gems.high -= 1;
  state.engineerTraining = {
    active: true,
    remaining: ENGINEER_TRAINING_SECONDS,
  };
  sceneSignature = "";
  mineMessageEl.textContent = "一名矿工开始接受工程师训练。";
  saveState();
  render();
}

function advanceEngineerTraining() {
  if (!state.engineerTraining.active) return false;
  state.engineerTraining.remaining = Math.max(0, state.engineerTraining.remaining - 1);
  if (state.engineerTraining.remaining > 0) return true;

  state.engineerTraining.active = false;
  state.engineerTraining.remaining = 0;
  state.engineers += 1;
  mineMessageEl.textContent = "工程师训练完成！矿车和铲车效率提升。";
  return true;
}

function chargeNightCosts() {
  const baseCost =
    state.owned.miner * NIGHT_COSTS.miner + state.owned.cart * NIGHT_COSTS.cart + state.owned.mine * NIGHT_COSTS.mine;
  if (baseCost <= 0) {
    mineMessageEl.textContent = "夜晚降临，矿场停工休息。";
    return;
  }

  const multiplier = state.gold < 0 ? 2 : 1;
  const cost = baseCost * multiplier;
  state.gold -= cost;
  mineMessageEl.textContent =
    multiplier > 1
      ? `夜晚降临，欠账状态下工资维护费翻倍，支出 ${formatNumber(cost)} 金币。`
      : `夜晚降临，支付工资和维护费 ${formatNumber(cost)} 金币。`;
}

function advanceCycle() {
  state.cycleRemaining -= 1;
  if (state.cycleRemaining > 0) return true;

  if (state.cyclePhase === "day") {
    state.cyclePhase = "night";
    state.cycleRemaining = NIGHT_SECONDS;
    chargeNightCosts();
  } else {
    state.cyclePhase = "day";
    state.cycleRemaining = DAY_SECONDS;
    mineMessageEl.textContent = "天亮了，矿场恢复自动生产。";
  }
  return true;
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

function renderWorkerPickaxes() {
  workerBoostTextEl.textContent = formatPercent(workerPickaxeBonus());
  pickaxeUpgradeListEl.innerHTML = "";
  const fragment = document.createDocumentFragment();

  WORKER_PICKAXES.forEach((pickaxe) => {
    const owned = state.workerPickaxes[pickaxe.id];
    const canBuy = !owned && state.gold >= pickaxe.cost;
    const button = document.createElement("button");
    button.className = "upgrade-row";
    button.type = "button";
    button.disabled = owned || !canBuy;
    button.innerHTML = `
      <span>
        <strong>${pickaxe.name}</strong>
        <small>矿工效率 ${formatPercent(pickaxe.bonus)}</small>
      </span>
      <em>${owned ? "已拥有" : formatNumber(pickaxe.cost)}</em>
    `;
    button.addEventListener("click", () => buyWorkerPickaxe(pickaxe.id));
    fragment.append(button);
  });

  pickaxeUpgradeListEl.append(fragment);
}

function createActor(kind, index, count) {
  const route = document.createElement("span");
  route.className = `scene-actor actor-${kind}`;
  route.style.setProperty("--delay", `${-(index * 9.5) / Math.max(count, 1)}s`);
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
    miner: state.cyclePhase === "night" ? 0 : Math.min(state.owned.miner, MAX_ACTORS_PER_TYPE),
    cart: state.cyclePhase === "night" ? 0 : Math.min(state.owned.cart, MAX_ACTORS_PER_TYPE),
    loader: state.cyclePhase === "night" ? 0 : Math.min(state.owned.mine, MAX_ACTORS_PER_TYPE),
  };
  const nextSignature = `${state.cyclePhase}:${counts.miner}:${counts.cart}:${counts.loader}`;
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

function renderEngineerTraining() {
  engineerCountEl.textContent = state.engineers;
  engineerBoostTextEl.textContent = `矿车与铲车效率 ${formatPercent(state.engineers * 0.05)}`;

  if (state.engineerTraining.active) {
    const done = 1 - state.engineerTraining.remaining / ENGINEER_TRAINING_SECONDS;
    trainingProgressBarEl.style.width = `${Math.max(0, Math.min(100, done * 100))}%`;
    trainingStatusEl.textContent = `训练中，剩余 ${formatTime(state.engineerTraining.remaining)}。`;
    trainEngineerButton.disabled = true;
    trainEngineerButton.textContent = "训练进行中";
    return;
  }

  trainingProgressBarEl.style.width = "0%";
  trainingStatusEl.textContent = "消耗 1 名工人、三类宝石各 1、100K 金币，训练 6 分钟。";
  trainEngineerButton.disabled = !canStartEngineerTraining();
  trainEngineerButton.textContent = "训练工程师";
}

function renderCycle() {
  const isNight = state.cyclePhase === "night";
  scenePanelEl.classList.toggle("is-night", isNight);
  sceneBgEl.src = isNight ? "assets/gold_new/main-night.png" : "assets/gold_new/main.png";
  cyclePhaseTextEl.textContent = isNight ? "黑夜" : "白天";
  cycleTimerEl.textContent = formatTime(state.cycleRemaining);
}

function render() {
  goldAmountEl.textContent = formatNumber(state.gold);
  gpsAmountEl.textContent = formatNumber(goldPerSecond());
  clickPowerEl.textContent = formatNumber(clickYield());
  renderCycle();
  renderGoal();
  renderShop();
  renderWorkerPickaxes();
  renderGems();
  renderEngineerTraining();
  renderSceneActors();
}

function tick() {
  let changed = advanceCycle();
  changed = advanceEngineerTraining() || changed;

  const gps = goldPerSecond();
  if (gps > 0) {
    addGold(gps);
    const foundStone = maybeFindRoughStone(ROUGH_STONE_AUTO_CHANCE, "auto");
    if (!foundStone) mineMessageEl.textContent = `矿场自动产出 +${formatNumber(gps)} 金币`;
    changed = true;
  }

  if (changed) {
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
trainEngineerButton.addEventListener("click", startEngineerTraining);
resetSaveButton.addEventListener("click", resetSave);
setInterval(tick, 1000);
render();
