const shortcuts = { h: "home", p: "projects", e: "experience", b: "education", s: "skills", a: "achievements" };

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || event.target.matches("input, textarea, select, [contenteditable='true']")) return;
  if (!document.getElementById("game-modal").hidden) return;

  const section = shortcuts[event.key.toLowerCase()];
  if (section && !event.repeat) document.getElementById(section).scrollIntoView({ behavior: "smooth" });
});

const modal = document.getElementById("game-modal");
const board = document.getElementById("game-board");
const hud = document.getElementById("game-status");
const ctx = board.getContext("2d");
const keys = new Set();
const maxBombs = 3;
const bombRefillSeconds = 10;
const decks = [[0, 100, 46], [12, 40, 36], [59, 88, 36], [36, 65, 26], [8, 31, 17], [69, 94, 17]];
let game, frame, lastTime;

function restartGame() {
  cancelAnimationFrame(frame);
  keys.clear();
  game = {
    player: { x: 50, y: 46, vy: 0, grounded: true, face: 1 },
    alive: true, bombs: maxBombs, nextBombAt: 0, kills: 0, time: 0, nextSpawn: 1, spawned: 0,
    cooldown: 0, enemies: [], shots: [], charges: [], blasts: []
  };
  spawnEnemy();
  lastTime = performance.now();
  board.focus();
  frame = requestAnimationFrame(tick);
}

function spawnEnemy() {
  const left = game.spawned++ % 2 === 1;
  game.enemies.push({ x: left ? 2 : 98, y: game.player.y - 1 });
}

function shoot() {
  if (game.cooldown > 0) return;
  const p = game.player;
  game.shots.push({ x: p.x + p.face * 2, y: p.y - 1, dx: p.face * 85 });
  game.cooldown = 0.19;
}

function throwBomb() {
  if (!game.bombs) return;
  if (game.bombs === maxBombs) game.nextBombAt = game.time + bombRefillSeconds;
  game.bombs--;
  const p = game.player;
  game.charges.push({ x: p.x, y: p.y - 2, dx: p.face * 16, vy: -19, fuse: 0.65 });
}

function step(dt) {
  const p = game.player;
  game.time += dt;
  if (game.bombs < maxBombs && game.time >= game.nextBombAt) {
    game.bombs++;
    game.nextBombAt += bombRefillSeconds;
  }
  game.cooldown -= dt;
  const right = keys.has("d") || keys.has("arrowright");
  const left = keys.has("a") || keys.has("arrowleft");
  const move = Number(right) - Number(left);
  if (move) p.face = move;
  p.x = Math.max(2, Math.min(98, p.x + move * 30 * dt));
  const previous = p.y;
  p.vy += 75 * dt;
  p.y += p.vy * dt;
  p.grounded = false;
  for (const [from, to, y] of decks) {
    if (p.x >= from && p.x <= to && previous <= y && p.y >= y && p.vy >= 0) {
      p.y = y;
      p.vy = 0;
      p.grounded = true;
    }
  }
  if (keys.has(" ")) shoot();
  if (game.time >= game.nextSpawn) {
    spawnEnemy();
    game.nextSpawn = game.time + Math.max(0.65, 2.8 - game.time / 55);
  }
  for (const e of game.enemies) {
    e.x += Math.sign(p.x - e.x) * Math.min(Math.abs(p.x - e.x), 8 * dt);
    e.y += Math.sign(p.y - 1 - e.y) * Math.min(Math.abs(p.y - 1 - e.y), 3.5 * dt);
  }
  game.shots = game.shots.filter(s => {
    s.x += s.dx * dt;
    const hit = game.enemies.findIndex(e => Math.abs(e.x - s.x) < 2 && Math.abs(e.y - s.y) < 1.7);
    if (hit < 0) return s.x > 0 && s.x < 100;
    game.enemies.splice(hit, 1);
    game.kills++;
    return false;
  });
  game.blasts = game.blasts.filter(b => (b.life -= dt) > 0);
  game.charges = game.charges.filter(b => {
    b.x = Math.max(1, Math.min(99, b.x + b.dx * dt));
    b.vy += 48 * dt;
    b.y = Math.min(45, b.y + b.vy * dt);
    b.fuse -= dt;
    if (b.fuse > 0) return true;
    const before = game.enemies.length;
    game.enemies = game.enemies.filter(e => Math.hypot(e.x - b.x, e.y - b.y) > 12);
    game.kills += before - game.enemies.length;
    game.blasts.push({ x: b.x, y: b.y, life: 0.28 });
    return false;
  });
  if (game.enemies.some(e => Math.hypot(e.x - p.x, e.y - p.y + 1) < 2.3)) {
    game.alive = false;
  }
}

