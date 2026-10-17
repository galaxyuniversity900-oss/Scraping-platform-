import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 8790);
const graphVersion = process.env.META_GRAPH_API_VERSION;

const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };

function json(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  res.end(JSON.stringify(body));
}

function validDate(value) {
  return !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function searchAds(url) {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    const error = new Error("META_ACCESS_TOKEN is not configured on the server.");
    error.status = 503;
    throw error;
  }
  if (!graphVersion || !/^v\d+\.\d+$/.test(graphVersion)) {
    const error = new Error("Set META_GRAPH_API_VERSION to a currently supported Meta Graph API version (for example, vXX.0).");
    error.status = 503;
    throw error;
  }

  const q = (url.searchParams.get("q") || "").trim();
  if (!q) {
    const error = new Error("Enter a search keyword or phrase.");
    error.status = 400;
    throw error;
  }
  if (q.length > 200) {
    const error = new Error("Search phrase must be 200 characters or fewer.");
    error.status = 400;
    throw error;
  }

  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  if (!validDate(from) || !validDate(to) || (from && to && from > to)) {
    const error = new Error("Dates must use YYYY-MM-DD, and the start date must not be after the end date.");
    error.status = 400;
    throw error;
  }

  const requestedPages = Number(url.searchParams.get("pages") || 3);
  const pages = Math.min(10, Math.max(1, Number.isInteger(requestedPages) ? requestedPages : 3));
  const activeStatus = ["ACTIVE", "INACTIVE", "ALL"].includes(url.searchParams.get("status"))
    ? url.searchParams.get("status") : "ALL";
  const mediaType = ["ALL", "IMAGE", "VIDEO", "MEME", "NONE"].includes(url.searchParams.get("media"))
    ? url.searchParams.get("media") : "ALL";

  const params = new URLSearchParams({
    access_token: token,
    search_terms: q,
    ad_reached_countries: JSON.stringify(["EG"]),
    ad_type: "POLITICAL_AND_ISSUE_ADS",
    ad_active_status: activeStatus,
    media_type: mediaType,
    fields: [
      "id", "page_id", "page_name", "ad_delivery_start_time", "ad_delivery_stop_time",
      "ad_creative_bodies", "ad_creative_link_titles", "ad_creative_link_descriptions",
      "impressions", "spend", "currency", "publisher_platforms", "ad_snapshot_url"
    ].join(","),
    limit: "100"
  });
  if (from) params.set("ad_delivery_date_min", from);
  if (to) params.set("ad_delivery_date_max", to);

  let next = `https://graph.facebook.com/${graphVersion}/ads_archive?${params.toString()}`;
  const ads = [];
  let pagesRead = 0;

  while (next && pagesRead < pages) {
    const response = await fetch(next, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(25000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.error) {
      const message = payload?.error?.message || `Meta API returned HTTP ${response.status}`;
      const error = new Error(message);
      error.status = response.status === 429 ? 429 : 502;
      throw error;
    }
    if (Array.isArray(payload.data)) ads.push(...payload.data);
    next = payload.paging?.next || null;
    pagesRead += 1;
  }

  const unique = [...new Map(ads.map(ad => [ad.id, ad])).values()];
  return { data: unique, count: unique.length, pagesRead, hasMore: Boolean(next), source: "Meta Ad Library API", country: "EG" };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (req.method === "GET" && url.pathname === "/api/health") {
    return json(res, 200, { ok: true, tokenConfigured: Boolean(process.env.META_ACCESS_TOKEN), graphVersionConfigured: Boolean(graphVersion) });
  }
  if (req.method === "GET" && url.pathname === "/api/ads") {
    try {
      return json(res, 200, await searchAds(url));
    } catch (error) {
      return json(res, error.status || 500, { error: error.message || "Unexpected server error" });
    }
  }
  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    try {
      const html = await readFile(path.join(here, "index.html"));
      res.writeHead(200, { "content-type": mime[".html"], "cache-control": "no-store", "x-content-type-options": "nosniff" });
      return res.end(html);
    } catch {
      return json(res, 500, { error: "UI file is missing." });
    }
  }
  return json(res, 404, { error: "Not found" });
});

server.listen(port, host, () => {
  console.log(`Meta Ad Library tool listening at http://${host}:${port}`);
  console.log("Access token stays on the server; do not put it in browser code.");
});
