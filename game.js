const TILE = 64;
const MOVE_MS = 90;
const SAVE_KEY = "arrumador.v1";

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const $ = (id) => document.getElementById(id);

const KEYS = {
  ArrowUp: [0, -1], w: [0, -1],
  ArrowDown: [0, 1], s: [0, 1],
  ArrowLeft: [-1, 0], a: [-1, 0],
  ArrowRight: [1, 0], d: [1, 0],
};

const RULES = {
  pt: {
    title: "Como jogar",
    items: [
      "Você é o arrumador do armazém. Seu objetivo é levar <b>todas as caixas</b> até os <b>alvos</b> marcados no chão.",
      "Mova-se com as <b>setas</b> ou <b>WASD</b>. No celular, deslize o dedo sobre o tabuleiro.",
      "Para mover uma caixa, ande contra ela: você a <b>empurra</b> um quadrado.",
      "Você só pode empurrar <b>uma caixa por vez</b>. Duas caixas seguidas não se movem.",
      "Caixas <b>não podem ser puxadas</b>, e não atravessam paredes nem outras caixas.",
      "Cuidado com os cantos: uma caixa encostada em um canto fica presa para sempre. Use <b>Z</b> para desfazer ou <b>R</b> para reiniciar.",
      "O nível termina quando todas as caixas estão sobre alvos (ficam verdes). Quanto <b>menos movimentos</b>, melhor.",
    ],
    close: "Entendi",
  },
  en: {
    title: "How to play",
    items: [
      "You are the warehouse keeper. Your goal is to move <b>every crate</b> onto a <b>target</b> marked on the floor.",
      "Move with the <b>arrow keys</b> or <b>WASD</b>. On a phone, swipe on the board.",
      "To move a crate, walk into it: you <b>push</b> it one square.",
      "You can only push <b>one crate at a time</b>. Two crates in a row will not move.",
      "Crates <b>cannot be pulled</b>, and they cannot pass through walls or other crates.",
      "Watch the corners: a crate pushed into a corner is stuck for good. Press <b>Z</b> to undo or <b>R</b> to restart.",
      "The level is complete when every crate is on a target (they turn green). Fewer <b>moves</b> is better.",
    ],
    close: "Got it",
  },
};

function readSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && typeof s === "object") return { best: s.best || {}, level: s.level || 0, seenRules: !!s.seenRules };
  } catch (e) { /* storage unavailable */ }
  return { best: {}, level: 0, seenRules: false };
}
const save = readSave();
function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
}

let levelIndex = 0;
let state = null;
let history = [];
let animFrame = 0;

function load(index) {
  levelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
  const map = LEVELS[levelIndex].map;
  const h = map.length;
  const w = Math.max(...map.map((r) => r.length));
  const walls = new Set(), goals = new Set(), boxes = new Set();
  let player = 0;
  map.forEach((row, y) => [...row].forEach((c, x) => {
    const k = y * w + x;
    if (c === "#") walls.add(k);
    if (".+*".includes(c)) goals.add(k);
    if ("$*".includes(c)) boxes.add(k);
    if ("@+".includes(c)) player = k;
  }));

  // floor = everything the player can walk to; walls are drawn only next to floor
  const floor = new Set([player]);
  const stack = [player];
  while (stack.length) {
    const c = stack.pop();
    const x = c % w, y = (c / w) | 0;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = ny * w + nx;
      if (!walls.has(n) && !floor.has(n)) { floor.add(n); stack.push(n); }
    }
  }
  const shownWalls = new Set();
  for (const k of walls) {
    const x = k % w, y = (k / w) | 0;
    let near = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && floor.has(ny * w + nx)) near = true;
    }
    if (near) shownWalls.add(k);
  }

  state = { w, h, walls: shownWalls, solid: walls, floor, goals, boxes, player, moves: 0, facing: [0, 1], anim: null, won: false };
  history = [];
  canvas.width = w * TILE;
  canvas.height = h * TILE;
  $("win").classList.add("hidden");
  $("level-name").textContent = LEVELS[levelIndex].name;
  $("level-num").textContent = levelIndex + 1;
  $("level-total").textContent = LEVELS.length;
  $("prev").disabled = levelIndex === 0;
  $("next").disabled = levelIndex === LEVELS.length - 1;
  save.level = levelIndex;
  writeSave();
  updateHud();
  render();
}

