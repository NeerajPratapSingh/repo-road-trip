# 🚗 Repo Road Trip

Drive through any GitHub profile in a little lofi town. **Every repo is a shop** you can
pull up to and *chat with* — ask what it does, why it's useful, or how it was built. The
answers are grounded in that repo's real README, description, language and stars.

Built with **vanilla JS + [KAPLAY](https://kaplayjs.com/)** on the front end, the
**GitHub REST API** for the data, and the **Google Gemini API** (behind a serverless
proxy) for the shop chats.

---

## ✨ What it shows off

- **Two external APIs** working together — GitHub (data) + Gemini (chat).
- **Context engineering** — each repo's README/metadata is fed to the model as grounded context.
- **A real backend** — a Vercel serverless function keeps the API key secret.
- **A creative, memorable front end** — not another CRUD app.

---

## 🧱 How it's put together

```
repo-road-trip/
├── index.html        # start screen, game canvas, chat panel
├── style.css         # lofi styling
├── github.js         # fetches profile + repos + READMEs from the GitHub API
├── game.js           # KAPLAY world: car, roads, repo shops, proximity, chat wiring
├── api/
│   └── chat.js        # Vercel serverless → proxies to Gemini (hides your key)
├── package.json
├── vercel.json
└── .env.example
```

**Flow:** type a username → `github.js` pulls the repos → `game.js` drops each one as a
shop in the world → drive up and press **E** → the chat posts the repo's context to
`/api/chat` → the serverless function calls Gemini and streams back the reply.

---

## ▶️ Run it locally

You need the serverless function running, so use the Vercel CLI (not a plain static server).

```bash
# 1. Install the Vercel CLI once
npm i -g vercel

# 2. Get a free Gemini key (no credit card): https://aistudio.google.com/apikey
cp .env.example .env.local
#   then edit .env.local and paste your key into GEMINI_API_KEY

# 3. Run
vercel dev
```

Open the local URL it prints (usually `http://localhost:3000`), type a GitHub
username, and drive in.

> Plain `index.html` in the browser will load the town, but the **chat won't work**
> without the serverless function — so use `vercel dev`.

---

## 🚀 Deploy (free, ~2 min)

1. Push this folder to a GitHub repo.
2. Go to [vercel.com](https://vercel.com) → **New Project** → import that repo.
3. In the project's **Settings → Environment Variables**, add:
   - `GEMINI_API_KEY` = your key
4. Deploy. You get a shareable `your-project.vercel.app` link.

---

## 🎮 Controls

- **WASD / arrow keys** — drive
- **E** — enter the nearest shop
- **Esc** — leave the shop

---

## 🛠️ Easy things to customize

- **More/less shops:** `fetchGitHubData(username, maxRepos)` in `github.js`.
- **Model:** change `MODEL` in `api/chat.js` (e.g. a newer Gemini model).
- **Vibe:** colors live in `:root` in `style.css`; shop colors in `colorForLanguage()`.
- **Shopkeeper personality:** edit the `system` prompt in `api/chat.js`.
- **Add lofi music:** drop an audio loop and play it on first key press (browsers block autoplay until a user interacts).

---

## 📄 Resume line

> Built **Repo Road Trip** — an interactive retro web app (KAPLAY/JS) that maps any
> GitHub profile as a drivable town of chattable project "shops," using the **GitHub +
> Gemini APIs** with a Vercel serverless proxy for secure key handling and context-grounded
> responses.

---

## ⚠️ Notes

- Unauthenticated GitHub API calls are rate-limited to ~60/hour per IP — fine for a demo.
- Gemini's free tier is generous but has per-minute limits; the shopkeeper keeps replies short to stay well within them.
