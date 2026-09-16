# Cloudflare steps (you handle these)

Worker URL: https://bdk.daniel-hess7.workers.dev

## 1. Secrets

From the `cloud` folder after `git pull`:

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

That same URL must be saved on the Schwab developer app as the callback URL.

`BDK_API_KEY` is a long random string you invent. Example:

```bash
openssl rand -hex 32
```

Do not commit it.

## 2. Deploy

```bash
cd cloud
npx wrangler deploy
```

Codespaces can be shut down after this. The worker runs on Cloudflare.

## 3. Schwab login on the public URL

Open in a browser:

```text
https://bdk.daniel-hess7.workers.dev/auth/login
```

After success, test:

```bash
curl -H "Authorization: Bearer YOUR_BDK_API_KEY" \
  "https://bdk.daniel-hess7.workers.dev/quotes?symbols=SPY"
```

Repeat `/auth/login` about every 7 days.

## 4. GrokBot connector

- Server URL: `https://bdk.daniel-hess7.workers.dev/mcp`
- Transport: Streamable HTTP
- Header: `Authorization: Bearer YOUR_BDK_API_KEY`
