// city.js — GitHub City: your profile as a neon skyline.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
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

let OWNER = "";

async function start() {
  const username = usernameInput.value.trim();
  if (!username) return;
  startError.textContent = "";
  loading.style.display = "block";
  startBtn.disabled = true;
  try {
    const data = await fetchGitHubData(username, 24);
    if (!data.repos.length) throw new Error("No public (non-fork) repos found for this user.");
    OWNER = data.profile.login;
    startScreen.style.display = "none";
    buildCity(data);
  } catch (err) {
    startError.textContent = err.message;
  } finally {
    loading.style.display = "none";
    startBtn.disabled = false;
  }
}

/* ------------------------------------------------------------------ */
/*  Window-light texture (what makes the towers read as a city)        */
/* ------------------------------------------------------------------ */
function windowTexture([r, g, b], wUnits, hUnits, dim = false) {
  const cols = Math.max(3, Math.round(wUnits / 2.4));
  const floors = Math.max(5, Math.round(hUnits / 3.2));
  const cell = 14;
  const c = document.createElement("canvas");
  c.width = cols * cell; c.height = floors * cell;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#04050a";
  ctx.fillRect(0, 0, c.width, c.height);
  const litChance = dim ? 0.28 : 0.62;
  for (let fy = 0; fy < floors; fy++) {
    for (let fx = 0; fx < cols; fx++) {
      const pad = 3;
      if (Math.random() < litChance) {
        const k = 0.45 + Math.random() * 0.55;
        const rr = Math.min(255, r * k + (dim ? 10 : 50));
        const gg = Math.min(255, g * k + (dim ? 10 : 50));
        const bb = Math.min(255, b * k + (dim ? 10 : 50));
        ctx.fillStyle = `rgb(${rr | 0},${gg | 0},${bb | 0})`;
      } else {
        ctx.fillStyle = "#070a12";
      }
      ctx.fillRect(fx * cell + pad, fy * cell + pad, cell - 2 * pad, cell - 2 * pad);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  return t;
}

/* spiral grid coords (so the tallest/most-starred cluster at the centre) */
function spiralCells(count) {
  const out = [[0, 0]];
  let x = 0, y = 0, d = 1;
  while (out.length < count) {
    for (let i = 0; i < d; i++) { x += 1; out.push([x, y]); }
    for (let i = 0; i < d; i++) { y += 1; out.push([x, y]); }
    d += 1;
    for (let i = 0; i < d; i++) { x -= 1; out.push([x, y]); }
    for (let i = 0; i < d; i++) { y -= 1; out.push([x, y]); }
    d += 1;
  }
  return out.slice(0, count);
}

/* ------------------------------------------------------------------ */
/*  City                                                               */
/* ------------------------------------------------------------------ */
let renderer, scene, camera, composer, controls, bloom, raycaster, pointer;
let repoMeshes = [];
let hovered = null;
let panelOpen = false;
const tween = { active: false };

function buildCity(data) {
  const canvas = el("game");
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060d);
  scene.fog = new THREE.Fog(0x05060d, 180, 620);

  camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.5, 3000);
  camera.position.set(260, 220, 320);

  // Post FX
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.62, 0.45, 0.8);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.minDistance = 45;
  controls.maxDistance = 700;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.22;
  controls.target.set(0, 18, 0);
  controls.addEventListener("start", () => { controls.autoRotate = false; });

  // Lights
  scene.add(new THREE.HemisphereLight(0x5566aa, 0x05060d, 0.5));
  const key = new THREE.DirectionalLight(0x9fb4ff, 0.5);
  key.position.set(200, 400, 100);
  scene.add(key);

  // Ground (glossy) + street grid
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 4000),
    new THREE.MeshStandardMaterial({ color: 0x070910, roughness: 0.35, metalness: 0.6 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const grid = new THREE.GridHelper(3000, 180, 0x1a2550, 0x0d1230);
  grid.position.y = 0.1;
  scene.add(grid);

  // Stars
  const starGeo = new THREE.BufferGeometry();
  const sp = new Float32Array(1500 * 3);
  for (let i = 0; i < 1500; i++) {
    const rad = 900 + Math.random() * 700;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.random() * Math.PI * 0.5;
    sp[i * 3] = Math.cos(th) * Math.sin(ph) * rad;
    sp[i * 3 + 1] = Math.cos(ph) * rad * 0.6 + 120;
    sp[i * 3 + 2] = Math.sin(th) * Math.sin(ph) * rad;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x8899cc, size: 1.6, transparent: true, opacity: 0.7 })));

  // ---- Layout
  const STEP = 40;
  const repos = [...data.repos].sort((a, b) => b.stars - a.stars);
  const maxStars = Math.max(1, repos[0].stars);
  const cells = spiralCells(repos.length);
  const used = new Set(cells.map(([x, y]) => x + "," + y));

  // Filler skyline (dim grey buildings) around the real towers
  const fillerTex = [0, 1, 2].map(() => windowTexture([150, 165, 210], 16, 40, true));
  const span = Math.ceil(Math.sqrt(repos.length)) + 6;
  for (let gx = -span; gx <= span; gx++) {
    for (let gy = -span; gy <= span; gy++) {
      if (used.has(gx + "," + gy)) continue;
      if (Math.random() > 0.72) continue;
      const w = 12 + Math.random() * 7, h = 8 + Math.random() * 46, d = 12 + Math.random() * 7;
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: 0x0a0d18, emissive: 0x9fb0dd, emissiveMap: fillerTex[(gx + gy + 99) % 3], emissiveIntensity: 0.35, roughness: 0.7 })
      );
      m.position.set(gx * STEP + (Math.random() - 0.5) * 6, h / 2, gy * STEP + (Math.random() - 0.5) * 6);
      scene.add(m);
    }
  }

  // ---- Repo towers
  repoMeshes = [];
  repos.forEach((repo, i) => {
    const [gx, gy] = cells[i];
    const col = colorForLanguage(repo.language);
    const h = 16 + Math.log2(repo.stars + 1) * 11 + 6;
    const w = 18, d = 18;
    const tex = windowTexture(col, w, h, false);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x090c16, emissive: new THREE.Color(col[0] / 255, col[1] / 255, col[2] / 255),
      emissiveMap: tex, emissiveIntensity: 1.0, roughness: 0.5, metalness: 0.2,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(gx * STEP, h / 2, gy * STEP);
    mesh.userData = { repo, baseEmissive: 1.0, top: h };
    scene.add(mesh);

    // glowing roof trim
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(w + 1.5, 1.4, d + 1.5),
      new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(col[0] / 255, col[1] / 255, col[2] / 255), emissiveIntensity: 2.4 })
    );
    trim.position.set(gx * STEP, h, gy * STEP);
    scene.add(trim);

    // floating label
    const label = makeLabel(repo.name, `★ ${repo.stars} · ${repo.language}`);
    label.position.set(gx * STEP, h + 12, gy * STEP);
    label.userData = { forMesh: mesh };
    scene.add(label);
    mesh.userData.label = label;

    repoMeshes.push(mesh);
  });

  // ---- Raycaster / interaction
  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("click", onClick);
  addEventListener("keydown", (e) => { if (e.key === "Escape" && panelOpen) closePanel(); });
  addEventListener("resize", onResize);

  // HUD
  el("hudOwner").textContent = "@" + OWNER;
  el("hudSub").textContent = `${data.repos.length} repos · tallest = most starred`;
  buildLegend(repos);
  el("hud").classList.remove("hidden");
  el("legend").classList.remove("hidden");
  el("hint").classList.remove("hidden");

  // Intro fly-in
  tweenCamera(new THREE.Vector3(150, 95, 185), new THREE.Vector3(0, 18, 0), 2.2, false);

  animate();
}

