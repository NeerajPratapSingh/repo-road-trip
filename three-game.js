// three-game.js — Repo Road Trip in 3D (Three.js).
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
/*  3D world                                                           */
/* ------------------------------------------------------------------ */
let paused = false;
let currentNear = null;

function initGame(data) {
  const canvas = el("game");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x15102b);
  scene.fog = new THREE.Fog(0x15102b, 70, 260);

  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1000);
  camera.position.set(0, 12, 20);

  // --- Lights
  scene.add(new THREE.HemisphereLight(0x9b8cff, 0x140e28, 0.9));
  const sun = new THREE.DirectionalLight(0xfff0e0, 1.2);
  sun.position.set(50, 90, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -140, right: 140, top: 140, bottom: -140, far: 320 });
  scene.add(sun);

  // --- Ground + grid
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 700),
    new THREE.MeshStandardMaterial({ color: 0x1e1540, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(700, 140, 0x4b3b8f, 0x2a2152);
  grid.position.y = 0.02;
  scene.add(grid);

  // --- Central plaza
  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(11, 11, 0.4, 48),
    new THREE.MeshStandardMaterial({ color: 0x2a2152, emissive: 0x3a2f6b, emissiveIntensity: 0.5 })
  );
  plaza.position.y = 0.2;
  plaza.receiveShadow = true;
  scene.add(plaza);

  // --- Buildings (one per repo), on a ring
  const RING = 58;
  const buildings = [];
  const n = data.repos.length;

  data.repos.forEach((repo, i) => {
    const ang = (i / n) * Math.PI * 2;
    const x = Math.cos(ang) * RING;
    const z = Math.sin(ang) * RING;
    const h = 11 + Math.min(repo.stars, 50) * 0.6;
    const [r, g, b] = colorForLanguage(repo.language);
    const col = new THREE.Color(r / 255, g / 255, b / 255);

    const building = new THREE.Mesh(
      new THREE.BoxGeometry(11, h, 11),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, metalness: 0.12, emissive: col, emissiveIntensity: 0.06 })
    );
    building.position.set(x, h / 2, z);
    building.castShadow = true;
    building.receiveShadow = true;
    scene.add(building);

    // Glowing neon band near the top
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(11.6, 2.2, 11.6),
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.0 })
    );
    band.position.set(x, h - 2.2, z);
    scene.add(band);

    // Door facing the plaza
    const dir = new THREE.Vector3(-Math.cos(ang), 0, -Math.sin(ang)).normalize();
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 5.5, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x120c22 })
    );
    door.position.set(x + dir.x * 5.6, 2.75, z + dir.z * 5.6);
    door.lookAt(x + dir.x * 10, 2.75, z + dir.z * 10);
    scene.add(door);

    // Floating label
    const label = makeLabel(repo.name, `★ ${repo.stars} · ${repo.language}`);
    label.position.set(x, h + 7, z);
    scene.add(label);

    // Road from plaza
    const road = new THREE.Mesh(
      new THREE.BoxGeometry(RING - 13, 0.12, 6),
      new THREE.MeshStandardMaterial({ color: 0x2a2152, emissive: 0x3a2f6b, emissiveIntensity: 0.35 })
    );
    road.position.set(Math.cos(ang) * (RING / 2 + 5), 0.07, Math.sin(ang) * (RING / 2 + 5));
    road.rotation.y = -ang;
    road.receiveShadow = true;
    scene.add(road);

    buildings.push({ x, z, repo, band });
  });

  // --- Car (low-poly)
  const car = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(3, 1, 5),
    new THREE.MeshStandardMaterial({ color: 0xff4d9d, roughness: 0.35, metalness: 0.4, emissive: 0x3a0f28, emissiveIntensity: 0.3 })
  );
  body.position.y = 0.95; body.castShadow = true; car.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1, 2.4),
    new THREE.MeshStandardMaterial({ color: 0x4dd4ff, roughness: 0.15, metalness: 0.5, emissive: 0x114a5c, emissiveIntensity: 0.35 })
  );
  cabin.position.set(0, 1.7, -0.2); cabin.castShadow = true; car.add(cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.6, 18);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0e0d16 });
  [[-1.4, 0.72, 1.6], [1.4, 0.72, 1.6], [-1.4, 0.72, -1.6], [1.4, 0.72, -1.6]].forEach((o) => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(o[0], o[1], o[2]); w.castShadow = true; car.add(w);
  });

  const head = new THREE.PointLight(0xfff2cc, 1.0, 34);
  head.position.set(0, 1.3, 3); car.add(head);
  scene.add(car);

  // --- Car physics (arcade)
  let speed = 0, heading = 0;
  const MAXF = 40, MAXR = 18, ACCEL = 30, FRICTION = 16, STEER = 2.3;
  const keys = {};
  addEventListener("keydown", (e) => { keys[e.key.toLowerCase()] = true; });
  addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

  addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === "e" && !paused && currentNear) openChat(currentNear.repo);
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
      if (Math.abs(speed) > 0.3) heading += (left - right) * STEER * dt * (speed > 0 ? 1 : -1);

      car.position.x += Math.sin(heading) * speed * dt;
      car.position.z += Math.cos(heading) * speed * dt;
      car.rotation.y = heading;
    }

    // Follow camera (smooth)
    const camDist = 17, camH = 9.5;
    const want = new THREE.Vector3(
      car.position.x - Math.sin(heading) * camDist,
      camH,
      car.position.z - Math.cos(heading) * camDist
    );
    camera.position.lerp(want, 1 - Math.pow(0.0015, dt));
    camera.lookAt(car.position.x, 2.5, car.position.z);

    // Proximity → nearest building
    let near = null, best = 15;
    for (const bld of buildings) {
      const d = Math.hypot(car.position.x - bld.x, car.position.z - bld.z);
      bld.band.material.emissiveIntensity = 1.0;
      if (d < best) { best = d; near = bld; }
    }
    if (near) near.band.material.emissiveIntensity = 2.2; // highlight nearest
    currentNear = near;
    updatePrompt(near);

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
  ctx.fillStyle = "#b9b4d6";
  ctx.fillText(sub, 256, 104);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(15, 4.7, 1);
  return sprite;
}

/* ------------------------------------------------------------------ */
/*  HUD prompt                                                         */
/* ------------------------------------------------------------------ */
const promptEl = el("prompt");
function updatePrompt(near) {
  if (paused || !near) { promptEl.classList.add("hidden"); return; }
  promptEl.innerHTML = `Press <kbd>E</kbd> to chat with <b>${escapeHtml(near.repo.name)}</b>`;
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
