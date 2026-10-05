// three-game.js — Repo Road Trip: first-person drive down an endless road,
// repos are roadside shops you pull over to chat with.
import * as THREE from "three";
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
    initGame(data);
  } catch (err) {
    startError.textContent = err.message;
  } finally {
    loading.style.display = "none";
    startBtn.disabled = false;
  }
}

/* ------------------------------------------------------------------ */
/*  World                                                              */
/* ------------------------------------------------------------------ */
let paused = false;
let currentNear = null;

const SPACING = 75;   // distance between shops along the road
const ROAD_W = 18;    // road width
const LANE_MAX = 6;   // how far you can drift left/right

function initGame(data) {
  const canvas = el("game");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x140e2e);
  scene.fog = new THREE.Fog(0x140e2e, 60, 320);

  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 1000);
  scene.add(camera); // so the dashboard (its child) renders

  const n = data.repos.length;
  const ROAD_LEN = SPACING * (n + 1) + 120;

  // --- Lights
  scene.add(new THREE.HemisphereLight(0x9b8cff, 0x120b26, 0.9));
  const sun = new THREE.DirectionalLight(0xffb27a, 1.3);
  sun.position.set(-30, 40, ROAD_LEN); // low sun down the road = sunset vibe
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, far: ROAD_LEN + 200 });
  scene.add(sun);

  // --- Sunset backdrop (big glowing disc on the horizon, straight ahead)
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(60, 48),
    new THREE.MeshBasicMaterial({ color: 0xff5aa0 })
  );
  sunDisc.position.set(0, 30, ROAD_LEN + 60);
  scene.add(sunDisc);

  // --- Ground + grid
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, ROAD_LEN + 400),
    new THREE.MeshStandardMaterial({ color: 0x1b1240, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = ROAD_LEN / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(1200, 240, 0x4b3b8f, 0x281e4f);
  grid.position.set(0, 0.02, ROAD_LEN / 2);
  scene.add(grid);

  // --- Road
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_W, ROAD_LEN + 200),
    new THREE.MeshStandardMaterial({ color: 0x15121f, roughness: 0.9 })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.03, ROAD_LEN / 2);
  road.receiveShadow = true;
  scene.add(road);

  // Dashed centre line + glowing edges
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf2e9ff });
  for (let z = 0; z < ROAD_LEN + 100; z += 12) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.06, z);
    scene.add(dash);
  }
  [-1, 1].forEach((s) => {
    const edge = new THREE.Mesh(
      new THREE.PlaneGeometry(0.4, ROAD_LEN + 200),
      new THREE.MeshBasicMaterial({ color: s < 0 ? 0x4dd4ff : 0xff4d9d })
    );
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(s * (ROAD_W / 2 - 0.3), 0.06, ROAD_LEN / 2);
    scene.add(edge);
  });

  // --- Roadside light pylons (motion cue)
  for (let z = 20; z < ROAD_LEN; z += 25) {
    [-1, 1].forEach((s) => {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x2a2150 })
      );
      pole.position.set(s * (ROAD_W / 2 + 2), 4, z);
      scene.add(pole);
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0x4dd4ff, emissive: 0x4dd4ff, emissiveIntensity: 1.5 })
      );
      lamp.position.set(s * (ROAD_W / 2 + 2), 8, z);
      scene.add(lamp);
    });
  }

  // --- Shops (one per repo), alternating sides down the road
  const shops = [];
  data.repos.forEach((repo, i) => {
    const z = SPACING * (i + 1);
    const side = i % 2 === 0 ? 1 : -1;        // right, left, right…
    const x = side * (ROAD_W / 2 + 9);
    const h = 12 + Math.min(repo.stars, 50) * 0.6;
    const [r, g, b] = colorForLanguage(repo.language);
    const col = new THREE.Color(r / 255, g / 255, b / 255);

    const building = new THREE.Mesh(
      new THREE.BoxGeometry(14, h, 14),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, metalness: 0.12, emissive: col, emissiveIntensity: 0.06 })
    );
    building.position.set(x, h / 2, z);
    building.castShadow = true; building.receiveShadow = true;
    scene.add(building);

    // Neon band + marquee facing the road
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(14.6, 2.4, 14.6),
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.0 })
    );
    band.position.set(x, h - 2.4, z);
    scene.add(band);

    // Door on the road-facing side
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(4, 6, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x120c22 })
    );
    door.position.set(x - side * 7.1, 3, z);
    door.rotation.y = Math.PI / 2;
    scene.add(door);

    // Floating label above the shop
    const label = makeLabel(repo.name, `★ ${repo.stars} · ${repo.language}`);
    label.position.set(x, h + 7, z);
    scene.add(label);

    shops.push({ x, z, repo, band });
  });

  // "ROAD ENDS" marker
  const endLabel = makeLabel("end of the road", "turn around, explorer");
  endLabel.position.set(0, 8, ROAD_LEN + 10);
  scene.add(endLabel);

  // --- The car (first-person: we mostly see the dashboard)
  const carPos = new THREE.Vector3(0, 0, 0);
  let lane = 0;        // left/right offset
  let speed = 0;       // forward speed
  const MAXF = 44, MAXR = 16, ACCEL = 34, FRICTION = 20, STEER = 14;

  // Dashboard / hood, parented to the camera so it stays in view
  const dash = new THREE.Group();
  const hood = new THREE.Mesh(
    new THREE.BoxGeometry(5, 1.2, 2.2),
    new THREE.MeshStandardMaterial({ color: 0xff4d9d, roughness: 0.3, metalness: 0.5, emissive: 0x3a0f28, emissiveIntensity: 0.3 })
  );
  hood.position.set(0, -1.25, -2.1);
  dash.add(hood);
  const wheel = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.09, 12, 32),
    new THREE.MeshStandardMaterial({ color: 0x0e0d16, roughness: 0.4 })
  );
  wheel.position.set(0, -0.95, -1.3);
  wheel.rotation.x = Math.PI / 2.4;
  dash.add(wheel);
  camera.add(dash);

  const keys = {};
  addEventListener("keydown", (e) => { keys[e.key.toLowerCase()] = true; });
  addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });
  addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === "e" && !paused && currentNear) { speed = 0; openChat(currentNear.repo); }
    if (k === "escape" && paused) closeChat();
  });

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    if (!paused) {
      const fwd = keys["w"] || keys["arrowup"] ? 1 : 0;
      const back = keys["s"] || keys["arrowdown"] ? 1 : 0;
      const left = keys["a"] || keys["arrowleft"] ? 1 : 0;
      const right = keys["d"] || keys["arrowright"] ? 1 : 0;

      speed += (fwd - back) * ACCEL * dt;
      if (!fwd && !back) {
        const d = FRICTION * dt;
        speed = Math.abs(speed) <= d ? 0 : speed - Math.sign(speed) * d;
      }
      speed = Math.max(-MAXR, Math.min(MAXF, speed));

      lane += (right - left) * STEER * dt;
      lane = Math.max(-LANE_MAX, Math.min(LANE_MAX, lane));

      carPos.z += speed * dt;
      carPos.z = Math.max(-10, Math.min(ROAD_LEN + 20, carPos.z));
      carPos.x = lane;
    }

    // First-person camera: eyes at driver height, looking down the road
    camera.position.set(carPos.x, 2.1, carPos.z);
    camera.lookAt(carPos.x, 1.9, carPos.z + 10);

    // Approach detection: nearest shop within range (ahead or alongside)
    let near = null, best = 45;
    for (const s of shops) {
      s.band.material.emissiveIntensity = 1.0;
      const d = Math.abs(s.z - carPos.z);
      if (d < best) { best = d; near = s; }
    }
    if (near) near.band.material.emissiveIntensity = 2.4;
    currentNear = near ? { ...near, ahead: near.z - carPos.z } : null;
    updatePrompt(currentNear);

    renderer.render(scene, camera);
  }
  animate();

  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}

/* Floating text label as a sprite */
function makeLabel(title, sub) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 160;
  const ctx = c.getContext("2d");
  ctx.textAlign = "center";
  ctx.font = "700 46px 'Space Grotesk', sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(title.slice(0, 22), 256, 58);
  ctx.font = "400 28px Inter, sans-serif";
  ctx.fillStyle = "#c9c3e6";
  ctx.fillText(sub, 256, 104);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(16, 5, 1);
  return sprite;
}

/* ------------------------------------------------------------------ */
/*  HUD prompt                                                         */
/* ------------------------------------------------------------------ */
const promptEl = el("prompt");
function updatePrompt(near) {
  if (paused || !near) { promptEl.classList.add("hidden"); return; }
  const name = escapeHtml(near.repo.name);
  if (near.ahead > 14) {
    // still coming up on it
    promptEl.innerHTML = `Approaching <b>${name}</b> — press <kbd>E</kbd> to stop`;
  } else {
    // alongside
    promptEl.innerHTML = `<b>${name}</b> — press <kbd>E</kbd> to pull over & chat`;
  }
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

  addBubble("model", `Hey! I'm ${repo.name}. ${repo.description || "Pull up a chair."} Ask me what I do, why I'm handy, or how I was built.`);

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
