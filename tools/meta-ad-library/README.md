# Meta Ad Library API — Egypt

Small, Arabic-first interface for searching Meta's official Ad Library API. This tool is designed for political/social-issue ads available through the API in Egypt; it does **not** scrape Facebook pages or claim to provide all commercial ads.

## Requirements

- Node.js 20+ (built-in `fetch` and `AbortSignal.timeout` are used).
- Meta developer account and access granted to the Ad Library API.
- An access token valid for your account and the API version you choose.

## Run locally

From this directory:

```sh
META_ACCESS_TOKEN='YOUR_TOKEN' META_GRAPH_API_VERSION='vXX.0' node server.mjs
```

Replace `vXX.0` with a currently supported Graph API version from Meta's official documentation. Then open `http://127.0.0.1:8790`.

Optional environment variables:

- `HOST` — defaults to `127.0.0.1` (local-only).
- `PORT` — defaults to `8790`.
- `META_ACCESS_TOKEN` — required; kept server-side and never returned by the UI.
- `META_GRAPH_API_VERSION` — required; set to a currently supported version.

Do not commit tokens, place them in HTML/JavaScript, expose the server to a public network, or share screenshots/logs containing credentials. For deployment, use a secret manager and HTTPS.

## Features and safeguards

- Search term, date range, active status, and media-type filters.
- Egypt country constraint (`ad_reached_countries=["EG"]`) and political/issue ad type.
- Server-side token handling; no token field in the browser.
- Bounded pagination (1–10 pages, up to 1,000 results), request timeout, duplicate removal, API error reporting.
- Safe text rendering with `textContent`, validated HTTPS preview links, and CSV export.
- Health endpoint at `/api/health` reports whether required environment settings are configured, not their values.

## Coverage limitation

Meta's official API generally exposes political/social-issue ads worldwide, while broader commercial-ad access is geographically limited (notably EU/UK under Meta's published API description). For Egypt, this tool intentionally requests `POLITICAL_AND_ISSUE_ADS`. Ordinary commercial ads may not be returned even if they exist in the public Ad Library. Use Meta's public Ad Library UI for manual commercial-ad research.

## Checks

```sh
node test.mjs
```

The tests check server health and input validation without requiring a real Meta token or making an API request.
