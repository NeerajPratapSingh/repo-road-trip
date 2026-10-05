// pixelgame.js — Repo Village, with real pixel-art sprites drawn in code.
import { fetchGitHubData, colorForLanguage, fetchRepoContents, fetchFileText } from "./github.js";

/* ------------------------------------------------------------------ */
/*  Start                                                              */
/* ------------------------------------------------------------------ */
const el = (id) => document.getElementById(id);
const startScreen = el("start");
const usernameInput = el("username");
const startBtn = el("startBtn");
const startError = el("startError");
const loading = el("loading");

startBtn.addEventListener("click", start);
usernameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") start(); });

let OWNER = "", PROFILE = null;

async function start() {
  const username = usernameInput.value.trim();
  if (!username) return;
  startError.textContent = "";
  loading.style.display = "block";
  startBtn.disabled = true;
  try {
    const data = await fetchGitHubData(username, 18);
    if (!data.repos.length) throw new Error("No public (non-fork) repos found for this user.");
    OWNER = data.profile.login; PROFILE = data.profile;
    startScreen.style.display = "none";
    await initGame(data);
  } catch (err) {
    startError.textContent = err.message;
  } finally {
    loading.style.display = "none";
    startBtn.disabled = false;
  }
}

/* ------------------------------------------------------------------ */
/*  Pixel-art sprite factory                                           */
/* ------------------------------------------------------------------ */
function cv(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
function px(x, X, Y, W, H, col) { x.fillStyle = col; x.fillRect(X, Y, W, H); }

function drawChar({ skin, hair, shirt, pants, shoe, beard }) {
  const c = cv(16, 18), x = c.getContext("2d"), O = "#2a1e14";
  px(x, 4, 1, 8, 3, hair); px(x, 3, 2, 1, 5, hair); px(x, 12, 2, 1, 5, hair);
  px(x, 4, 4, 8, 5, skin);
  px(x, 6, 6, 1, 1, O); px(x, 9, 6, 1, 1, O);
  if (beard) { px(x, 4, 8, 8, 2, beard); px(x, 5, 10, 6, 1, beard); }
  px(x, 4, 9, 8, 5, shirt);
  px(x, 2, 9, 2, 4, shirt); px(x, 12, 9, 2, 4, shirt);
  px(x, 2, 13, 2, 1, skin); px(x, 12, 13, 2, 1, skin);
  px(x, 5, 14, 2, 3, pants); px(x, 9, 14, 2, 3, pants);
  px(x, 5, 17, 2, 1, shoe); px(x, 9, 17, 2, 1, shoe);
  return c.toDataURL();
}

function drawTree() {
  const c = cv(18, 24), x = c.getContext("2d");
  const trunk = "#6e4a30", tr2 = "#5a3a24", g1 = "#5c8f3f", g2 = "#6fa544", g3 = "#4c7a34";
  px(x, 8, 17, 3, 7, trunk); px(x, 8, 17, 1, 7, tr2);
  px(x, 4, 9, 10, 8, g1); px(x, 2, 12, 14, 5, g1); px(x, 5, 6, 8, 5, g2);
  px(x, 5, 10, 2, 2, g3); px(x, 10, 13, 2, 2, g3); px(x, 7, 8, 2, 2, g2);
  px(x, 4, 11, 1, 1, "#f2a9c4"); px(x, 12, 10, 1, 1, "#f2a9c4"); px(x, 8, 14, 1, 1, "#f2a9c4");
  return c.toDataURL();
}

function drawShop([r, g, b]) {
  const c = cv(48, 44), x = c.getContext("2d");
  const wall = "#f3e7cc", wood = "#6e4a30", woodD = "#5a3a24";
  const roof = "#44506b", roofL = "#5a6a8c", roofD = "#333c54";
  const win = "#fff6d8", door = "#4a3322";
  const noren = `rgb(${r},${g},${b})`, lamp = "#d64b4b", glow = "#ffd36a";
  // roof
  px(x, 2, 8, 44, 6, roof); px(x, 2, 8, 44, 1, roofL); px(x, 0, 12, 48, 2, roofD);
  px(x, 15, 3, 18, 5, roof); px(x, 15, 3, 18, 1, roofL);
  px(x, 0, 9, 3, 3, roof); px(x, 45, 9, 3, 3, roof);
  px(x, 0, 8, 2, 2, roofD); px(x, 46, 8, 2, 2, roofD);
  // wall + frame
  px(x, 6, 14, 36, 26, wall);
  px(x, 6, 14, 36, 1, wood); px(x, 6, 39, 36, 1, wood); px(x, 6, 14, 1, 26, wood); px(x, 41, 14, 1, 26, wood);
  // left window
  px(x, 9, 19, 9, 10, win); px(x, 9, 19, 9, 1, wood); px(x, 9, 28, 9, 1, wood); px(x, 9, 19, 1, 10, wood); px(x, 17, 19, 1, 10, wood); px(x, 13, 19, 1, 10, wood); px(x, 9, 23, 9, 1, wood);
  // right window
  px(x, 30, 19, 9, 10, win); px(x, 30, 19, 9, 1, wood); px(x, 30, 28, 9, 1, wood); px(x, 30, 19, 1, 10, wood); px(x, 38, 19, 1, 10, wood); px(x, 34, 19, 1, 10, wood); px(x, 30, 23, 9, 1, wood);
  // door (centre) + noren
  px(x, 21, 24, 6, 16, door);
  px(x, 19, 21, 10, 5, noren); px(x, 22, 21, 1, 5, wall); px(x, 25, 21, 1, 5, wall);
  // lanterns
  px(x, 2, 16, 4, 7, lamp); px(x, 2, 18, 4, 3, glow); px(x, 2, 15, 4, 1, "#111"); px(x, 2, 23, 4, 1, "#111");
  px(x, 42, 16, 4, 7, lamp); px(x, 42, 18, 4, 3, glow); px(x, 42, 15, 4, 1, "#111"); px(x, 42, 23, 4, 1, "#111");
  return c.toDataURL();
}

function drawTorii() {
  const c = cv(28, 24), x = c.getContext("2d");
  const red = "#c0392b", redD = "#9c2c20", top = "#7a241a";
  px(x, 1, 2, 26, 3, red); px(x, 0, 2, 28, 1, top);
  px(x, 4, 7, 20, 2, red);
  px(x, 6, 5, 3, 18, red); px(x, 19, 5, 3, 18, red);
  px(x, 6, 5, 1, 18, redD); px(x, 19, 5, 1, 18, redD);
  px(x, 12, 8, 4, 4, top);
  return c.toDataURL();
}

function drawLantern() {
  const c = cv(10, 16), x = c.getContext("2d");
  px(x, 4, 0, 1, 3, "#5a3a24");
  px(x, 2, 3, 6, 9, "#d64b4b"); px(x, 2, 6, 6, 3, "#ffd36a");
  px(x, 3, 2, 4, 1, "#111"); px(x, 3, 12, 4, 1, "#111");
  return c.toDataURL();
}

function drawPathTile() {
  const c = cv(16, 16), x = c.getContext("2d");
  px(x, 0, 0, 16, 16, "#e3cd97");
  for (let i = 0; i < 10; i++) px(x, (Math.random() * 16) | 0, (Math.random() * 16) | 0, 1, 1, Math.random() < 0.5 ? "#d4ba7f" : "#cbae72");
  return c.toDataURL();
}

function drawFlower(col) {
  const c = cv(8, 8), x = c.getContext("2d");
  px(x, 3, 4, 2, 3, "#4c7a34");
  px(x, 2, 2, 4, 2, col); px(x, 3, 1, 2, 4, col); px(x, 3, 2, 2, 2, "#fff6d8");
  return c.toDataURL();
}

/* ------------------------------------------------------------------ */
/*  Village                                                            */
/* ------------------------------------------------------------------ */
let paused = false;
let currentNear = null;

async function initGame(data) {
  kaplay({ global: true, canvas: el("game"), background: [124, 156, 92], crisp: true, pixelDensity: 1 });

  const heroPal = { skin: "#f2caa0", hair: "#6e4a30", shirt: "#cf6a44", pants: "#3f5a7a", shoe: "#2a1e14" };
  const elderPal = { skin: "#e8c49a", hair: "#dad4c6", shirt: "#6b7d4a", pants: "#5a4a38", shoe: "#2a1e14", beard: "#eceae0" };
  const npcPals = [
    { skin: "#f0c49a", hair: "#2a1e14", shirt: "#5a9bd4", pants: "#3a3a4a", shoe: "#2a1e14" },
    { skin: "#e8b98a", hair: "#7a4a2a", shirt: "#9c6fd4", pants: "#4a4a3a", shoe: "#2a1e14" },
    { skin: "#f2caa0", hair: "#c04a3a", shirt: "#4aa58a", pants: "#3f5a7a", shoe: "#2a1e14" },
  ];

  const loads = [
    loadSprite("hero", drawChar(heroPal)),
    loadSprite("elder", drawChar(elderPal)),
    loadSprite("tree", drawTree()),
    loadSprite("torii", drawTorii()),
    loadSprite("lantern", drawLantern()),
    loadSprite("path", drawPathTile()),
    loadSprite("flowerA", drawFlower("#e86a9c")),
    loadSprite("flowerB", drawFlower("#e8c84a")),
    ...npcPals.map((p, i) => loadSprite("npc" + i, drawChar(p))),
    ...data.repos.map((r, i) => loadSprite("shop" + i, drawShop(colorForLanguage(r.language)))),
  ];
  await Promise.all(loads);

  // --- Layout
  const n = data.repos.length;
  const WORLD_W = 1000, CX = WORLD_W / 2, SIDE = 240, SY = 240, TOP = 320;
  const WORLD_H = TOP + n * SY + 320;
  const SC = 3; // pixel scale

  // path tiles: central street (3 wide)
  for (let y = 120; y < WORLD_H - 60; y += 48) {
    for (let ox = -1; ox <= 1; ox++) add([sprite("path"), pos(CX + ox * 48, y), anchor("center"), scale(SC), z(0)]);
  }
  // flowers scattered on grass
  for (let i = 0; i < 40; i++) {
    add([sprite(Math.random() < 0.5 ? "flowerA" : "flowerB"), pos(rand(90, WORLD_W - 90), rand(160, WORLD_H - 80)), anchor("center"), scale(2.2), z(1)]);
  }
  // border trees
  for (let y = 120; y < WORLD_H - 40; y += 110) {
    add([sprite("tree"), pos(60, y), anchor("center"), scale(3), z(y)]);
    add([sprite("tree"), pos(WORLD_W - 60, y), anchor("center"), scale(3), z(y)]);
  }
  // torii at the top
  add([sprite("torii"), pos(CX, 150), anchor("center"), scale(4), z(160)]);
  // street lanterns
  for (let y = 220; y < WORLD_H - 120; y += 150) {
    add([sprite("lantern"), pos(CX - 90, y), anchor("center"), scale(2.6), z(y)]);
    add([sprite("lantern"), pos(CX + 90, y), anchor("center"), scale(2.6), z(y)]);
  }

  // --- Shops
  const doors = [];
  data.repos.forEach((repo, i) => {
    const side = i % 2 === 0 ? 1 : -1;
    const x = CX + side * SIDE;
    const y = TOP + i * SY;
    // lane of path tiles to the shop
    const steps = Math.round((SIDE) / 48);
    for (let s = 1; s <= steps; s++) add([sprite("path"), pos(CX + side * s * 48, y + 60), anchor("center"), scale(SC), z(0.1)]);
    // shadow + shop
    add([circle(70), scale(1, 0.26), pos(x, y + 58), anchor("center"), color(60, 50, 34), opacity(0.16), z(y - 1)]);
    add([sprite("shop" + i), pos(x, y), anchor("center"), scale(SC), z(y)]);
    // signboard
    add([rect(176, 40, { radius: 8 }), pos(x, y + 92), anchor("center"), color(150, 100, 60), outline(4, rgb(90, 58, 36)), z(y + 1)]);
    add([text(repo.name.length > 16 ? repo.name.slice(0, 15) + "…" : repo.name, { size: 16, width: 166, align: "center" }), pos(x, y + 86), anchor("center"), color(rgb(255, 245, 225)), z(y + 2)]);
    add([text(`★ ${repo.stars} · ${repo.language}`, { size: 11 }), pos(x, y + 102), anchor("center"), color(rgb(235, 220, 190)), z(y + 2)]);
    doors.push({ type: "shop", pos: vec2(x, y + 70), repo });
  });

  // --- NPCs
  for (let i = 0; i < Math.min(n + 1, 6); i++) {
    add([sprite("npc" + (i % 3)), pos(CX + rand(-55, 55), TOP + rand(60, (n - 1) * SY + 140)), anchor("center"), scale(2.4), z(99998)]);
  }

  // --- Elder
  const eP = vec2(CX + 110, WORLD_H - 230);
  add([circle(22), scale(1, 0.4), pos(eP.x, eP.y + 22), anchor("center"), color(60, 50, 34), opacity(0.18), z(eP.y - 1)]);
  add([sprite("elder"), pos(eP.x, eP.y), anchor("center"), scale(3), z(eP.y)]);
  add([rect(150, 32, { radius: 8 }), pos(eP.x, eP.y - 44), anchor("center"), color(150, 100, 60), outline(3, rgb(90, 58, 36)), z(eP.y + 1)]);
  add([text("Village Elder", { size: 13 }), pos(eP.x, eP.y - 44), anchor("center"), color(rgb(255, 245, 225)), z(eP.y + 2)]);
  const spots = [...doors, { type: "elder", pos: eP }];

  // --- Entrance sign
  add([rect(260, 52, { radius: 12 }), pos(CX, WORLD_H - 80), anchor("center"), color(150, 100, 60), outline(5, rgb(90, 58, 36)), z(WORLD_H)]);
  add([text("REPO VILLAGE", { size: 22 }), pos(CX, WORLD_H - 80), anchor("center"), color(rgb(255, 245, 225)), z(WORLD_H + 1)]);

  // --- Hero
  const shadow = add([circle(20), scale(1, 0.4), pos(CX, WORLD_H - 128), anchor("center"), color(60, 50, 34), opacity(0.2), z(1)]);
  const hero = add([sprite("hero"), pos(CX, WORLD_H - 140), anchor("center"), scale(2.8), z(1000)]);

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
        hero.pos.x = Math.max(55, Math.min(WORLD_W - 55, hero.pos.x));
        hero.pos.y = Math.max(130, Math.min(WORLD_H - 70, hero.pos.y));
        hero.scale = vec2(2.8, 2.8 + Math.sin(time() * 14) * 0.12);
        if (dir.x !== 0) hero.flipX = dir.x < 0;
      }
    }
    hero.z = hero.pos.y + 1;
    shadow.pos = vec2(hero.pos.x, hero.pos.y + 22);

    const hw = width() / 2, hh = height() / 2;
    const cx = WORLD_W <= width() ? WORLD_W / 2 : Math.max(hw, Math.min(WORLD_W - hw, hero.pos.x));
    const cy = WORLD_H <= height() ? WORLD_H / 2 : Math.max(hh, Math.min(WORLD_H - hh, hero.pos.y));
    camPos(cx, cy);

    let near = null, best = 100;
    for (const s of spots) { const d = hero.pos.dist(s.pos); if (d < best) { best = d; near = s; } }
    currentNear = near;
    updatePrompt(near);
  });

  onKeyPress("e", () => {
    if (paused || !currentNear) return;
    if (currentNear.type === "elder") openElder(); else openShop(currentNear.repo);
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
/*  Panel: elder / shop (chat + files)                                 */
/* ------------------------------------------------------------------ */
const chatEl = el("chat"), chatTitle = el("chatTitle"), chatMeta = el("chatMeta");
const chatLog = el("chatLog"), chatChips = el("chatChips"), chatInput = el("chatInput");
const chatInputRow = el("chatInputRow"), chatSend = el("chatSend"), chatClose = el("chatClose");
const chatTabs = el("chatTabs"), tabChat = el("tabChat"), tabFiles = el("tabFiles");
const chatView = el("chatView"), filesView = el("filesView");

let activeRepo = null, history = [];

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

function openElder() {
  paused = true; activeRepo = null;
  chatTitle.textContent = "Village Elder";
  chatMeta.textContent = `keeper of @${OWNER}`;
  chatTabs.classList.add("hidden"); filesView.classList.add("hidden"); chatView.classList.remove("hidden"); chatInputRow.classList.add("hidden");
  chatLog.innerHTML = "";
  addBubble("model", `Welcome, traveler. You've reached the village of ${PROFILE.name}. 🍵`);
  if (PROFILE.bio) addBubble("model", `They say of the maker: “${PROFILE.bio}”`);
  addBubble("model", `${PROFILE.publicRepos} works line these streets${PROFILE.followers ? `, and ${PROFILE.followers} folk follow the maker` : ""}. Each shop is a project — walk to a door and press E to step inside, chat, or browse its files.`);
  chatChips.innerHTML = "";
  [["What should I visit first?", `Follow the lanterns up the main street — the shops nearest the gate are the most-starred. A fine place to begin.`],
   ["Who built all this?", `${PROFILE.name} (@${OWNER}) — a builder of ${PROFILE.publicRepos} works. Wander, and see for yourself.`]]
    .forEach(([q, a]) => {
      const c = document.createElement("button"); c.className = "chip"; c.textContent = q;
      c.addEventListener("click", () => { addBubble("user", q); addBubble("model", a); });
      chatChips.appendChild(c);
    });
  chatEl.classList.remove("hidden");
}

function openShop(repo) {
  paused = true; activeRepo = repo; history = [];
  chatTitle.textContent = repo.name;
  chatMeta.textContent = `★ ${repo.stars} · ${repo.language}`;
  chatTabs.classList.remove("hidden"); chatInputRow.classList.remove("hidden");
  switchTab("chat");
  chatLog.innerHTML = "";
  addBubble("model", `Hey! I'm ${repo.name}. ${repo.description || "Come on in."} Ask me what I do, why I'm handy, or how I was built — or hit 📁 Files to look around.`);
  chatChips.innerHTML = "";
  SUGGESTIONS.forEach((q) => {
    const c = document.createElement("button"); c.className = "chip"; c.textContent = q;
    c.addEventListener("click", () => { chatInput.value = q; send(); });
    chatChips.appendChild(c);
  });
  chatEl.classList.remove("hidden");
  chatInput.focus();
}

function closeChat() { paused = false; activeRepo = null; chatEl.classList.add("hidden"); }

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
  } catch (err) { filesView.innerHTML = `<div class="files-note">${escapeHtml(err.message)}</div>`; }
}

