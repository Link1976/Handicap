/**
 * Cloudflare Worker: RFEG Course Data (HTML Scraping)
 * ====================================================
 * 
 * Provides course rating data (Vc, Slope, Par) for Spanish golf courses
 * by scraping rfegolf.es club pages directly (no API auth needed).
 * 
 * Endpoints:
 *   GET /?search=rejas                              → Search clubs by name
 *   GET /?club_id=448&slug=forus_golf_las_rejas     → Get tee data for a club
 * 
 * How search works:
 *   Uses Google site search on rfegolf.es/club/ to find matching clubs.
 *   Results are cached in KV for speed.
 * 
 * How course data works:
 *   Fetches the club page HTML from rfegolf.es and parses the scorecard
 *   tables to extract Vc, Slope, Par for each tee/gender combination.
 *   Results cached 30 days in KV.
 */

const RFEG_WEB = "https://rfegolf.es";
const COURSE_CACHE_TTL = 30 * 24 * 3600; // 30 days
const SEARCH_CACHE_TTL = 7 * 24 * 3600;  // 7 days

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8",
};

// ─── Entry Point ────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    const search = url.searchParams.get("search");
    const clubId = url.searchParams.get("club_id");
    const slug = url.searchParams.get("slug");
    const pdf = url.searchParams.get("pdf");

    try {
      if (pdf) {
        return await fetchPDF(pdf);
      }

      if (search) {
        if (search.trim().length < 2) {
          return json({ query: search, results: [] });
        }
        const results = await searchClubs(search, env);
        return json({ query: search, results });
      }

      if (clubId) {
        if (!slug) {
          return json({ error: "slug parameter required. Use /?club_id=448&slug=forus_golf_las_rejas" }, 400);
        }
        const data = await getClubCourses(clubId, slug, env);
        return json(data);
      }

      return json({
        service: "RFEG Course Data API",
        version: "1.2",
        endpoints: {
          search: "/?search=rejas",
          course_data: "/?club_id=448&slug=forus_golf_las_rejas",
        },
        note: "Search finds clubs, then use club_id+slug to get Vc/Slope/Par data",
      });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { headers: CORS, status });
}

// ─── Search Clubs ───────────────────────────────────────────────────────────

/**
 * Search clubs by scraping rfegolf.es club pages.
 * Strategy: fetch the clubs listing page and parse club links,
 * or use the club page URL pattern with a site-specific search.
 */
async function searchClubs(query, env) {
  // Check cache first
  const cacheKey = `search_${query.toLowerCase().trim()}`;
  if (env?.RFEG_CACHE) {
    const cached = await env.RFEG_CACHE.get(cacheKey);
    if (cached) return JSON.parse(cached);
  }

  // Search using RFEG's own API with a fresh token
  const results = await searchViaRFEGApi(query);

  // Cache results
  if (env?.RFEG_CACHE && results.length > 0) {
    await env.RFEG_CACHE.put(cacheKey, JSON.stringify(results), {
      expirationTtl: SEARCH_CACHE_TTL,
    });
  }

  return results;
}

/**
 * Get a fresh authentication token from rfegolf.es.
 * The token is embedded in the HTML/JS of the page and changes on each load.
 */
async function getFreshToken() {
  const resp = await fetch(`${RFEG_WEB}/clubes`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html",
    },
  });

  if (!resp.ok) {
    throw new Error("Could not fetch rfegolf.es to get token");
  }

  const html = await resp.text();
  // Token pattern: coded_ followed by hex string
  const m = html.match(/coded_[a-f0-9]+/);
  if (!m) {
    throw new Error("Could not extract auth token from rfegolf.es");
  }

  return "Bearer " + m[0];
}

/**
 * Search clubs using the RFEG API with a dynamically obtained token.
 */