function makeLabel(title, sub) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 150;
  const ctx = c.getContext("2d");
  ctx.textAlign = "center";
  ctx.font = "700 44px 'Space Grotesk', sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(title.slice(0, 22), 256, 52);
  ctx.font = "400 26px Inter, sans-serif";
  ctx.fillStyle = "#9fb0dd";
  ctx.fillText(sub, 256, 96);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  sprite.scale.set(34, 10, 1);
  sprite.renderOrder = 2;
  return sprite;
}

function buildLegend(repos) {
  const langs = {};
  repos.forEach((r) => { langs[r.language] = (langs[r.language] || 0) + 1; });
  const top = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const box = el("legend");
  box.innerHTML = top.map(([lang]) => {
    const [r, g, b] = colorForLanguage(lang);
    return `<div class="legend-row"><span class="legend-sw" style="background:rgb(${r},${g},${b});color:rgb(${r},${g},${b})"></span>${lang}</div>`;
  }).join("");
}

/* ------------------------------------------------------------------ */
/*  Interaction                                                        */
/* ------------------------------------------------------------------ */
function setPointer(e) {
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / innerHeight) * 2 + 1;
}

function onPointerMove(e) {
  setPointer(e);
  if (panelOpen) return;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(repoMeshes, false)[0];
  const tip = el("tooltip");
  if (hovered && (!hit || hit.object !== hovered)) {
    hovered.material.emissiveIntensity = hovered.userData.baseEmissive;
    hovered = null;
  }
  if (hit) {
    hovered = hit.object;
    hovered.material.emissiveIntensity = 1.8;
    document.body.style.cursor = "pointer";
    tip.textContent = hovered.userData.repo.name;
    tip.style.left = e.clientX + "px";
    tip.style.top = e.clientY + "px";
    tip.classList.remove("hidden");
  } else {
    document.body.style.cursor = "default";
    tip.classList.add("hidden");
  }
}

