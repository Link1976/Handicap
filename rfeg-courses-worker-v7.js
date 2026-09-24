/**
 * Cloudflare Worker: RFEG Course Data + Auth Proxy (v7)
 * ======================================================
 * 
 * Endpoints:
 *   GET  /?search=rejas                             → Search clubs by name
 *   GET  /?club_id=12752&slug=golf-los-retamares    → Get tee data for a club
 *   GET  /?pdf=924203                               → Download PDF (public token)
 *   GET  /?player=nombre                            → Search player by name/license (public)
 *   POST /?auth_pdf=26291                           → Login + download PDF via api.rfegolf.es
 *   POST /?auth_handicap=328208                     → Login + get HI (works for ANY federatedId)
 *   POST /?auth_scores=26291                        → Login + get scores (own/linked only)
 */

const RFEG_WEB = "https://rfegolf.es";
const RFEGOLF_API = "https://api.rfegolf.es";
const SEARCH_CACHE_TTL = 7 * 24 * 3600;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);

    try {
      // --- GET endpoints ---
      const search = url.searchParams.get("search");
      const clubId = url.searchParams.get("club_id");
      const slug = url.searchParams.get("slug");
      const pdf = url.searchParams.get("pdf");
      const player = url.searchParams.get("player");

      if (request.method === "GET") {
        if (pdf) return await fetchPDF(pdf);
        if (player) return await searchPlayer(player);
        if (search) {
          if (search.trim().length < 2) return json({ query: search, results: [] });
          return json({ query: search, results: await searchClubs(search, env) });
        }
        if (clubId) {
          if (!slug) return json({ error: "slug parameter required" }, 400);
          return json(await getClubCourses(clubId, slug, env));
        }
        return json({ service: "RFEG Course Data + Auth API", version: "7.0" });
      }

      // --- POST endpoints (authenticated) ---
      if (request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const { username, password } = body;
        if (!username || !password) {
          return json({ error: "username and password required" }, 400);
        }

        const authPdf = url.searchParams.get("auth_pdf");
        const authHandicap = url.searchParams.get("auth_handicap");
        const authScores = url.searchParams.get("auth_scores");

        if (authPdf) return await authenticatedPDF(username, password, authPdf);
        if (authHandicap) return await authenticatedHandicap(username, password, authHandicap);
        if (authScores) return await authenticatedScores(username, password, authScores);

        return json({ error: "Unknown POST endpoint" }, 400);
      }

      return json({ error: "Method not allowed" }, 405);
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { headers: CORS, status });
}

// ─── Authentication ─────────────────────────────────────────────────────────

async function rfegLogin(username, password) {
  const resp = await fetch(`${RFEGOLF_API}/auth/login?realm=FED`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    body: JSON.stringify({ username, password }),
    redirect: "manual",
  });

  if (!resp.ok && resp.status !== 302) {
    throw new Error(`Login failed: ${resp.status}`);
  }

  // Collect Set-Cookie headers
  const cookies = [];
  // CF Workers: headers.getAll may not exist, iterate raw headers
  for (const [key, value] of resp.headers.entries()) {
    if (key.toLowerCase() === "set-cookie") {
      cookies.push(value);
    }
  }

  const cookieStr = cookies
    .map(c => c.split(";")[0].trim())
    .filter(c => c.length > 0)
    .join("; ");

  if (!cookieStr) {
    throw new Error(resp.status === 200 ? "Credenciales incorrectas" : `Login fallido (HTTP ${resp.status})`);
  }

  return cookieStr;
}