function updateHud() {
  $("moves").textContent = state.moves;
  const best = save.best[levelIndex];
  $("best").textContent = best ? best : "-";
}

function allOnGoals() {
  for (const b of state.boxes) if (!state.goals.has(b)) return false;
  return true;
}

function move(dx, dy) {
  if (state.won) return;
  const { w, h, solid, boxes, player } = state;
  state.facing = [dx, dy];
  const px = player % w, py = (player / w) | 0;
  const nx = px + dx, ny = py + dy;
  if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
  const n = ny * w + nx;
  if (solid.has(n)) return;
  const snapshot = { player, boxes: new Set(boxes), moves: state.moves };
  let pushed = null;
  if (boxes.has(n)) {
    const bx = nx + dx, by = ny + dy;
    if (bx < 0 || by < 0 || bx >= w || by >= h) return;
    const t = by * w + bx;
    if (solid.has(t) || boxes.has(t)) return;
    boxes.delete(n);
    boxes.add(t);
    pushed = { from: n, to: t };
  }
  history.push(snapshot);
  state.anim = { start: performance.now(), fromPlayer: player, pushed };
  state.player = n;
  state.moves++;
  updateHud();
  startLoop();
  if (allOnGoals()) {
    state.won = true;
    setTimeout(showWin, 320);
  }
}

function undo() {
  const prev = history.pop();
  if (!prev) return;
  state.player = prev.player;
  state.boxes = prev.boxes;
  state.moves = prev.moves;
  state.anim = null;
  state.won = false;
  $("win").classList.add("hidden");
  updateHud();
  render();
}

function showWin() {
  const prevBest = save.best[levelIndex];
  const record = !prevBest || state.moves < prevBest;
  if (record) save.best[levelIndex] = state.moves;
  writeSave();
  updateHud();
  const last = levelIndex === LEVELS.length - 1;
  $("win-title").textContent = last ? "Tudo arrumado!" : "Nível completo!";
  $("win-text").textContent =
    `${state.moves} movimentos` + (record ? (prevBest ? " — novo recorde!" : " — primeiro recorde!") : ` (recorde: ${prevBest})`) +
    (last ? ". Você completou todos os níveis." : "");
  $("win-next").style.display = last ? "none" : "";
  $("win").classList.remove("hidden");
  if (!last) $("win-next").focus();
}

/* ---------- rendering ---------- */

function startLoop() {
  cancelAnimationFrame(animFrame);
  const tick = (now) => {
    render(now);
    if (state.anim && now - state.anim.start < MOVE_MS) animFrame = requestAnimationFrame(tick);
    else { state.anim = null; render(now); }
  };
  animFrame = requestAnimationFrame(tick);
}

function ease(t) { return t * (2 - t); }

function render(now = performance.now()) {
  const { w, h, walls, floor, goals, boxes, player, anim } = state;
  const p = anim ? ease(Math.min(1, (now - anim.start) / MOVE_MS)) : 1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      if (walls.has(k)) drawWall(x, y, k);
      else if (floor.has(k)) drawFloor(x, y);
    }
  }
  for (const g of goals) drawGoal(g % w, (g / w) | 0);

  const boxList = [...boxes].sort((a, b) => a - b);
  for (const b of boxList) {
    let bx = b % w, by = (b / w) | 0;
    if (anim && anim.pushed && anim.pushed.to === b) {
      const fx = anim.pushed.from % w, fy = (anim.pushed.from / w) | 0;
      bx = fx + (bx - fx) * p;
      by = fy + (by - fy) * p;
    }
    drawBox(bx, by, goals.has(b));
  }

  let ux = player % w, uy = (player / w) | 0;
  if (anim) {
    const fx = anim.fromPlayer % w, fy = (anim.fromPlayer / w) | 0;
    ux = fx + (ux - fx) * p;
    uy = fy + (uy - fy) * p;
  }
  drawPlayer(ux, uy, state.facing);
}

