# BDK Cloudflare worker — Grokbot setup

Worker URL: https://bdk.daniel-hess7.workers.dev

Grokbot is the scheduler. This worker is only the Schwab MCP endpoint.
Watchlist and interval live in Grokbot instructions, not in this repo.

## 1. Secrets

From the `cloud` folder:

```bash
npx wrangler secret put SCHWAB_CLIENT_ID
npx wrangler secret put SCHWAB_CLIENT_SECRET
npx wrangler secret put SCHWAB_REDIRECT_URI
npx wrangler secret put BDK_API_KEY
```

`SCHWAB_REDIRECT_URI` must be exactly:

```text
https://bdk.daniel-hess7.workers.dev/auth/callback
```

That same URL must be saved on the Schwab developer app.

`BDK_API_KEY` is a long random string you invent:

```bash
openssl rand -hex 32
```

Do not commit it.

## 2. Deploy

```bash
cd cloud
npx wrangler deploy
```

Confirm `/` reports version `0.9.0` and `/mcp` no longer 404s:

```bash
curl https://bdk.daniel-hess7.workers.dev/
curl https://bdk.daniel-hess7.workers.dev/mcp
```

## 3. Schwab login

Open:

```text
https://bdk.daniel-hess7.workers.dev/auth/login
```

Repeat about every 7 days when the Schwab refresh token expires.

Test quotes:

```bash
curl -H "Authorization: Bearer YOUR_BDK_API_KEY" \
  "https://bdk.daniel-hess7.workers.dev/quotes?symbols=%24SPX,SPY"
```

## 4. Grokbot connector

Add a custom MCP connector:

- Name: `BDK` or `Schwab`
- Server URL: `https://bdk.daniel-hess7.workers.dev/mcp`
- Transport: Streamable HTTP
- Header: `Authorization: Bearer YOUR_BDK_API_KEY`

If the UI has no header field, tell Grokbot:

```text
Add this MCP server: https://bdk.daniel-hess7.workers.dev/mcp
Use header Authorization: Bearer YOUR_BDK_API_KEY
```

## 5. Grokbot instructions

Put the changing watchlist and cadence in the bot, for example:

```text
Use the BDK MCP tools for Schwab market data.
Default watchlist: $SPX, SPY, QQQ.
During RTH, call get_quotes on that list at the interval I give you.
Change the list or interval when I say so. Do not wait for a code deploy.
Only call get_option_chain when I ask or when a name moves more than 1%.
If a tool says to re-login, tell me to open /auth/login.
```

Tools:

- `get_quotes`
- `get_history`
- `get_option_chain`
- `get_market_hours`