function onClick(e) {
  if (panelOpen) return;
  setPointer(e);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(repoMeshes, false)[0];
  if (!hit) return;
  const mesh = hit.object;
  const repo = mesh.userData.repo;
  // focus camera on the tower
  const p = mesh.position;
  const camTo = new THREE.Vector3(p.x + 55, mesh.userData.top * 0.7 + 35, p.z + 55);
  tweenCamera(camTo, new THREE.Vector3(p.x, mesh.userData.top * 0.5, p.z), 1.0, true);
  openShop(repo);
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  bloom.setSize(innerWidth, innerHeight);
}

/* camera tween */
function tweenCamera(toPos, toTarget, dur, openingPanel) {
  tween.active = true;
  tween.t = 0; tween.dur = dur;
  tween.fromPos = camera.position.clone();
  tween.toPos = toPos.clone();
  tween.fromTarget = controls.target.clone();
  tween.toTarget = toTarget.clone();
  controls.enabled = false;
  controls.autoRotate = false;
}

/* ------------------------------------------------------------------ */
/*  Loop                                                               */
/* ------------------------------------------------------------------ */
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (tween.active) {
    tween.t += dt / tween.dur;
    const k = tween.t >= 1 ? 1 : 1 - Math.pow(1 - tween.t, 3); // easeOutCubic
    camera.position.lerpVectors(tween.fromPos, tween.toPos, k);
    controls.target.lerpVectors(tween.fromTarget, tween.toTarget, k);
    if (tween.t >= 1) { tween.active = false; controls.enabled = !panelOpen; }
  }

  // make labels face the camera is automatic for sprites; hide far labels for clarity
  for (const m of repoMeshes) {
    const lbl = m.userData.label;
    const dist = camera.position.distanceTo(m.position);
    lbl.material.opacity = THREE.MathUtils.clamp(1.6 - dist / 280, 0, 1);
  }

  controls.update();
  composer.render();
}

/* ------------------------------------------------------------------ */
/*  Panel: chat + files                                                */
/* ------------------------------------------------------------------ */
const chatEl = el("chat");
const chatTitle = el("chatTitle");
const chatMeta = el("chatMeta");
const chatLog = el("chatLog");
const chatChips = el("chatChips");
const chatInput = el("chatInput");
const chatSend = el("chatSend");
const chatClose = el("chatClose");
const tabChat = el("tabChat");
const tabFiles = el("tabFiles");
const chatView = el("chatView");
const filesView = el("filesView");

let activeRepo = null;
let history = [];

chatSend.addEventListener("click", send);
chatClose.addEventListener("click", closePanel);
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

function openShop(repo) {
  panelOpen = true;
  controls.autoRotate = false;
  activeRepo = repo;
  history = [];
  chatTitle.textContent = repo.name;
  chatMeta.textContent = `★ ${repo.stars} · ${repo.language}`;
  switchTab("chat");
  chatLog.innerHTML = "";
  addBubble("model", `Hey! I'm ${repo.name}. ${repo.description || "Welcome in."} Ask me what I do, why I'm handy, or how I was built — or hit 📁 Files to look around.`);
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

function closePanel() {
  panelOpen = false;
  activeRepo = null;
  chatEl.classList.add("hidden");
  controls.enabled = true;
}

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
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
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
