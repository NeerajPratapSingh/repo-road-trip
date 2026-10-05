// api/chat.js — Vercel serverless function.
// Proxies chat requests to the Google Gemini API so your API key stays secret
// (it lives in the GEMINI_API_KEY env var on the server, never in the browser).

const MODEL = "gemini-1.5-flash"; // free-tier friendly; swap for a newer model if you like

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "Server is missing GEMINI_API_KEY" });
  }

  try {
    const { repo, messages } = req.body || {};
    if (!repo || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Expected { repo, messages }" });
    }

    // The "shopkeeper" persona + the real project context from GitHub.
    const system = [
      `You are the "shopkeeper" of a software project called "${repo.name}".`,
      `Speak in first person as if you ARE the project, in a warm, chill, lofi tone.`,
      `Keep every reply to 2–4 short sentences. Be concrete and friendly.`,
      `Use ONLY the context below. If something isn't covered, say you're not sure`,
      `instead of inventing details.`,
      ``,
      `PROJECT CONTEXT`,
      `Name: ${repo.name}`,
      `Language: ${repo.language || "Unknown"}`,
      `Stars: ${repo.stars ?? 0}`,
      `Description: ${repo.description || "(none)"}`,
      `Topics: ${(repo.topics || []).join(", ") || "(none)"}`,
      `README (truncated):`,
      repo.readme ? repo.readme.slice(0, 3500) : "(no README available)",
    ].join("\n");

    // Map our message history to Gemini's format.
    const contents = messages.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: String(m.text || "") }],
    }));

    const body = {
      system_instruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 300 },
    };

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

    const g = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await g.json();
    if (!g.ok) {
      return res.status(502).json({ error: data?.error?.message || "Gemini API error" });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "Hmm, I blanked out for a sec — ask me again?";

    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Unknown server error" });
  }
}
