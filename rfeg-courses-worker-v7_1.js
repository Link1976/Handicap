/**
 * Cloudflare Worker: RFEG Course Data + Auth Proxy (v7)
 * ======================================================
 * 
 * Endpoints:
 *   GET  /?search=rejas                             → Search clubs by name
 *   GET  /?club_id=448&slug=forus_golf_las_rejas    → Get tee data for a club
 *   GET  /?pdf=924203                               → Download PDF (public token)
 *   GET  /?player=nombre                            → Search player by name/license (public)
 *   POST /?auth_pdf=26291                           → Login + download PDF via api.rfegolf.es
 *   POST /?auth_handicap=328208                     → Login + get HI (works for ANY federatedId)
 *   POST /?auth_scores=26291                        → Login + get scores (own/linked only)
 */

const RFEG_WEB = "https://rfegolf.es";
const RFEGOLF_API = "https://api.rfegolf.es";
const COURSE_CACHE_TTL = 30 * 24 * 3600;
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

        const debugLogin = url.searchParams.has("debug_login");
        if (debugLogin) return await debugLoginEndpoint(username, password);

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

// ─── Debug ──────────────────────────────────────────────────────────────────

async function debugLoginEndpoint(username, password) {
  const resp = await fetch(`${RFEGOLF_API}/auth/login?realm=FED`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    body: JSON.stringify({ username, password }),
    redirect: "manual",
  });

  const allHeaders = {};
  for (const [key, value] of resp.headers.entries()) {
    if (allHeaders[key]) {
      allHeaders[key] += " ||| " + value;
    } else {
      allHeaders[key] = value;
    }
  }

  const bodyText = await resp.text().catch(() => "(could not read body)");

  return json({
    status: resp.status,
    statusText: resp.statusText,
    headers: allHeaders,
    bodyPreview: bodyText.slice(0, 1000),
    bodyLength: bodyText.length,
  });
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
    throw new Error(`Login: no cookies received (status ${resp.status})`);
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

async function searchClubs(query, env) {
  const cacheKey = `search_${query.toLowerCase().trim()}`;
  if (env?.RFEG_CACHE) {
    const cached = await env.RFEG_CACHE.get(cacheKey);
    if (cached) return JSON.parse(cached);
  }
  const results = await searchViaRFEGApi(query);
  if (env?.RFEG_CACHE && results.length > 0) {
    await env.RFEG_CACHE.put(cacheKey, JSON.stringify(results), { expirationTtl: SEARCH_CACHE_TTL });
  }
  return results;
}

async function searchViaRFEGApi(query) {
  const token = await getFreshToken();
  const resp = await fetch(`https://api.rfeg.es/web/search/club?q=${encodeURIComponent(query)}`, {
    headers: { "Authorization": token, "Accept": "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
  });
  if (!resp.ok) throw new Error(`RFEG API error: ${resp.status}`);
  const body = await resp.json();
  return (body.data || []).map(c => ({
    id: parseInt(c.id), name: c.name || "", slug: extractSlug(c.directory?.url || ""),
    city: c.place || "", community: c.community || "", holes: c.holes || 0,
  }));
}

function extractSlug(url) { const m = url.match(/\/club\/([^?#]+)/); return m ? m[1] : ""; }

// ─── Club Course Data ───────────────────────────────────────────────────────

async function getClubCourses(clubId, slug, env) {
  const cacheKey = `courses_${clubId}`;
  if (env?.RFEG_CACHE) {
    const cached = await env.RFEG_CACHE.get(cacheKey);
    if (cached) { const d = JSON.parse(cached); d._cached = true; return d; }
  }
  const data = await scrapeClubPage(clubId, slug);
  if (env?.RFEG_CACHE && data.tees?.length > 0) {
    await env.RFEG_CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: COURSE_CACHE_TTL });
  }
  return data;
}

async function scrapeClubPage(clubId, slug) {
  const resp = await fetch(`${RFEG_WEB}/club/${slug}?id=${clubId}`, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", "Accept": "text/html,application/xhtml+xml" },
    redirect: "follow",
  });
  if (!resp.ok) throw new Error(`Club page not found: ${resp.status}`);
  return parseClubHTML(await resp.text(), clubId, slug);
}

function parseClubHTML(html, clubId, slug) {
  const nameMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const club = nameMatch ? nameMatch[1].replace(/<[^>]+>/g, "").trim() : "Unknown";
  const wayDefs = [];
  const wayRe = /selectWay\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([MF])'\s*,\s*'(\d+)'\s*,\s*'(\d+)'\s*\)/gi;
  let wm;
  while ((wm = wayRe.exec(html)) !== null) {
    const dashIdx = wm[1].lastIndexOf(" - ");
    wayDefs.push({ recorrido: dashIdx >= 0 ? wm[1].substring(dashIdx + 3).trim() : wm[1], tee: wm[2], gender: wm[3] });
  }
  const tees = [];
  const blockRe = /TOTAL[\s\S]*?>\s*(\d{2,3})\s*<[\s\S]*?>\s*(\d{3,5})\s*<[\s\S]*?Vc[\s\S]*?>\s*([\d]+[,.][\d]+)\s*<[\s\S]*?Vs[\s\S]*?>\s*(\d+)\s*</gi;
  let bm, idx = 0;
  while ((bm = blockRe.exec(html)) !== null) {
    const def = wayDefs[idx];
    tees.push({ recorrido: def?.recorrido || `Tee ${idx+1}`, tee: def?.tee || "?", gender: def?.gender || "?", par: parseInt(bm[1]), vc: parseFloat(bm[3].replace(",",".")), vs: parseInt(bm[4]), meters: parseInt(bm[2]) });
    idx++;
  }
  return { club, club_id: parseInt(clubId), slug, total_tees: tees.length, tees, source: "rfegolf.es", scraped_at: new Date().toISOString() };
}

// ─── Fetch PDF with Public Token ─────────────────────────────────────────────

async function fetchPDF(license) {
  const token = await getFreshToken();
  const pdfUrl = `https://api.rfeg.es/files/summaryhandicap/${license}.pdf`;
  const resp = await fetch(pdfUrl, {
    redirect: "manual",
    headers: { "Authorization": token, "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", "Accept": "application/pdf,*/*" },
  });
  let finalResp = resp;
  if ([301,302,307,308].includes(resp.status)) {
    const loc = resp.headers.get("location");
    if (loc) finalResp = await fetch(loc, { headers: { "Authorization": token, "User-Agent": "Mozilla/5.0", "Accept": "application/pdf,*/*" } });
  }
  if (!finalResp.ok) return new Response(`RFEG PDF error: ${finalResp.status}`, { status: finalResp.status, headers: { "Access-Control-Allow-Origin": "*" } });
  return new Response(finalResp.body, {
    status: 200,
    headers: { "Content-Type": "application/pdf", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST", "Cache-Control": "no-cache" },
  });
}
