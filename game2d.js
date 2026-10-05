// game2d.js — Repo Village: a cozy Japanese-style town. Each shop is a repo;
// a village elder introduces the owner; visit a shop to chat or browse its files.
import { fetchGitHubData, colorForLanguage, fetchRepoContents, fetchFileText } from "./github.js";

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

let OWNER = "";
let PROFILE = null;

async function start() {
  const username = usernameInput.value.trim();
  if (!username) return;
  startError.textContent = "";
  loading.style.display = "block";
  startBtn.disabled = true;
  try {
    const data = await fetchGitHubData(username);
    if (!data.repos.length) throw new Error("No public (non-fork) repos found for this user.");
    OWNER = data.profile.login;
    PROFILE = data.profile;
    startScreen.style.display = "none";
    await initGame(data);
  } catch (err) {
    startError.textContent = err.message;
  } finally {
    loading.style.display = "none";
    startBtn.disabled = false;
  }
}

/* Emoji → data URL so KAPLAY can load it as a (chunky, pixel-ish) sprite. */
function emojiURL(emoji, size = 64) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.font = `${Math.floor(size * 0.82)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, size / 2, size / 2 + size * 0.04);
  return c.toDataURL();
}

const NPC_EMOJI = ["🐧", "🐨", "🐱", "🦊", "🐸", "🐼"];

/* ------------------------------------------------------------------ */
/*  Village                                                            */
/* ------------------------------------------------------------------ */
let paused = false;
let currentNear = null;

async function initGame(data) {
  kaplay({
    global: true,
    canvas: el("game"),
    background: [120, 150, 92], // mossy grass
    crisp: true,                // pixel-ish, no smoothing
    pixelDensity: 1,
  });

  await Promise.all([
    loadSprite("hero", emojiURL("🐰")),
    loadSprite("elder", emojiURL("🧓")),
    loadSprite("torii", emojiURL("⛩️")),
    loadSprite("lantern", emojiURL("🏮")),
    loadSprite("tree", emojiURL("🌲")),
    loadSprite("maple", emojiURL("🍁")),
    loadSprite("bush", emojiURL("🌸")),
    ...NPC_EMOJI.map((e, i) => loadSprite("npc" + i, emojiURL(e))),
  ]);

  // --- Layout: a vertical main street, shops alternating on each side
  const n = data.repos.length;
  const WORLD_W = 1000;
  const CX = WORLD_W / 2;
  const SIDE = 240;
  const SY = 215;
  const TOP = 300;
  const WORLD_H = TOP + n * SY + 340;

  const COL = {
    street: rgb(222, 205, 168),
    streetEdge: rgb(198, 178, 136),
    paper: rgb(246, 240, 226),
    wood: rgb(92, 62, 42),
    roof: rgb(86, 80, 102),
    roofDark: rgb(62, 57, 78),
    window: rgb(255, 212, 128),
    door: rgb(74, 48, 32),
    sign: rgb(150, 100, 60),
    ink: rgb(74, 54, 39),
    shadow: rgb(50, 44, 30),
  };

  // --- Main street (vertical) + grass borders
  add([rect(160, WORLD_H - 180, { radius: 30 }), pos(CX, 150), anchor("top"), color(COL.street), outline(8, COL.streetEdge), z(0)]);

  // Border trees
  for (let y = 130; y < WORLD_H - 40; y += 90) {
    add([sprite("tree"), pos(70, y), anchor("center"), scale(1.1), z(y)]);
    add([sprite("tree"), pos(WORLD_W - 70, y), anchor("center"), scale(1.1), z(y)]);
  }
  for (let i = 0; i < 24; i++) {
    const spr = Math.random() < 0.5 ? "maple" : "bush";
    add([sprite(spr), pos(rand(110, WORLD_W - 110), rand(180, WORLD_H - 90)), anchor("center"), scale(rand(0.5, 0.75)), z(99999)]);
  }

  // --- Torii gate at the top of the street
  add([sprite("torii"), pos(CX, 150), anchor("center"), scale(2.4), z(160)]);

  // --- Shops
  const doors = [];
  data.repos.forEach((repo, i) => {
    const side = i % 2 === 0 ? 1 : -1;
    const x = CX + side * SIDE + rand(-15, 15);
    const y = TOP + i * SY + rand(-10, 10);
    const [r, g, b] = colorForLanguage(repo.language);
    const awning = rgb(r, g, b);
    const WW = 150, WH = 100;

    // little lane from the street to the shop
    add([rect(SIDE, 40, { radius: 16 }), pos(CX + side * SIDE / 2, y + 36), anchor("center"), color(COL.street), z(0.1)]);

    // shadow
    add([circle(74), scale(1, 0.3), pos(x, y + 66), anchor("center"), color(COL.shadow), opacity(0.18), z(y - 1)]);
    // wall (paper + dark wood frame)
    add([rect(WW, WH, { radius: 6 }), pos(x, y), anchor("center"), color(COL.paper), outline(5, COL.wood), z(y)]);
    // pagoda roof (trapezoid) + ridge + upturned eave tips
    const W = WW / 2 + 22;
    add([polygon([vec2(-W, 8), vec2(W, 8), vec2(W - 26, -22), vec2(-(W - 26), -22)]), pos(x, y - WH / 2), color(COL.roof), outline(4, COL.roofDark), z(y + 0.4)]);
    add([polygon([vec2(-W, 8), vec2(-W - 12, 0), vec2(-W + 8, -4)]), pos(x, y - WH / 2), color(COL.roof), z(y + 0.4)]);
    add([polygon([vec2(W, 8), vec2(W + 12, 0), vec2(W - 8, -4)]), pos(x, y - WH / 2), color(COL.roof), z(y + 0.4)]);
    add([rect(66, 12, { radius: 3 }), pos(x, y - WH / 2 - 24), anchor("center"), color(COL.roofDark), z(y + 0.5)]);
    // windows
    add([rect(32, 28, { radius: 4 }), pos(x - 38, y - 6), anchor("center"), color(COL.window), outline(4, COL.wood), z(y + 0.2)]);
    add([rect(32, 28, { radius: 4 }), pos(x + 38, y - 6), anchor("center"), color(COL.window), outline(4, COL.wood), z(y + 0.2)]);
    // noren curtain (language colour) over the door
    add([rect(50, 20), pos(x, y + 18), anchor("center"), color(awning), z(y + 0.3)]);
    add([rect(3, 20), pos(x, y + 18), anchor("center"), color(COL.paper), z(y + 0.31)]);
    add([rect(3, 20), pos(x - 14, y + 18), anchor("center"), color(COL.paper), z(y + 0.31)]);
    add([rect(3, 20), pos(x + 14, y + 18), anchor("center"), color(COL.paper), z(y + 0.31)]);
    // door
    add([rect(40, 40, { radius: 4 }), pos(x, y + WH / 2 - 16), anchor("center"), color(COL.door), z(y + 0.2)]);
    // hanging lanterns
    add([sprite("lantern"), pos(x - 86, y - 20), anchor("center"), scale(0.55), z(y + 0.6)]);
    add([sprite("lantern"), pos(x + 86, y - 20), anchor("center"), scale(0.55), z(y + 0.6)]);
    // signboard
    add([rect(176, 42, { radius: 10 }), pos(x, y + WH / 2 + 34), anchor("center"), color(COL.sign), outline(4, COL.roofDark), z(y + 0.3)]);
    add([text(repo.name.length > 16 ? repo.name.slice(0, 15) + "…" : repo.name, { size: 16, width: 166, align: "center" }), pos(x, y + WH / 2 + 27), anchor("center"), color(rgb(255, 245, 225)), z(y + 0.4)]);
    add([text(`★ ${repo.stars} · ${repo.language}`, { size: 11 }), pos(x, y + WH / 2 + 45), anchor("center"), color(rgb(235, 220, 190)), z(y + 0.4)]);

    doors.push({ type: "shop", pos: vec2(x, y + WH / 2 + 18), repo });
  });

  // --- Villager NPCs dotted along the street
  for (let i = 0; i < Math.min(n + 2, 8); i++) {
    const sx = CX + rand(-60, 60);
    const sy = TOP + rand(40, (n - 1) * SY + 120);
    add([sprite("npc" + (i % NPC_EMOJI.length)), pos(sx, sy), anchor("center"), scale(0.5), z(sy)]);
  }

  // --- Village elder near the entrance
  const elderPos = vec2(CX + 110, WORLD_H - 220);
  add([circle(26), scale(1, 0.4), pos(elderPos.x, elderPos.y + 22), anchor("center"), color(COL.shadow), opacity(0.2), z(elderPos.y - 1)]);
  add([sprite("elder"), pos(elderPos.x, elderPos.y), anchor("center"), scale(0.62), z(elderPos.y)]);
  add([rect(150, 34, { radius: 8 }), pos(elderPos.x, elderPos.y - 42), anchor("center"), color(COL.sign), outline(3, COL.roofDark), z(elderPos.y + 1)]);
  add([text("Village Elder", { size: 13 }), pos(elderPos.x, elderPos.y - 42), anchor("center"), color(rgb(255, 245, 225)), z(elderPos.y + 2)]);
  const spots = [...doors, { type: "elder", pos: elderPos }];

  // --- Entrance sign
  add([rect(260, 56, { radius: 12 }), pos(CX, WORLD_H - 80), anchor("center"), color(COL.sign), outline(5, COL.roofDark), z(WORLD_H)]);
  add([text("REPO VILLAGE", { size: 22 }), pos(CX, WORLD_H - 80), anchor("center"), color(rgb(255, 245, 225)), z(WORLD_H + 1)]);

  // --- Hero
  const shadow = add([circle(24), scale(1, 0.4), pos(CX, WORLD_H - 128), anchor("center"), color(COL.shadow), opacity(0.22), z(1)]);
  const hero = add([sprite("hero"), pos(CX, WORLD_H - 140), anchor("center"), scale(0.6), z(1000)]);

  const SPEED = 235;
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
        hero.pos.x = Math.max(55, Math.min(WORLD_W - 55, hero.pos.x));
        hero.pos.y = Math.max(130, Math.min(WORLD_H - 70, hero.pos.y));
        hero.scale = vec2(0.6, 0.6 + Math.sin(time() * 14) * 0.04);
      }
    }
    hero.z = hero.pos.y + 1;
    shadow.pos = vec2(hero.pos.x, hero.pos.y + 20);

    // camera: follow, but centre the world when it's smaller than the screen
    const hw = width() / 2, hh = height() / 2;
    const cx = WORLD_W <= width() ? WORLD_W / 2 : Math.max(hw, Math.min(WORLD_W - hw, hero.pos.x));
    const cy = WORLD_H <= height() ? WORLD_H / 2 : Math.max(hh, Math.min(WORLD_H - hh, hero.pos.y));
    camPos(cx, cy);

    // nearest talkable
    let near = null, best = 100;
    for (const s of spots) {
      const d = hero.pos.dist(s.pos);
      if (d < best) { best = d; near = s; }
    }
    currentNear = near;
    updatePrompt(near);
  });

  onKeyPress("e", () => {
    if (paused || !currentNear) return;
    if (currentNear.type === "elder") openElder();
    else openShop(currentNear.repo);
  });
  onKeyPress("escape", () => { if (paused) closeChat(); });
}

/* ------------------------------------------------------------------ */
/*  HUD prompt                                                         */
/* ------------------------------------------------------------------ */
const promptEl = el("prompt");
function updatePrompt(near) {
  if (paused || !near) { promptEl.classList.add("hidden"); return; }
  promptEl.innerHTML = near.type === "elder"
    ? `Press <kbd>E</kbd> to talk to the <b>Village Elder</b>`
    : `Press <kbd>E</kbd> to visit <b>${escapeHtml(near.repo.name)}</b>`;
  promptEl.classList.remove("hidden");
}

/* ------------------------------------------------------------------ */
/*  Panel: elder intro / shop chat + files                             */
/* ------------------------------------------------------------------ */
const chatEl = el("chat");
const chatTitle = el("chatTitle");
const chatMeta = el("chatMeta");
const chatLog = el("chatLog");
const chatChips = el("chatChips");
const chatInput = el("chatInput");
const chatInputRow = el("chatInputRow");
const chatSend = el("chatSend");
const chatClose = el("chatClose");
const chatTabs = el("chatTabs");
const tabChat = el("tabChat");
const tabFiles = el("tabFiles");
const chatView = el("chatView");
const filesView = el("filesView");

let activeRepo = null;
let history = [];

chatSend.addEventListener("click", send);
chatClose.addEventListener("click", closeChat);
chatInput.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
tabChat.addEventListener("click", () => switchTab("chat"));
tabFiles.addEventListener("click", () => switchTab("files"));

const SUGGESTIONS = ["What do you do?", "Why are you useful?", "How were you built?", "What's the coolest part?"];

function switchTab(which) {
  tabChat.classList.toggle("active", which === "chat");
  tabFiles.classList.toggle("active", which === "files");
  chatView.classList.toggle("hidden", which !== "chat");
  filesView.classList.toggle("hidden", which !== "files");
  if (which === "files" && activeRepo) showDir(activeRepo, "");
}

/* ---- Village elder (scripted from the GitHub profile) ---- */
function openElder() {
  paused = true;
  activeRepo = null;
  chatTitle.textContent = "Village Elder";
  chatMeta.textContent = `keeper of @${OWNER}`;
  chatTabs.classList.add("hidden");
  filesView.classList.add("hidden");
  chatView.classList.remove("hidden");
  chatInputRow.classList.add("hidden");
  chatLog.innerHTML = "";

  addBubble("model", `Welcome, traveler. You've reached the village of ${PROFILE.name}. 🍵`);
  if (PROFILE.bio) addBubble("model", `They say of the maker: “${PROFILE.bio}”`);
  addBubble(
    "model",
    `${PROFILE.publicRepos} works line these streets${PROFILE.followers ? `, and ${PROFILE.followers} folk follow the maker` : ""}. Each shop is a project — walk up to a door and press E to step inside, chat with it, or browse its files.`
  );

  chatChips.innerHTML = "";
  const elderQ = [
    ["What should I visit first?", `Follow the lanterns up the main street. The shops nearest the gate are the most-starred — a fine place to begin.`],
    ["Who built all this?", `${PROFILE.name} (@${OWNER}) — a builder of ${PROFILE.publicRepos} works. Wander, and see for yourself.`],
  ];
  elderQ.forEach(([q, a]) => {
    const c = document.createElement("button");
    c.className = "chip"; c.textContent = q;
    c.addEventListener("click", () => { addBubble("user", q); addBubble("model", a); });
    chatChips.appendChild(c);
  });

  chatEl.classList.remove("hidden");
}