function drawFloor(x, y) {
  const px = x * TILE, py = y * TILE;
  ctx.fillStyle = (x + y) % 2 ? "#3b3554" : "#373150";
  ctx.fillRect(px, py, TILE, TILE);
  ctx.strokeStyle = "rgba(255,255,255,0.045)";
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
}

function drawWall(x, y, k) {
  const px = x * TILE, py = y * TILE;
  const g = ctx.createLinearGradient(px, py, px, py + TILE);
  g.addColorStop(0, "#7a6ea0");
  g.addColorStop(1, "#5a4f7c");
  ctx.fillStyle = g;
  ctx.fillRect(px, py, TILE, TILE);
  // bricks: two courses per tile, offset on alternate rows
  ctx.strokeStyle = "rgba(25,18,45,0.55)";
  ctx.lineWidth = 2;
  const half = TILE / 2;
  ctx.beginPath();
  ctx.moveTo(px, py + half); ctx.lineTo(px + TILE, py + half);
  ctx.moveTo(px + half, py); ctx.lineTo(px + half, py + half);
  ctx.moveTo(px + TILE / 4, py + half); ctx.lineTo(px + TILE / 4, py + TILE);
  ctx.moveTo(px + (TILE * 3) / 4, py + half); ctx.lineTo(px + (TILE * 3) / 4, py + TILE);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(px, py, TILE, 3);
  ctx.strokeStyle = "rgba(20,12,40,0.6)";
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
}

function drawGoal(x, y) {
  const cx = x * TILE + TILE / 2, cy = y * TILE + TILE / 2, r = TILE * 0.26;
  ctx.save();
  ctx.shadowColor = "rgba(240,169,59,0.7)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "rgba(240,169,59,0.22)";
  ctx.strokeStyle = "#f0a93b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBox(x, y, onGoal) {
  const px = x * TILE + 6, py = y * TILE + 6, s = TILE - 12;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  const g = ctx.createLinearGradient(px, py, px, py + s);
  if (onGoal) { g.addColorStop(0, "#8fe39a"); g.addColorStop(1, "#4fa660"); }
  else { g.addColorStop(0, "#dba15a"); g.addColorStop(1, "#b0702f"); }
  ctx.fillStyle = g;
  roundRect(px, py, s, s, 6);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = onGoal ? "#1f5a2c" : "#5a3410";
  ctx.lineWidth = 3;
  roundRect(px, py, s, s, 6);
  ctx.stroke();
  // planks and braces
  ctx.lineWidth = 2;
  ctx.strokeStyle = onGoal ? "rgba(31,90,44,0.7)" : "rgba(90,52,16,0.7)";
  ctx.beginPath();
  ctx.moveTo(px + 6, py + 6); ctx.lineTo(px + s - 6, py + s - 6);
  ctx.moveTo(px + s - 6, py + 6); ctx.lineTo(px + 6, py + s - 6);
  ctx.stroke();
  ctx.strokeRect(px + 7, py + 7, s - 14, s - 14);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(px + 5, py + 4, s - 10, 3);
}

