const LEVELS = {
  easy: { size: 9, mines: 10 },
  medium: { size: 12, mines: 22 },
  hard: { size: 16, mines: 45 },
};

const boardEl = document.querySelector("#board");
const mineCountEl = document.querySelector("#mineCount");
const timerEl = document.querySelector("#timer");
const messageEl = document.querySelector("#message");
const newGameButton = document.querySelector("#newGame");
const levelButtons = document.querySelectorAll(".level");

let level = "easy";
let cells = [];
let started = false;
let ended = false;
let flags = 0;
let opened = 0;
let seconds = 0;
let timerId = null;
let pressTimer = null;

function createGame(nextLevel = level) {
  level = nextLevel;
  const { size, mines } = LEVELS[level];
  cells = Array.from({ length: size * size }, (_, index) => ({
    index,
    mine: false,
    open: false,
    flagged: false,
    neighbor: 0,
  }));
  started = false;
  ended = false;
  flags = 0;
  opened = 0;
  seconds = 0;
  clearInterval(timerId);
  timerId = null;
  timerEl.textContent = "0";
  mineCountEl.textContent = mines;
  messageEl.textContent = "先点一格开始，右键或长按可以插旗。";
  boardEl.style.setProperty("--size", size);
  render();
}

function placeMines(safeIndex) {
  const { size, mines } = LEVELS[level];
  const safeZone = new Set([safeIndex, ...neighborsOf(safeIndex, size)]);
  const candidates = cells
    .map((cell) => cell.index)
    .filter((index) => !safeZone.has(index));

  shuffle(candidates);
  candidates.slice(0, mines).forEach((index) => {
    cells[index].mine = true;
  });

  cells.forEach((cell) => {
    cell.neighbor = neighborsOf(cell.index, size).filter((index) => cells[index].mine).length;
  });
}

function neighborsOf(index, size) {
  const row = Math.floor(index / size);
  const col = index % size;
  const result = [];

  for (let rowDelta = -1; rowDelta <= 1; rowDelta += 1) {
    for (let colDelta = -1; colDelta <= 1; colDelta += 1) {
      if (rowDelta === 0 && colDelta === 0) continue;
      const nextRow = row + rowDelta;
      const nextCol = col + colDelta;
      if (nextRow >= 0 && nextRow < size && nextCol >= 0 && nextCol < size) {
        result.push(nextRow * size + nextCol);
      }
    }
  }

  return result;
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
}

function startTimer() {
  timerId = setInterval(() => {
    seconds += 1;
    timerEl.textContent = seconds;
  }, 1000);
}

function openCell(index) {
  const cell = cells[index];
  if (ended || cell.open || cell.flagged) return;

  if (!started) {
    started = true;
    placeMines(index);
    startTimer();
  }

  if (cell.mine) {
    cell.open = true;
    revealMines();
    finish(false);
    return;
  }

  floodOpen(index);
  checkWin();
  render();
}

function floodOpen(startIndex) {
  const { size } = LEVELS[level];
  const queue = [startIndex];
  const seen = new Set();

  while (queue.length) {
    const index = queue.shift();
    const cell = cells[index];
    if (seen.has(index) || cell.open || cell.flagged || cell.mine) continue;
    seen.add(index);
    cell.open = true;
    opened += 1;

    if (cell.neighbor === 0) {
      neighborsOf(index, size).forEach((neighborIndex) => queue.push(neighborIndex));
    }
  }
}

function toggleFlag(index) {
  const cell = cells[index];
  if (ended || cell.open) return;
  cell.flagged = !cell.flagged;
  flags += cell.flagged ? 1 : -1;
  mineCountEl.textContent = LEVELS[level].mines - flags;
  render();
}

function revealMines() {
  cells.forEach((cell) => {
    if (cell.mine) cell.open = true;
  });
  render();
}

function checkWin() {
  const { mines } = LEVELS[level];
  if (opened === cells.length - mines) {
    finish(true);
  }
}

function finish(won) {
  ended = true;
  clearInterval(timerId);
  timerId = null;
  messageEl.textContent = won ? `漂亮，用 ${seconds} 秒清空雷区。` : "踩到雷了，再来一局很快。";
}

function render() {
  boardEl.innerHTML = "";
  const fragment = document.createDocumentFragment();

  cells.forEach((cell) => {
    const button = document.createElement("button");
    button.className = "cell";
    button.type = "button";
    button.dataset.index = cell.index;
    button.setAttribute("aria-label", cellLabel(cell));

    if (cell.open) {
      button.classList.add("is-open");
      if (cell.mine) {
        button.classList.add("is-mine");
        button.textContent = "*";
      } else if (cell.neighbor > 0) {
        button.textContent = cell.neighbor;
        button.dataset.neighbor = cell.neighbor;
      }
    } else if (cell.flagged) {
      button.classList.add("is-flagged");
      button.textContent = "!";
    }

    fragment.append(button);
  });

  boardEl.append(fragment);
}

function cellLabel(cell) {
  if (cell.open && cell.mine) return "地雷";
  if (cell.open && cell.neighbor > 0) return `附近 ${cell.neighbor} 个雷`;
  if (cell.open) return "空格";
  if (cell.flagged) return "已插旗";
  return "未打开";
}

boardEl.addEventListener("click", (event) => {
  const button = event.target.closest(".cell");
  if (!button) return;
  openCell(Number(button.dataset.index));
});

boardEl.addEventListener("contextmenu", (event) => {
  const button = event.target.closest(".cell");
  if (!button) return;
  event.preventDefault();
  toggleFlag(Number(button.dataset.index));
});

boardEl.addEventListener("pointerdown", (event) => {
  const button = event.target.closest(".cell");
  if (!button || event.pointerType === "mouse") return;
  pressTimer = setTimeout(() => {
    toggleFlag(Number(button.dataset.index));
    pressTimer = null;
  }, 420);
});

boardEl.addEventListener("pointerup", () => clearTimeout(pressTimer));
boardEl.addEventListener("pointercancel", () => clearTimeout(pressTimer));

newGameButton.addEventListener("click", () => createGame());

levelButtons.forEach((button) => {
  button.addEventListener("click", () => {
    levelButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    createGame(button.dataset.level);
  });
});

createGame();
