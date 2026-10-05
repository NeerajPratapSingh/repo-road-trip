// game.js — the Repo Road Trip world + per-shop chat wiring.
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
usernameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") start();
});

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
    initGame(data);
  } catch (err) {
    startError.textContent = err.message;
  } finally {
    loading.style.display = "none";
    startBtn.disabled = false;
  }
}

/* ------------------------------------------------------------------ */
/*  The world                                                          */
/* ------------------------------------------------------------------ */
let paused = false;      // true while the chat panel is open
let currentNear = null;  // the shop the car is closest to (if within range)

function initGame(data) {
  kaplay({
    global: true,
    canvas: el("game"),
    background: [34, 40, 49], // lofi dusk
    pixelDensity: Math.min(window.devicePixelRatio || 1, 2),
  });

  const WORLD = 1600;
  const CENTER = vec2(WORLD / 2, WORLD / 2);
  const RING = 440;

  // Big grass backdrop so you never see the void.
  add([
    rect(WORLD + 1200, WORLD + 1200),
    pos(CENTER.sub(vec2(600, 600))),
    color(40, 47, 55),
  ]);

  // Lay repos out on a ring around the central plaza.
  const shops = [];
  data.repos.forEach((repo, i) => {
    const ang = (i / data.repos.length) * Math.PI * 2 - Math.PI / 2;
    const p = vec2(CENTER.x + Math.cos(ang) * RING, CENTER.y + Math.sin(ang) * RING);

    // Road from plaza to the shop.
    const toShop = p.sub(CENTER);
    add([
      rect(toShop.len(), 30),
      pos(CENTER),
      anchor("left"),
      rotate(toShop.angle()),
      color(52, 59, 69),
    ]);

    // Shop building.
    const [r, g, b] = colorForLanguage(repo.language);
    add([
      rect(90, 90, { radius: 8 }),
      pos(p),
      anchor("center"),
      color(r, g, b),
      outline(4, rgb(24, 28, 34)),
      area(),
      z(5),
      "shop",
      { repo },
    ]);
    // Door.
    add([rect(26, 34, { radius: 4 }), pos(p.x, p.y + 28), anchor("center"), color(24, 28, 34), z(6)]);
    // Sign (repo name).
    add([
      text(repo.name, { size: 16, width: 170, align: "center" }),
      pos(p.x, p.y - 72),
      anchor("center"),
      color(232, 230, 223),
      z(6),
    ]);
    // Stars.
    add([
      text(`★ ${repo.stars}  ·  ${repo.language}`, { size: 12 }),
      pos(p.x, p.y - 52),
      anchor("center"),
      color(154, 163, 178),
      z(6),
    ]);

    shops.push({ pos: p, repo });
  });

  // Central plaza.
  add([circle(70), pos(CENTER), anchor("center"), color(58, 66, 78), z(1)]);
  add([
    text("start", { size: 16 }),
    pos(CENTER),
    anchor("center"),
    color(154, 163, 178),
    z(2),
  ]);

  // The car.
  const car = add([
    rect(40, 24, { radius: 5 }),
    pos(CENTER),
    anchor("center"),
    rotate(0),
    color(255, 210, 90),
    outline(3, rgb(24, 28, 34)),
    z(20),
  ]);
  // Windshield so you can tell which way it faces.
  const windshield = add([
    rect(10, 16, { radius: 2 }),
    pos(CENTER),
    anchor("center"),
    color(126, 200, 194),
    z(21),
  ]);

  const SPEED = 260;
  const NEAR = 135;

  onUpdate(() => {
    if (!paused) {
      let dir = vec2(0, 0);
      if (isKeyDown("left") || isKeyDown("a")) dir.x -= 1;
      if (isKeyDown("right") || isKeyDown("d")) dir.x += 1;
      if (isKeyDown("up") || isKeyDown("w")) dir.y -= 1;
      if (isKeyDown("down") || isKeyDown("s")) dir.y += 1;

      if (dir.len() > 0) {
        dir = dir.unit();
        car.move(dir.scale(SPEED));
        car.angle = dir.angle();
      }
    }

    // Keep the windshield glued to the car's nose.
    const nose = Vec2.fromAngle(car.angle).scale(8);
    windshield.pos = car.pos.add(nose);
    windshield.angle = car.angle;

    camPos(car.pos);

    // Find the nearest shop in range.
    let near = null;
    let best = NEAR;
    for (const s of shops) {
      const d = car.pos.dist(s.pos);
      if (d < best) {
        best = d;
        near = s;
      }
    }
    currentNear = near;
    updatePrompt(near);
  });

  onKeyPress("e", () => {
    if (!paused && currentNear) openChat(currentNear.repo);
  });
  onKeyPress("escape", () => {
    if (paused) closeChat();
  });
}

/* ------------------------------------------------------------------ */
/*  HUD prompt                                                         */
/* ------------------------------------------------------------------ */
const promptEl = el("prompt");
function updatePrompt(near) {
  if (paused || !near) {
    promptEl.classList.add("hidden");
    return;
  }
  promptEl.innerHTML = `Press <b>E</b> to chat with <b>${escapeHtml(near.repo.name)}</b>`;
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
let history = []; // [{role:'user'|'model', text}]

chatSend.addEventListener("click", send);
chatClose.addEventListener("click", closeChat);
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") send();
});

const SUGGESTIONS = [
  "What do you do?",
  "Why are you useful?",
  "How were you built?",
  "What's the coolest part?",
];

function openChat(repo) {
  paused = true;
  activeRepo = repo;
  history = [];
  chatTitle.textContent = repo.name;
  chatMeta.textContent = `★ ${repo.stars} · ${repo.language}`;
  chatLog.innerHTML = "";
  promptEl.classList.add("hidden");

  addBubble(
    "model",
    `Hey! I'm ${repo.name}. ${repo.description ? repo.description : "Pull up a chair."} Ask me what I do, why I'm handy, or how I was built.`
  );

  chatChips.innerHTML = "";
  SUGGESTIONS.forEach((q) => {
    const c = document.createElement("button");
    c.className = "chip";
    c.textContent = q;
    c.addEventListener("click", () => {
      chatInput.value = q;
      send();
    });
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
    if (!resp.ok) {
      addBubble("model", `(${data.error || "Something went wrong."})`);
      return;
    }
    addBubble("model", data.reply);
    history.push({ role: "model", text: data.reply });
  } catch (err) {
    typing.remove();
    addBubble("model", `(Network error: ${err.message})`);
  }
}

/* ------------------------------------------------------------------ */
/*  util                                                               */
/* ------------------------------------------------------------------ */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
