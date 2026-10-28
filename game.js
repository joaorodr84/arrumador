const TILE = 48;
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const el = (id) => document.getElementById(id);

const DIRS = {
  ArrowUp: [0, -1], w: [0, -1],
  ArrowDown: [0, 1], s: [0, 1],
  ArrowLeft: [-1, 0], a: [-1, 0],
  ArrowRight: [1, 0], d: [1, 0],
};

let levelIndex = 0;
let state = null;
let history = [];

function load(index) {
  levelIndex = index;
  const map = LEVELS[index].map;
  const h = map.length;
  const w = Math.max(...map.map((r) => r.length));
  const walls = new Set(), goals = new Set(), boxes = new Set();
  let player = null;
  map.forEach((row, y) => [...row].forEach((c, x) => {
    const k = y * w + x;
    if (c === "#") walls.add(k);
    if (".+*".includes(c)) goals.add(k);
    if ("$*".includes(c)) boxes.add(k);
    if ("@+".includes(c)) player = k;
  }));
  state = { w, h, walls, goals, boxes, player, moves: 0 };
  history = [];
  canvas.width = w * TILE;
  canvas.height = h * TILE;
  el("message").textContent = "";
  el("level-name").textContent = LEVELS[index].name;
  el("level-num").textContent = index + 1;
  el("level-total").textContent = LEVELS.length;
  el("prev").disabled = index === 0;
  el("next").disabled = index === LEVELS.length - 1;
  updateHud();
  draw();
}

function isWon() {
  return [...state.boxes].every((b) => state.goals.has(b));
}

function move(dx, dy) {
  if (isWon()) return;
  const { w, h, walls, boxes, player } = state;
  const px = player % w, py = (player / w) | 0;
  const nx = px + dx, ny = py + dy;
  if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
  const n = ny * w + nx;
  if (walls.has(n)) return;
  const snapshot = { player, boxes: new Set(boxes), moves: state.moves };
  if (boxes.has(n)) {
    const bx = nx + dx, by = ny + dy;
    if (bx < 0 || by < 0 || bx >= w || by >= h) return;
    const t = by * w + bx;
    if (walls.has(t) || boxes.has(t)) return;
    boxes.delete(n);
    boxes.add(t);
  }
  history.push(snapshot);
  state.player = n;
  state.moves++;
  updateHud();
  draw();
  if (isWon()) {
    const last = levelIndex === LEVELS.length - 1;
    el("message").textContent = last
      ? "Tudo arrumado! Você completou todos os níveis."
      : "Nível completo! Pressione Próximo.";
  }
}

function undo() {
  const prev = history.pop();
  if (!prev) return;
  Object.assign(state, prev);
  el("message").textContent = "";
  updateHud();
  draw();
}

function updateHud() {
  el("moves").textContent = state.moves;
}

function draw() {
  const { w, h, walls, goals, boxes, player } = state;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      const px = x * TILE, py = y * TILE;
      if (walls.has(k)) {
        ctx.fillStyle = "#5b5675";
        ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = "#47435e";
        ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
      } else if (isFloor(x, y)) {
        ctx.fillStyle = "#2b2840";
        ctx.fillRect(px, py, TILE, TILE);
      }
      if (goals.has(k)) {
        ctx.fillStyle = "#e8a33d";
        ctx.beginPath();
        ctx.arc(px + TILE / 2, py + TILE / 2, TILE / 8, 0, Math.PI * 2);
        ctx.fill();
      }
      if (boxes.has(k)) {
        ctx.fillStyle = goals.has(k) ? "#6fbf73" : "#b5733a";
        ctx.fillRect(px + 5, py + 5, TILE - 10, TILE - 10);
        ctx.strokeStyle = "#3d2713";
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 5, py + 5, TILE - 10, TILE - 10);
        ctx.beginPath();
        ctx.moveTo(px + 5, py + 5);
        ctx.lineTo(px + TILE - 5, py + TILE - 5);
        ctx.moveTo(px + TILE - 5, py + 5);
        ctx.lineTo(px + 5, py + TILE - 5);
        ctx.stroke();
      }
    }
  }
  const x = player % w, y = (player / w) | 0;
  ctx.fillStyle = "#f2ecdc";
  ctx.beginPath();
  ctx.arc(x * TILE + TILE / 2, y * TILE + TILE / 2, TILE / 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1d1b2a";
  ctx.fillRect(x * TILE + TILE / 2 - 8, y * TILE + TILE / 2 - 6, 4, 4);
  ctx.fillRect(x * TILE + TILE / 2 + 4, y * TILE + TILE / 2 - 6, 4, 4);
}

// A cell is floor if it is not a wall and lies inside the outer walls.
// Cells outside the walls (blank map padding) stay unpainted.
function isFloor(x, y) {
  const { w, h, walls } = state;
  if (walls.has(y * w + x)) return false;
  const row = LEVELS[levelIndex].map[y];
  if (x >= row.length) return false;
  const rowWalls = [...row].map((c, i) => (c === "#" ? i : -1)).filter((i) => i >= 0);
  return rowWalls.length > 0 && x > rowWalls[0] && x < rowWalls[rowWalls.length - 1];
}

document.addEventListener("keydown", (e) => {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (DIRS[key]) {
    e.preventDefault();
    move(...DIRS[key]);
  } else if (key === "z") {
    undo();
  } else if (key === "r") {
    load(levelIndex);
  }
});

el("undo").addEventListener("click", undo);
el("restart").addEventListener("click", () => load(levelIndex));
el("prev").addEventListener("click", () => load(levelIndex - 1));
el("next").addEventListener("click", () => load(levelIndex + 1));

load(0);