function drawPlayer(x, y, facing) {
  const cx = x * TILE + TILE / 2, cy = y * TILE + TILE / 2 + 2, r = TILE * 0.31;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.95, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  // body
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r);
  g.addColorStop(0, "#fff7e4");
  g.addColorStop(1, "#d9cfb2");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#8f866c";
  ctx.lineWidth = 2;
  ctx.stroke();
  // eyes look toward the facing direction
  const [fx, fy] = facing;
  const ex = fx * r * 0.28, ey = fy * r * 0.2 + r * 0.05;
  ctx.fillStyle = "#1d1b2a";
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx + sx * r * 0.34 + ex, cy + ey - r * 0.05, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  // hard hat
  ctx.fillStyle = "#f0a93b";
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.35, r * 0.82, Math.PI * 1.08, Math.PI * 1.92);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#a96a0c";
  ctx.stroke();
  ctx.fillStyle = "#c98414";
  ctx.fillRect(cx - r * 0.95, cy - r * 0.42, r * 1.9, r * 0.14);
  ctx.restore();
}

/* ---------- UI ---------- */

function openModal(id) { $(id).classList.remove("hidden"); }
function closeModals() {
  $("rules-modal").classList.add("hidden");
  $("levels-modal").classList.add("hidden");
}
function anyModalOpen() {
  return !$("rules-modal").classList.contains("hidden") || !$("levels-modal").classList.contains("hidden");
}

function setRulesLang(lang) {
  const r = RULES[lang];
  $("rules-title").textContent = r.title;
  $("rules-list").innerHTML = r.items.map((t) => `<li>${t}</li>`).join("");
  document.querySelector("#rules-modal [data-close]").textContent = r.close;
  $("lang-pt").classList.toggle("active", lang === "pt");
  $("lang-en").classList.toggle("active", lang === "en");
}

function openRules() { setRulesLang($("lang-en").classList.contains("active") ? "en" : "pt"); openModal("rules-modal"); }

function openLevels() {
  const grid = $("level-grid");
  grid.innerHTML = "";
  LEVELS.forEach((l, i) => {
    const b = document.createElement("button");
    b.textContent = i + 1;
    b.title = l.name;
    if (save.best[i]) b.classList.add("done");
    if (i === levelIndex) b.classList.add("current");
    b.addEventListener("click", () => { closeModals(); load(i); });
    grid.appendChild(b);
  });
  openModal("levels-modal");
}

document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (key === "Escape") { closeModals(); return; }
  if (anyModalOpen()) return;
  if (KEYS[key]) { e.preventDefault(); move(...KEYS[key]); }
  else if (key === "z" || key === "u") undo();
  else if (key === "r") load(levelIndex);
  else if (key === "n" && levelIndex < LEVELS.length - 1) load(levelIndex + 1);
  else if (key === "p" && levelIndex > 0) load(levelIndex - 1);
  else if (key === "Enter" && state.won && levelIndex < LEVELS.length - 1) load(levelIndex + 1);
  else if (key === "?" || key === "h") openRules();
});

// swipe controls
let touch = null;
const stage = $("stage");
stage.addEventListener("touchstart", (e) => {
  const t = e.changedTouches[0];
  touch = { x: t.clientX, y: t.clientY };
}, { passive: true });
stage.addEventListener("touchend", (e) => {
  if (!touch) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touch.x, dy = t.clientY - touch.y;
  touch = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1, 0);
  else move(0, dy > 0 ? 1 : -1);
}, { passive: true });
stage.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

$("undo").addEventListener("click", undo);
$("restart").addEventListener("click", () => load(levelIndex));
$("prev").addEventListener("click", () => load(levelIndex - 1));
$("next").addEventListener("click", () => load(levelIndex + 1));
$("levels").addEventListener("click", openLevels);
$("rules").addEventListener("click", openRules);
$("win-retry").addEventListener("click", () => load(levelIndex));
$("win-next").addEventListener("click", () => load(levelIndex + 1));
$("lang-pt").addEventListener("click", () => setRulesLang("pt"));
$("lang-en").addEventListener("click", () => setRulesLang("en"));
document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeModals));
document.querySelectorAll(".modal").forEach((m) =>
  m.addEventListener("click", (e) => { if (e.target === m) closeModals(); }));

load(save.level < LEVELS.length ? save.level : 0);
if (!save.seenRules) {
  save.seenRules = true;
  writeSave();
  openRules();
}
