// github.js — fetches public GitHub data. No auth needed for public profiles.
// (Unauthenticated requests are rate-limited to ~60/hour per IP, which is plenty for a demo.)

const GH = "https://api.github.com";

export async function fetchGitHubData(username, maxRepos = 8) {
  // 1) Profile
  const uResp = await fetch(`${GH}/users/${encodeURIComponent(username)}`);
  if (uResp.status === 404) throw new Error(`User "${username}" not found.`);
  if (!uResp.ok) throw new Error(`GitHub error loading profile (${uResp.status}).`);
  const profile = await uResp.json();

  // 2) Repos (most recently updated first, then we rank by stars)
  const rResp = await fetch(
    `${GH}/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=100`
  );
  if (!rResp.ok) throw new Error(`GitHub error loading repos (${rResp.status}).`);
  let repos = await rResp.json();

  repos = repos
    .filter((r) => !r.fork) // skip forks — show what they actually built
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, maxRepos);

  // 3) READMEs in parallel (best-effort — a missing README is fine)
  const withReadme = await Promise.all(
    repos.map(async (r) => {
      let readme = "";
      try {
        const rd = await fetch(`${GH}/repos/${profile.login}/${r.name}/readme`, {
          headers: { Accept: "application/vnd.github.raw" },
        });
        if (rd.ok) readme = (await rd.text()).slice(0, 4000);
      } catch (_) {
        /* ignore — no README */
      }
      return {
        name: r.name,
        description: r.description || "",
        language: r.language || "Unknown",
        stars: r.stargazers_count,
        url: r.html_url,
        topics: r.topics || [],
        readme,
      };
    })
  );

  return {
    profile: {
      login: profile.login,
      name: profile.name || profile.login,
      avatar: profile.avatar_url,
      bio: profile.bio || "",
      followers: profile.followers,
      publicRepos: profile.public_repos,
    },
    repos: withReadme,
  };
}

// A small, stable palette keyed by language so each shop gets a consistent color.
export function colorForLanguage(lang) {
  const map = {
    JavaScript: [240, 219, 79],
    TypeScript: [49, 120, 198],
    Python: [53, 114, 165],
    Java: [176, 114, 25],
    "C++": [243, 75, 125],
    C: [85, 85, 85],
    HTML: [227, 76, 38],
    CSS: [86, 61, 124],
    Dart: [0, 180, 216],
    Go: [0, 173, 216],
    Rust: [222, 165, 132],
    Shell: [137, 224, 81],
    Ruby: [204, 52, 45],
    Unknown: [150, 150, 160],
  };
  return map[lang] || [120, 170, 200];
}

/* List a repo's files/folders at a given path (top level by default). */
export async function fetchRepoContents(owner, repo, path = "") {
  const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`);
  if (!r.ok) throw new Error(`Couldn't load files (${r.status}).`);
  const d = await r.json();
  const list = Array.isArray(d) ? d : [d];
  return list
    .map((x) => ({ name: x.name, type: x.type, path: x.path, download_url: x.download_url, size: x.size }))
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
}

/* Fetch a text file's contents (truncated). */
export async function fetchFileText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Couldn't open that file.");
  return (await r.text()).slice(0, 20000);
}
