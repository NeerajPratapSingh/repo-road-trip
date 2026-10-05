// three-game.js — Repo Road Trip: cinematic first-person synthwave drive.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
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
    el("speedo").classList.remove("hidden");
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

const SPACING = 78;
const ROAD_W = 18;
const LANE_MAX = 6;

function initGame(data) {
  const canvas = el("game");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x120a2a);
  scene.fog = new THREE.Fog(0x241048, 80, 340);

  const BASE_FOV = 70;
  const camera = new THREE.PerspectiveCamera(BASE_FOV, innerWidth / innerHeight, 0.1, 2000);
  scene.add(camera);

  const n = data.repos.length;
  const ROAD_LEN = SPACING * (n + 1) + 140;

  /* ---- Post-processing (bloom) ---- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.9, 0.5, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ---- Lights ---- */
  scene.add(new THREE.HemisphereLight(0x9b8cff, 0x0e0820, 1.0));
  const sun = new THREE.DirectionalLight(0xffb27a, 1.4);
  sun.position.set(-20, 50, ROAD_LEN);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, far: ROAD_LEN + 300 });
  scene.add(sun);

  /* ---- Synthwave sun (striped disc on the horizon, dead ahead) ---- */
  const sunGroup = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(70, 64),
    new THREE.MeshBasicMaterial({ color: 0xff5e8a })
  );
  sunGroup.add(disc);
  // horizontal cutaway bands on the lower half
  for (let i = 0; i < 7; i++) {
    const band = new THREE.Mesh(
      new THREE.PlaneGeometry(150, 2 + i * 1.4),
      new THREE.MeshBasicMaterial({ color: 0x120a2a })
    );
    band.position.set(0, -6 - i * 9, 0.1);
    sunGroup.add(band);
  }
  sunGroup.position.set(0, 34, ROAD_LEN + 90);
  scene.add(sunGroup);
  // soft glow halo behind the sun
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(120, 64),
    new THREE.MeshBasicMaterial({ color: 0xff3d7a, transparent: true, opacity: 0.25 })
  );
  halo.position.set(0, 34, ROAD_LEN + 95);
  scene.add(halo);

  /* ---- Starfield ---- */
  const starGeo = new THREE.BufferGeometry();
  const starN = 1200;
  const sp = new Float32Array(starN * 3);
  for (let i = 0; i < starN; i++) {
    sp[i * 3] = (Math.random() - 0.5) * 1600;
    sp[i * 3 + 1] = 60 + Math.random() * 400;
    sp[i * 3 + 2] = Math.random() * (ROAD_LEN + 400);
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.3, sizeAttenuation: true, transparent: true, opacity: 0.8 })));

  /* ---- Distant mountains (depth) ---- */
  [-1, 1].forEach((s) => {
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(
        new THREE.ConeGeometry(50 + Math.random() * 30, 60 + Math.random() * 50, 4),
        new THREE.MeshStandardMaterial({ color: 0x1a0f36, roughness: 1, flatShading: true })
      );
      m.position.set(s * (160 + i * 60), 10, ROAD_LEN - 40 + i * 50);
      m.rotation.y = Math.random();
      scene.add(m);
    }
  });

  /* ---- Ground + grid ---- */
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, ROAD_LEN + 500),
    new THREE.MeshStandardMaterial({ color: 0x160f33, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = ROAD_LEN / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(1600, 300, 0x5a3fb0, 0x2a1d58);
  grid.position.set(0, 0.02, ROAD_LEN / 2);
  scene.add(grid);

  /* ---- Road (glossy) ---- */
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_W, ROAD_LEN + 300),
    new THREE.MeshStandardMaterial({ color: 0x0d0a18, roughness: 0.22, metalness: 0.55 })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.03, ROAD_LEN / 2);
  road.receiveShadow = true;
  scene.add(road);

  const dashMat = new THREE.MeshBasicMaterial({ color: 0xfff0ff });
  for (let z = 0; z < ROAD_LEN + 150; z += 12) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.06, z);
    scene.add(dash);
  }
  [-1, 1].forEach((s) => {
    const edge = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, ROAD_LEN + 300),
      new THREE.MeshBasicMaterial({ color: s < 0 ? 0x4dd4ff : 0xff4d9d })
    );
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(s * (ROAD_W / 2 - 0.3), 0.07, ROAD_LEN / 2);
    scene.add(edge);
  });

  /* ---- Light pylons ---- */
  for (let z = 22; z < ROAD_LEN; z += 26) {
    [-1, 1].forEach((s) => {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 9, 8),
        new THREE.MeshStandardMaterial({ color: 0x241a48 })
      );
      pole.position.set(s * (ROAD_W / 2 + 2.5), 4.5, z);
      scene.add(pole);
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0x4dd4ff, emissive: 0x4dd4ff, emissiveIntensity: 2.2 })
      );
      lamp.position.set(s * (ROAD_W / 2 + 2.5), 9, z);
      scene.add(lamp);
    });
  }

  /* ---- Shops ---- */
  const shops = [];
  data.repos.forEach((repo, i) => {
    const z = SPACING * (i + 1);
    const side = i % 2 === 0 ? 1 : -1;
    const x = side * (ROAD_W / 2 + 10);
    const h = 13 + Math.min(repo.stars, 50) * 0.6;
    const [r, g, b] = colorForLanguage(repo.language);
    const col = new THREE.Color(r / 255, g / 255, b / 255);

    const building = new THREE.Mesh(
      new THREE.BoxGeometry(15, h, 15),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, metalness: 0.15, emissive: col, emissiveIntensity: 0.05 })
    );
    building.position.set(x, h / 2, z);
    building.castShadow = true; building.receiveShadow = true;
    scene.add(building);

    const band = new THREE.Mesh(
      new THREE.BoxGeometry(15.6, 2.6, 15.6),
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.4 })
    );
    band.position.set(x, h - 2.6, z);
    scene.add(band);

    const door = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 6.5, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x0c0818, emissive: col, emissiveIntensity: 0.15 })
    );
    door.position.set(x - side * 7.6, 3.25, z);
    door.rotation.y = Math.PI / 2;
    scene.add(door);

    const label = makeLabel(repo.name, `★ ${repo.stars} · ${repo.language}`);
    label.position.set(x, h + 7, z);
    scene.add(label);

    shops.push({ x, z, repo, band });
  });

  const endLabel = makeLabel("end of the road", "turn around, explorer");
  endLabel.position.set(0, 9, ROAD_LEN + 20);
  scene.add(endLabel);

  /* ---- Car state + first-person dashboard ---- */
  const carPos = new THREE.Vector3(0, 0, 0);
  let lane = 0, speed = 0;
  const MAXF = 48, MAXR = 16, ACCEL = 36, FRICTION = 22, STEER = 15;

  const dash = new THREE.Group();
  const hood = new THREE.Mesh(
    new THREE.BoxGeometry(5.4, 1.3, 2.4),
    new THREE.MeshStandardMaterial({ color: 0xff4d9d, roughness: 0.25, metalness: 0.6, emissive: 0x3a0f28, emissiveIntensity: 0.4 })
  );
  hood.position.set(0, -1.28, -2.15);
  dash.add(hood);
  const wheel = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.09, 14, 36),
    new THREE.MeshStandardMaterial({ color: 0x0e0d16, roughness: 0.4, metalness: 0.3 })
  );
  wheel.position.set(0, -0.98, -1.35);
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

  const speedVal = el("speedVal");
  const clock = new THREE.Clock();
  let t = 0;

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;

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
      carPos.z = Math.max(-10, Math.min(ROAD_LEN + 25, carPos.z));
      carPos.x = lane;
    }

    // First-person camera: speed-based FOV + subtle bob
    const sp01 = Math.abs(speed) / MAXF;
    const bob = Math.sin(t * 9) * 0.05 * sp01;
    camera.fov = BASE_FOV + sp01 * 14;
    camera.updateProjectionMatrix();
    camera.position.set(carPos.x, 2.1 + bob, carPos.z);
    camera.lookAt(carPos.x, 1.9, carPos.z + 10);
    // slight steering tilt of the dashboard
    dash.rotation.z = THREE.MathUtils.lerp(dash.rotation.z, (lane / LANE_MAX) * -0.05, 0.1);

    if (speedVal) speedVal.textContent = Math.round(Math.abs(speed) * 3.2);

    // Approach detection
    let near = null, best = 46;
    for (const s of shops) {
      s.band.material.emissiveIntensity = 1.4;
      const d = Math.abs(s.z - carPos.z);
      if (d < best) { best = d; near = s; }
    }
    if (near) near.band.material.emissiveIntensity = 3.2;
    currentNear = near ? { repo: near.repo, ahead: near.z - carPos.z } : null;
    updatePrompt(currentNear);

    composer.render();
  }
  animate();

  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    bloom.setSize(innerWidth, innerHeight);
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
  ctx.fillStyle = "#d8d2f2";
  ctx.fillText(sub, 256, 104);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(17, 5.3, 1);
  return sprite;
}

/* ------------------------------------------------------------------ */
/*  HUD prompt                                                         */
/* ------------------------------------------------------------------ */
const promptEl = el("prompt");
function updatePrompt(near) {
  if (paused || !near) { promptEl.classList.add("hidden"); return; }
  const name = escapeHtml(near.repo.name);
  promptEl.innerHTML = near.ahead > 14
    ? `Approaching <b>${name}</b> — press <kbd>E</kbd> to stop`
    : `<b>${name}</b> — press <kbd>E</kbd> to pull over & chat`;
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