function draw() {
  const width = board.clientWidth, height = board.clientHeight;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  if (board.width !== Math.round(width * ratio) || board.height !== Math.round(height * ratio)) {
    board.width = Math.round(width * ratio);
    board.height = Math.round(height * ratio);
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const font = Math.max(9, Math.min(width / 58, height / 22));
  ctx.font = 'bold ' + font + 'px monospace';
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  function glyph(text, x, y, color) {
    ctx.fillStyle = color;
    ctx.fillText(text, width * x / 100, height * y / 50);
  }
  for (const [from, to, y] of decks) {
    const chars = Math.max(1, Math.floor((to - from) * width / (100 * ctx.measureText("=").width)));
    glyph("=".repeat(chars), (from + to) / 2, y + 0.45, "#949283");
    if (from > 0) glyph("|".padEnd(chars - 1, " ") + "|", (from + to) / 2, y + 1.6, "#59584f");
  }
  for (const e of game.enemies) glyph("<x>", e.x, e.y, "#b6b1a4");
  for (const s of game.shots) glyph("-", s.x, s.y, "#fff");
  for (const b of game.charges) glyph("o", b.x, b.y, "#fff");
  for (const b of game.blasts) {
    const radius = 12 * (1 - b.life / 0.3);
    for (let i = 0; i < 16; i++) glyph("*", b.x + radius * Math.cos(i * Math.PI / 8), b.y + radius * Math.sin(i * Math.PI / 8), "#ebe1c7");
  }
  const p = game.player;
  glyph(p.face === 1 ? "@>" : "<@", p.x, p.y - 1, "#fff5df");
  const refill = game.alive && game.bombs < maxBombs
    ? ` (+1 in ${Math.ceil(game.nextBombAt - game.time)}s)` : "";
  hud.textContent = `Bombs ${game.bombs}/${maxBombs}${refill} · Score ${game.kills}`;
  if (!game.alive) glyph("GAME OVER  /  R to retry", 50, 9, "#fff5df");
}

function tick(now) {
  step(Math.min(1 / 30, Math.max(0, (now - lastTime) / 1000)));
  lastTime = now;
  draw();
  if (game.alive) frame = requestAnimationFrame(tick);
}

function openGame() {
  modal.hidden = false;
  document.body.classList.add("game-active");
  restartGame();
}

function closeGame() {
  cancelAnimationFrame(frame);
  keys.clear();
  modal.hidden = true;
  document.body.classList.remove("game-active");
  document.getElementById("open-game").focus();
}

document.addEventListener("keydown", event => {
  if (modal.hidden || event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key.toLowerCase();
  if (key === "p") return closeGame();
  if (key === "r" && !event.repeat) return restartGame();
  if (!game.alive || !["arrowleft", "arrowright", "arrowup", "a", "d", "w", " ", "b"].includes(key)) return;
  if (key === " " && event.target.tagName === "BUTTON") return;
  event.preventDefault();
  keys.add(key);
  if (event.repeat) return;
  if (key === "b") throwBomb();
  if (key === " ") shoot();
  if ((key === "w" || key === "arrowup") && game.player.grounded) {
    game.player.vy = -44;
    game.player.grounded = false;
  }
});
document.addEventListener("keyup", event => keys.delete(event.key.toLowerCase()));
window.addEventListener("blur", () => keys.clear());
