# Broker Development Kit

Broker-independent market-data layer. Schwab is the first adapter.

Grokbot talks to the Cloudflare worker over MCP. The bot owns the watchlist
and polling interval. This repo does not hard-code either one.

## Live worker

- Status: https://bdk.daniel-hess7.workers.dev/
- MCP: https://bdk.daniel-hess7.workers.dev/mcp
- Login: https://bdk.daniel-hess7.workers.dev/auth/login

See `cloud/CLOUDFLARE.md` for deploy, secrets, and Grokbot connector steps.

## Layout

- `cloud/` — Cloudflare Worker (the part Grokbot uses)
- `src/` — local TypeScript kit / future adapters (mostly scaffolding)
- `docs/Architecture.md` — design notes

## MCP tools

`get_quotes`, `get_history`, `get_option_chain`, `get_market_hours`

Pass symbols on every `get_quotes` call. There is no stored watchlist.