/* ---- Shop (chat + files) ---- */
function openShop(repo) {
  paused = true;
  activeRepo = repo;
  history = [];
  chatTitle.textContent = repo.name;
  chatMeta.textContent = `★ ${repo.stars} · ${repo.language}`;
  chatTabs.classList.remove("hidden");
  chatInputRow.classList.remove("hidden");
  switchTab("chat");
  chatLog.innerHTML = "";

  addBubble("model", `Hey! I'm ${repo.name}. ${repo.description || "Come on in."} Ask me what I do, why I'm handy, or how I was built — or hit 📁 Files to look around.`);

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

/* ---- Files browser ---- */
async function showDir(repo, path) {
  filesView.innerHTML = `<div class="files-note">Loading…</div>`;
  try {
    const items = await fetchRepoContents(OWNER, repo.name, path);
    const crumb = `<div class="crumb">${path ? `<button data-up="1">← back</button>` : ""}<span>${repo.name}/${path}</span></div>`;
    const rows = items.map((it, i) => {
      const icon = it.type === "dir" ? "📁" : "📄";
      const size = it.type === "file" && it.size != null ? `<span class="fsize">${fmtSize(it.size)}</span>` : "";
      return `<div class="file-row" data-i="${i}">${icon} <span class="fname">${escapeHtml(it.name)}</span>${size}</div>`;
    }).join("");
    filesView.innerHTML = crumb + (rows || `<div class="files-note">Empty folder.</div>`);

    const up = filesView.querySelector("[data-up]");
    if (up) up.addEventListener("click", () => showDir(repo, path.split("/").slice(0, -1).join("/")));
    filesView.querySelectorAll(".file-row").forEach((rowEl) => {
      const it = items[+rowEl.dataset.i];
      rowEl.addEventListener("click", () => it.type === "dir" ? showDir(repo, it.path) : showFile(repo, it));
    });
  } catch (err) {
    filesView.innerHTML = `<div class="files-note">${escapeHtml(err.message)}</div>`;
  }
}

async function showFile(repo, item) {
  const parent = item.path.split("/").slice(0, -1).join("/");
  if (!item.download_url || /\.(png|jpg|jpeg|gif|webp|ico|pdf|zip|exe|woff2?|ttf|mp4|mp3)$/i.test(item.name)) {
    filesView.innerHTML = `<div class="crumb"><button data-up="1">← back</button><span>${escapeHtml(item.name)}</span></div><div class="files-note">(binary file — open it on GitHub)</div>`;
    filesView.querySelector("[data-up]").addEventListener("click", () => showDir(repo, parent));
    return;
  }
  filesView.innerHTML = `<div class="files-note">Opening ${escapeHtml(item.name)}…</div>`;
  try {
    const txt = await fetchFileText(item.download_url);
    filesView.innerHTML = `<div class="crumb"><button data-up="1">← back</button><span>${escapeHtml(item.name)}</span></div><pre class="file-content">${escapeHtml(txt)}</pre>`;
    filesView.querySelector("[data-up]").addEventListener("click", () => showDir(repo, parent));
  } catch (err) {
    filesView.innerHTML = `<div class="files-note">${escapeHtml(err.message)}</div>`;
  }
}

function fmtSize(b) {
  if (b < 1024) return b + " B";
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}

/* ---- Chat plumbing ---- */
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
