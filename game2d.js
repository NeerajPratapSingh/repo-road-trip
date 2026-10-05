// game2d.js — Repo Village: a cozy top-down town where each shop is a repo.
import { fetchGitHubData, colorForLanguage } from "./github.js";

/* ------------------------------------------------------------------ */
/*  Start screen                                                       */
/* ------------------------------------------------------------------ */
const el = (id) => document.getElementById(id);
const startScreen = el("start");
const usernameInput = el("username");
const startBtn = el("startBtn");
const startError = el("startError");
const loading = el("loading");

startBtn.addEventListener("click", start);
usernameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") start(); });

async function start() {
  const username = usernameInput.value.trim();
  if (!username) return;
  startError.textContent = "";
  loading.style.display = "block";
  startBtn.disabled = true;
  try {
    const data = await fetchGitHubData(username);
    if (!data.repos.length) throw new Error("No public (non-fork) repos found for this user.");
    startScreen.style.display = "none";
    await initGame(data);
  } catch (err) {
    startError.textContent = err.message;
  } finally {
    loading.style.display = "none";
    startBtn.disabled = false;
  }
}

/* Render an emoji into a data URL so KAPLAY can load it as a sprite
   (KAPLAY's text renderer doesn't do colour emoji reliably). */
function emojiURL(emoji, size = 128) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.font = `${Math.floor(size * 0.82)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, size / 2, size / 2 + size * 0.04);
  return c.toDataURL();
}

const NPC_EMOJI = ["🐧", "🐨", "🐱", "🦊", "🐸", "🐼", "🐹", "🐻"];

/* ------------------------------------------------------------------ */
/*  Village                                                            */
/* ------------------------------------------------------------------ */
let paused = false;
let currentNear = null;

async function initGame(data) {
  kaplay({
    global: true,
    canvas: el("game"),
    background: [150, 171, 97], // grass
    pixelDensity: Math.min(window.devicePixelRatio || 1, 2),
  });

  // Preload emoji sprites
  const npcSet = NPC_EMOJI.slice(0, 6);
  await Promise.all([
    loadSprite("hero", emojiURL("🐰")),
    loadSprite("tree", emojiURL("🌳")),
    loadSprite("maple", emojiURL("🍁")),
    loadSprite("bush", emojiURL("🌿")),
    loadSprite("lamp", emojiURL("🏮")),
    ...npcSet.map((e, i) => loadSprite("npc" + i, emojiURL(e))),
  ]);

  // --- Layout
  const COLS = 3;
  const n = data.repos.length;
  const rows = Math.ceil(n / COLS);
  const SX = 250, SY = 270;
  const gridW = COLS * SX, gridH = rows * SY;
  const WORLD_W = gridW + 360;
  const WORLD_H = gridH + 560;
  const startX = (WORLD_W - gridW) / 2 + SX / 2;
  const startY = 200 + SY / 2;

  const COL = {
    plaza: rgb(226, 206, 160),
    plazaEdge: rgb(205, 183, 134),
    wall: rgb(250, 241, 222),
    roof: rgb(179, 83, 60),
    roofDark: rgb(150, 66, 47),
    window: rgb(255, 211, 120),
    door: rgb(110, 74, 48),
    sign: rgb(150, 100, 60),
    ink: rgb(74, 54, 39),
    shadow: rgb(70, 60, 40),
  };

  // --- Plaza (town square)
  add([
    rect(gridW + 220, gridH + 220, { radius: 40 }),
    pos(WORLD_W / 2, 120 + (gridH + 220) / 2),
    anchor("top"),
    color(COL.plaza),
    outline(10, COL.plazaEdge),
    z(0),
  ]);
  // a path down to the entrance
  add([
    rect(120, 340, { radius: 20 }),
    pos(WORLD_W / 2, 120 + gridH + 120),
    anchor("top"),
    color(COL.plaza),
    z(0),
  ]);

  // --- Border trees + autumn leaves
  for (let x = 40; x < WORLD_W; x += 95) {
    addDecor("tree", x, 50, 0.9);
    addDecor("tree", x, WORLD_H - 40, 0.9);
  }
  for (let y = 120; y < WORLD_H - 60; y += 95) {
    addDecor("tree", 40, y, 0.9);
    addDecor("tree", WORLD_W - 40, y, 0.9);
  }
  for (let i = 0; i < 26; i++) {
    addDecor(Math.random() < 0.5 ? "maple" : "bush", rand(70, WORLD_W - 70), rand(90, WORLD_H - 70), rand(0.4, 0.6));
  }

  function addDecor(spr, x, y, sc) {
    add([sprite(spr), pos(x, y), anchor("center"), scale(sc), z(y)]);
  }

  // --- Shops (one per repo)
  const doors = [];
  data.repos.forEach((repo, i) => {
    const col = i % COLS, row = Math.floor(i / COLS);
    const x = startX + col * SX;
    const y = startY + row * SY;
    const [r, g, b] = colorForLanguage(repo.language);
    const awning = rgb(r, g, b);
    const WALL_W = 150, WALL_H = 110;

    // shadow
    add([circle(70), scale(1, 0.32), pos(x, y + 70), anchor("center"), color(COL.shadow), opacity(0.18), z(y - 1)]);
    // wall
    add([rect(WALL_W, WALL_H, { radius: 8 }), pos(x, y), anchor("center"), color(COL.wall), outline(4, COL.roofDark), z(y)]);
    // roof
    add([rect(WALL_W + 16, 30, { radius: 8 }), pos(x, y - WALL_H / 2 - 6), anchor("center"), color(COL.roof), outline(4, COL.roofDark), z(y)]);
    // awning stripe (language colour)
    add([rect(WALL_W, 14), pos(x, y - WALL_H / 2 + 14), anchor("center"), color(awning), z(y + 0.1)]);
    // windows
    add([rect(34, 30, { radius: 5 }), pos(x - 36, y - 8), anchor("center"), color(COL.window), outline(4, COL.door), z(y + 0.1)]);
    add([rect(34, 30, { radius: 5 }), pos(x + 36, y - 8), anchor("center"), color(COL.window), outline(4, COL.door), z(y + 0.1)]);
    // door
    add([rect(38, 50, { radius: 6 }), pos(x, y + WALL_H / 2 - 25), anchor("center"), color(COL.door), z(y + 0.1)]);
    add([circle(3), pos(x + 10, y + WALL_H / 2 - 25), anchor("center"), color(COL.window), z(y + 0.2)]);

    // hanging sign below the shop
    add([rect(170, 44, { radius: 10 }), pos(x, y + WALL_H / 2 + 34), anchor("center"), color(COL.sign), outline(4, COL.roofDark), z(y + 0.1)]);
    add([
      text(repo.name.length > 16 ? repo.name.slice(0, 15) + "…" : repo.name, { size: 17, width: 160, align: "center" }),
      pos(x, y + WALL_H / 2 + 27), anchor("center"), color(rgb(255, 245, 225)), z(y + 0.2),
    ]);
    add([
      text(`★ ${repo.stars} · ${repo.language}`, { size: 12 }),
      pos(x, y + WALL_H / 2 + 45), anchor("center"), color(rgb(235, 220, 190)), z(y + 0.2),
    ]);

    doors.push({ pos: vec2(x, y + WALL_H / 2 + 20), repo });
  });

  // --- A few villager NPCs sitting around for life
  for (let i = 0; i < 6; i++) {
    const nx = rand(startX - 60, startX + (COLS - 1) * SX + 60);
    const ny = rand(startY + 90, startY + (rows - 1) * SY + 150);
    add([sprite("npc" + (i % npcSet.length)), pos(nx, ny), anchor("center"), scale(0.42), z(ny)]);
  }

  // --- Entrance sign: REPO VILLAGE
  add([rect(260, 60, { radius: 12 }), pos(WORLD_W / 2, WORLD_H - 70), anchor("center"), color(COL.sign), outline(5, COL.roofDark), z(WORLD_H)]);
  add([text("REPO VILLAGE", { size: 24 }), pos(WORLD_W / 2, WORLD_H - 70), anchor("center"), color(rgb(255, 245, 225)), z(WORLD_H + 1)]);

  // --- Hero
  const shadow = add([circle(26), scale(1, 0.4), pos(WORLD_W / 2, WORLD_H - 150), anchor("center"), color(COL.shadow), opacity(0.22), z(1)]);
  const hero = add([sprite("hero"), pos(WORLD_W / 2, WORLD_H - 160), anchor("center"), scale(0.48), z(1000)]);

  const SPEED = 230;
  onUpdate(() => {
    if (!paused) {
      let dir = vec2(0, 0);
      if (isKeyDown("left") || isKeyDown("a")) dir.x -= 1;
      if (isKeyDown("right") || isKeyDown("d")) dir.x += 1;
      if (isKeyDown("up") || isKeyDown("w")) dir.y -= 1;
      if (isKeyDown("down") || isKeyDown("s")) dir.y += 1;
      if (dir.len() > 0) {
        dir = dir.unit();
        hero.pos = hero.pos.add(dir.scale(SPEED * dt()));
        hero.pos.x = Math.max(60, Math.min(WORLD_W - 60, hero.pos.x));
        hero.pos.y = Math.max(140, Math.min(WORLD_H - 90, hero.pos.y));
        // little walk bob
        hero.scale = vec2(0.48, 0.48 + Math.sin(time() * 14) * 0.03);
      }
    }
    hero.z = hero.pos.y + 1;
    shadow.pos = vec2(hero.pos.x, hero.pos.y + 22);

    // camera follows, clamped to the world
    const hw = width() / 2, hh = height() / 2;
    camPos(
      Math.max(hw, Math.min(WORLD_W - hw, hero.pos.x)),
      Math.max(hh, Math.min(WORLD_H - hh, hero.pos.y))
    );

    // nearest door
    let near = null, best = 95;
    for (const d of doors) {
      const dist = hero.pos.dist(d.pos);
      if (dist < best) { best = dist; near = d; }
    }
    currentNear = near;
    updatePrompt(near);
  });

  onKeyPress("e", () => { if (!paused && currentNear) openChat(currentNear.repo); });
  onKeyPress("escape", () => { if (paused) closeChat(); });
}

/* ------------------------------------------------------------------ */
/*  HUD prompt                                                         */
/* ------------------------------------------------------------------ */
const promptEl = el("prompt");
function updatePrompt(near) {
  if (paused || !near) { promptEl.classList.add("hidden"); return; }
  promptEl.innerHTML = `Press <kbd>E</kbd> to visit <b>${escapeHtml(near.repo.name)}</b>`;
  promptEl.classList.remove("hidden");
}

/* ------------------------------------------------------------------ */
/*  Chat panel                                                         */
/* ------------------------------------------------------------------ */
const chatEl = el("chat");
const chatTitle = el("chatTitle");
const chatMeta = el("chatMeta");
const chatLog = el("chatLog");
const chatChips = el("chatChips");
const chatInput = el("chatInput");
const chatSend = el("chatSend");
const chatClose = el("chatClose");

let activeRepo = null;
let history = [];

chatSend.addEventListener("click", send);
chatClose.addEventListener("click", closeChat);
chatInput.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });

const SUGGESTIONS = ["What do you do?", "Why are you useful?", "How were you built?", "What's the coolest part?"];

function openChat(repo) {
  paused = true;
  activeRepo = repo;
  history = [];
  chatTitle.textContent = repo.name;
  chatMeta.textContent = `★ ${repo.stars} · ${repo.language}`;
  chatLog.innerHTML = "";
  promptEl.classList.add("hidden");

  addBubble("model", `Hey! I'm ${repo.name}. ${repo.description || "Come on in."} Ask me what I do, why I'm handy, or how I was built.`);

  chatChips.innerHTML = "";
  SUGGESTIONS.forEach((q) => {
    const c = document.createElement("button");
    c.className = "chip"; c.textContent = q;
    c.addEventListener("click", () => { chatInput.value = q; send(); });
    chatChips.appendChild(c);
  });

  chatEl.classList.remove("hidden");
  chatInput.focus();
}

function closeChat() {
  paused = false;
  activeRepo = null;
  chatEl.classList.add("hidden");
}

function addBubble(role, text) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
  return div;
}

async function send() {
  const text = chatInput.value.trim();
  if (!text || !activeRepo) return;
  chatInput.value = "";
  addBubble("user", text);
  history.push({ role: "user", text });

  const typing = addBubble("model typing", "typing…");
  try {
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo: activeRepo, messages: history }),
    });
    const data = await resp.json();
    typing.remove();
    if (!resp.ok) { addBubble("model", `(${data.error || "Something went wrong."})`); return; }
    addBubble("model", data.reply);
    history.push({ role: "model", text: data.reply });
  } catch (err) {
    typing.remove();
    addBubble("model", `(Network error: ${err.message})`);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