async function showFile(repo, item) {
  const parent = item.path.split("/").slice(0, -1).join("/");
  if (!item.download_url || /\.(png|jpg|jpeg|gif|webp|ico|pdf|zip|exe|woff2?|ttf|mp4|mp3)$/i.test(item.name)) {
    filesView.innerHTML = `<div class="crumb"><button data-up="1">← back</button><span>${escapeHtml(item.name)}</span></div><div class="files-note">(binary file — open it on GitHub)</div>`;
    filesView.querySelector("[data-up]").addEventListener("click", () => showDir(repo, parent)); return;
  }
  filesView.innerHTML = `<div class="files-note">Opening ${escapeHtml(item.name)}…</div>`;
  try {
    const txt = await fetchFileText(item.download_url);
    filesView.innerHTML = `<div class="crumb"><button data-up="1">← back</button><span>${escapeHtml(item.name)}</span></div><pre class="file-content">${escapeHtml(txt)}</pre>`;
    filesView.querySelector("[data-up]").addEventListener("click", () => showDir(repo, parent));
  } catch (err) { filesView.innerHTML = `<div class="files-note">${escapeHtml(err.message)}</div>`; }
}

function fmtSize(b) { if (b < 1024) return b + " B"; if (b < 1048576) return (b / 1024).toFixed(1) + " KB"; return (b / 1048576).toFixed(1) + " MB"; }

function addBubble(role, text) {
  const div = document.createElement("div");
  div.className = `msg ${role}`; div.textContent = text;
  chatLog.appendChild(div); chatLog.scrollTop = chatLog.scrollHeight; return div;
}

async function send() {
  const text = chatInput.value.trim();
  if (!text || !activeRepo) return;
  chatInput.value = "";
  addBubble("user", text); history.push({ role: "user", text });
  const typing = addBubble("model typing", "typing…");
  try {
    const resp = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repo: activeRepo, messages: history }) });
    const data = await resp.json();
    typing.remove();
    if (!resp.ok) { addBubble("model", `(${data.error || "Something went wrong."})`); return; }
    addBubble("model", data.reply); history.push({ role: "model", text: data.reply });
  } catch (err) { typing.remove(); addBubble("model", `(Network error: ${err.message})`); }
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