async function authGet(cookies, path) {
  return fetch(`${RFEGOLF_API}${path}`, {
    headers: {
      "Cookie": cookies,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json, application/pdf, */*",
    },
  });
}

// ─── Authenticated Endpoints ────────────────────────────────────────────────

async function authenticatedPDF(username, password, federatedId) {
  const cookies = await rfegLogin(username, password);
  const resp = await authGet(cookies, `/whs/${federatedId}/world-handicap`);

  if (resp.status === 403) {
    return json({
      error: "forbidden",
      message: "No tienes acceso al PDF de este jugador. Solo puedes ver tu perfil y jugadores vinculados."
    }, 403);
  }
  if (!resp.ok) return json({ error: `API error: ${resp.status}` }, resp.status);

  return new Response(resp.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST",
      "Cache-Control": "no-cache",
    },
  });
}

async function authenticatedHandicap(username, password, federatedId) {
  const cookies = await rfegLogin(username, password);
  const resp = await authGet(cookies, `/federated/${federatedId}/handicap`);
  if (!resp.ok) return json({ error: `API error: ${resp.status}` }, resp.status);
  const data = await resp.json();
  return json(data);
}

async function authenticatedScores(username, password, federatedId) {
  const cookies = await rfegLogin(username, password);
  const resp = await authGet(cookies, `/federated/${federatedId}/scores`);
  if (resp.status === 403) {
    return json({ error: "forbidden", message: "No tienes acceso a las puntuaciones de este jugador." }, 403);
  }
  if (!resp.ok) return json({ error: `API error: ${resp.status}` }, resp.status);
  const data = await resp.json();
  return json(data);
}

// ─── Public Token ───────────────────────────────────────────────────────────

async function getFreshToken() {
  const resp = await fetch(`${RFEG_WEB}/clubes`, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", "Accept": "text/html" },
  });
  if (!resp.ok) throw new Error("Could not fetch rfegolf.es to get token");
  const html = await resp.text();
  const m = html.match(/coded_[a-f0-9]+/);
  if (!m) throw new Error("Could not extract auth token from rfegolf.es");
  return "Bearer " + m[0];
}

async function searchPlayer(query) {
  const token = await getFreshToken();
  const resp = await fetch(`https://api.rfeg.es/web/search/handicap?q=${encodeURIComponent(query)}`, {
    headers: { "Authorization": token, "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
  });
  if (!resp.ok) return json({ error: `Search error: ${resp.status}` }, resp.status);
  const body = await resp.json();
  const hits = (body.data && body.data.hits) || [];
  return json({
    results: hits.map(h => ({
      id_ref: h.document.id_ref,
      guid_licence: h.document.guid_licence,
      full_name: h.document.full_name,
      handicap: h.document.handicap,
      club: h.document.club_title,
      federation: h.document.federation_title,
      updated: h.document.date_hdc_updated_at,
    })),
  });
}

// ─── Search Clubs ───────────────────────────────────────────────────────────
// rfegolf.es migrated to WordPress (2026). Clubs are a custom post type exposed
// through the standard WP REST API; the old api.rfeg.es search + coded_ token
// no longer exist.

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function searchClubs(query, env) {
  const cacheKey = `wpsearch_${query.toLowerCase().trim()}`;
  if (env?.RFEG_CACHE) {
    const cached = await env.RFEG_CACHE.get(cacheKey);
    if (cached) return JSON.parse(cached);
  }
  const results = await searchViaWordPress(query);
  if (env?.RFEG_CACHE && results.length > 0) {
    await env.RFEG_CACHE.put(cacheKey, JSON.stringify(results), { expirationTtl: SEARCH_CACHE_TTL });
  }
  return results;
}

async function searchViaWordPress(query) {
  const url = `${RFEG_WEB}/wp-json/wp/v2/club?search=${encodeURIComponent(query)}&per_page=20&_fields=id,slug,yoast_head_json.title`;
  const resp = await fetch(url, { headers: { "User-Agent": BROWSER_UA, "Accept": "application/json" } });
  if (!resp.ok) throw new Error(`RFEG search error: ${resp.status}`);
  const body = await resp.json();
  return (Array.isArray(body) ? body : []).map(c => ({
    id: c.id,
    name: decodeEntities((c.yoast_head_json?.title || c.slug).replace(/\s*(&#8211;|–|-)\s*RFEG\s*$/i, "")),
    slug: c.slug,
    city: "", community: "", holes: 0,
  }));
}

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
}

// ─── Club Course Data ───────────────────────────────────────────────────────

async function getClubCourses(clubId, slug, env) {
  // Cache disabled: always scrape live to ensure CR/Slope are up to date
  return await scrapeClubPage(clubId, slug);
}

async function fetchClubHTML(slug) {
  return fetch(`${RFEG_WEB}/club/${encodeURIComponent(slug)}`, {
    headers: { "User-Agent": BROWSER_UA, "Accept": "text/html,application/xhtml+xml" },
    redirect: "follow",
  });
}

async function scrapeClubPage(clubId, slug) {
  let resp = await fetchClubHTML(slug);
  if (resp.status === 404) {
    // Favourites saved before the migration carry old-site slugs
    // (e.g. "forus_golf_las_rejas"). Resolve them via the new search.
    const hits = await searchViaWordPress(slug.replace(/[-_]+/g, " "));
    if (hits.length > 0) { slug = hits[0].slug; clubId = hits[0].id; resp = await fetchClubHTML(slug); }
  }
  if (!resp.ok) throw new Error(`Club page not found: ${resp.status}`);
  return parseClubHTML(await resp.text(), clubId, slug);
}

// Club page layout (new WordPress site):
//   <option value="rcpanel_{post}_{course}_{n}">CLUB - Recorrido - TEE (M|F) emoji</option>
//   <div class="holes-table-panel" id="rcpanel_{post}_{course}_{n}"> scorecard table
//     rows: Par / Hdcp / Metros, last cell = total
//     <div class="holes-table-footer"><span>Vc: 71.5</span><span>Vs: 127</span></div>
function parseClubHTML(html, clubId, slug) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const club = h1 ? decodeEntities(h1[1].replace(/<[^>]+>/g, "").trim()) : "Unknown";

  const optRe = /<option value="(rcpanel_[\d_]+)">([^<]*)<\/option>/g;
  const tees = [];
  let om;
  while ((om = optRe.exec(html)) !== null) {
    const panelId = om[1];
    const label = decodeEntities(om[2]).trim();
    const lm = label.match(/^(.*) - (.+?)\s*\(([MF])\)/);
    if (!lm) continue;
    const dashIdx = lm[1].lastIndexOf(" - ");
    const recorrido = (dashIdx >= 0 ? lm[1].substring(dashIdx + 3) : lm[1]).replace(/\s+/g, " ").trim();

    const anchor = `id="${panelId}"`;
    const secStart = html.indexOf(anchor);
    if (secStart < 0) continue;
    const rest = html.slice(secStart + anchor.length);
    const next = rest.search(/id="rcpanel_[\d_]+"/);
    const section = next >= 0 ? rest.slice(0, next) : rest;

    const vc = section.match(/Vc:\s*([\d]+[.,]?\d*)/);
    const vs = section.match(/Vs:\s*(\d+)/);
    if (!vc || !vs) continue;
    tees.push({
      recorrido, tee: lm[2].trim(), gender: lm[3],
      par: rowTotal(section, "Par"),
      vc: parseFloat(vc[1].replace(",", ".")),
      vs: parseInt(vs[1]),
      meters: rowTotal(section, "Metros"),
    });
  }
  return { club, club_id: parseInt(clubId), slug, total_tees: tees.length, tees, source: "rfegolf.es", scraped_at: new Date().toISOString() };
}

// Last <td> of the scorecard row labelled `label` (the TOTAL column).
function rowTotal(section, label) {
  const row = section.match(new RegExp(`holes-table-col-label">${label}</td>([\\s\\S]*?)</tr>`));
  if (!row) return 0;
  const cells = [...row[1].matchAll(/<td[^>]*>\s*(\d*)\s*<\/td>/g)].map(m => m[1]).filter(Boolean);
  return cells.length ? parseInt(cells[cells.length - 1]) : 0;
}

// ─── Fetch PDF with Public Token ─────────────────────────────────────────────

async function fetchPDF(license) {
  // The RFEG file server (api.rfeg.es) returns HTTP 500 randomly ~50% of the
  // time for a valid license. Retry a few times server-side so the caller does
  // not have to click repeatedly until it succeeds.
  const MAX_ATTEMPTS = 5;
  const RETRY_DELAY_MS = 400;
  // Since the 2026 WordPress migration rfegolf.es no longer embeds the coded_
  // token, and the PDF endpoint serves without it. Send it only if found.
  const token = await getFreshToken().catch(() => null);
  const auth = token ? { "Authorization": token } : {};
  const pdfUrl = `https://api.rfeg.es/files/summaryhandicap/${license}.pdf`;
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  let lastStatus = 0;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const resp = await fetch(pdfUrl, {
      redirect: "manual",
      headers: { ...auth, "User-Agent": ua, "Accept": "application/pdf,*/*" },
    });
    let finalResp = resp;
    if ([301,302,307,308].includes(resp.status)) {
      const loc = resp.headers.get("location");
      if (loc) finalResp = await fetch(loc, { headers: { ...auth, "User-Agent": "Mozilla/5.0", "Accept": "application/pdf,*/*" } });
    }
    if (finalResp.ok) {
      return new Response(finalResp.body, {
        status: 200,
        headers: { "Content-Type": "application/pdf", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST", "Cache-Control": "no-cache" },
      });
    }
    lastStatus = finalResp.status;
    if (attempt < MAX_ATTEMPTS) await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
  }
  return new Response(`RFEG PDF error: ${lastStatus}`, { status: lastStatus, headers: { "Access-Control-Allow-Origin": "*" } });
}