async function searchViaRFEGApi(query) {
  const token = await getFreshToken();

  const resp = await fetch(
    `https://api.rfeg.es/web/search/club?q=${encodeURIComponent(query)}`,
    {
      headers: {
        "Authorization": token,
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    }
  );

  if (!resp.ok) {
    throw new Error(`RFEG API error: ${resp.status} ${resp.statusText}`);
  }

  const body = await resp.json();
  const clubs = body.data || [];

  return clubs.map(c => ({
    id: parseInt(c.id),
    name: c.name || "",
    slug: extractSlug(c.directory?.url || ""),
    city: c.place || "",
    community: c.community || "",
    holes: c.holes || 0,
  }));
}

/**
 * Extract slug from URL like "/club/forus_golf_las_rejas"
 */
function extractSlug(url) {
  const m = url.match(/\/club\/([^?#]+)/);
  return m ? m[1] : "";
}

// ─── Get Club Course Data ───────────────────────────────────────────────────

/**
 * Get course/tee data for a club. Checks KV cache, then scrapes live.
 */
async function getClubCourses(clubId, slug, env) {
  const cacheKey = `courses_${clubId}`;

  // Check cache
  if (env?.RFEG_CACHE) {
    const cached = await env.RFEG_CACHE.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      data._cached = true;
      return data;
    }
  }

  // Scrape the club page
  const data = await scrapeClubPage(clubId, slug);

  // Cache valid data
  if (env?.RFEG_CACHE && data.tees && data.tees.length > 0) {
    await env.RFEG_CACHE.put(cacheKey, JSON.stringify(data), {
      expirationTtl: COURSE_CACHE_TTL,
    });
  }

  return data;
}

/**
 * Fetch and parse a club page from rfegolf.es.
 */
async function scrapeClubPage(clubId, slug) {
  const url = `${RFEG_WEB}/club/${slug}?id=${clubId}`;

  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });

  if (!resp.ok) {
    throw new Error(`Club page not found: ${resp.status}`);
  }

  const html = await resp.text();
  return parseClubHTML(html, clubId, slug);
}

/**
 * Parse club HTML and extract tee configurations with Vc, Slope, Par.
 * 
 * The HTML contains:
 * - Club name in <h1>
 * - Tee dropdown items with pattern:
 *     selectWay('CLUB - Recorrido','BARRAS','M/F','colorCode','wayId')
 * - Scorecard tables (one per tee) ending with TOTAL, Vc, Vs rows
 * 
 * The tee dropdown items and scorecard tables appear in the same order.
 */
function parseClubHTML(html, clubId, slug) {
  // Club name from <h1>
  const nameMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const club = nameMatch
    ? nameMatch[1].replace(/<[^>]+>/g, "").trim()
    : "Unknown";

  // Extract tee definitions from selectWay() calls
  // Pattern: selectWay('FORUS GOLF LAS REJAS - Las Rejas','BLANCAS','F','30','11378')
  const wayDefs = [];
  const wayRe = /selectWay\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([MF])'\s*,\s*'(\d+)'\s*,\s*'(\d+)'\s*\)/gi;
  let wm;
  while ((wm = wayRe.exec(html)) !== null) {
    const fullName = wm[1];
    const tee = wm[2];
    const gender = wm[3];
    
    // Extract recorrido name: everything after the last " - "
    // "FORUS GOLF LAS REJAS - Las Rejas" → "Las Rejas"
    const dashIdx = fullName.lastIndexOf(" - ");
    const recorrido = dashIdx >= 0 ? fullName.substring(dashIdx + 3).trim() : fullName;
    
    wayDefs.push({ recorrido, tee, gender });
  }

  // Extract scorecard data: TOTAL → par → meters → Vc → value → Vs → value
  const tees = [];
  const blockRe =
    /TOTAL[\s\S]*?>\s*(\d{2,3})\s*<[\s\S]*?>\s*(\d{3,5})\s*<[\s\S]*?Vc[\s\S]*?>\s*([\d]+[,.][\d]+)\s*<[\s\S]*?Vs[\s\S]*?>\s*(\d+)\s*</gi;

  let bm;
  let idx = 0;
  while ((bm = blockRe.exec(html)) !== null) {
    const par = parseInt(bm[1]);
    const meters = parseInt(bm[2]);
    const vc = parseFloat(bm[3].replace(",", "."));
    const vs = parseInt(bm[4]);

    const def = wayDefs[idx];

    tees.push({
      recorrido: def ? def.recorrido : `Tee ${idx + 1}`,
      tee: def ? def.tee : "?",
      gender: def ? def.gender : "?",
      par,
      vc,
      vs,
      meters,
    });

    idx++;
  }

  return {
    club,
    club_id: parseInt(clubId),
    slug,
    total_tees: tees.length,
    tees,
    source: "rfegolf.es",
    scraped_at: new Date().toISOString(),
  };
}

// ─── Fetch PDF with Auth ─────────────────────────────────────────────────────

/**
 * Download a handicap PDF from RFEG using a fresh auth token.
 * The PDF endpoint requires the same Bearer token as the search API.
 */
async function fetchPDF(license) {
  const pdfUrl = `https://api.rfeg.es/files/summaryhandicap/${license}.pdf`;
  const debug = { steps: [] };

  let token;
  try {
    token = await getFreshToken();
    debug.steps.push({ step: "token_ok", token_prefix: token.substring(0, 40) });
  } catch(e) {
    return jsonDebug({ error: "token_failed", detail: e.message });
  }

  // Intento 1: redirect manual
  debug.steps.push({ step: "fetching", url: pdfUrl, redirect: "manual" });
  const resp1 = await fetch(pdfUrl, {
    redirect: "manual",
    headers: {
      "Authorization": token,
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/pdf,*/*",
    },
  });

  debug.steps.push({
    step: "resp1",
    status: resp1.status,
    content_type: resp1.headers.get("content-type"),
    location: resp1.headers.get("location"),
    content_length: resp1.headers.get("content-length"),
  });

  let targetUrl = pdfUrl;
  let finalResp = resp1;

  if ([301,302,307,308].includes(resp1.status)) {
    const location = resp1.headers.get("location");
    debug.steps.push({ step: "following_redirect", location });
    if (location) {
      targetUrl = location;
      finalResp = await fetch(location, {
        headers: {
          "Authorization": token,
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/pdf,*/*",
        },
      });
      debug.steps.push({
        step: "resp2",
        status: finalResp.status,
        content_type: finalResp.headers.get("content-type"),
        content_length: finalResp.headers.get("content-length"),
      });
    }
  }

  // Try to read body
  const bodyBytes = await finalResp.arrayBuffer();
  debug.steps.push({ step: "body_read", bytes: bodyBytes.byteLength });

  if (bodyBytes.byteLength > 100) {
    // Real PDF - return it
    return new Response(bodyBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
      },
    });
  }

  // Body empty - return full debug
  return jsonDebug(debug);
}

function jsonDebug(data) {
  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
  });
}
