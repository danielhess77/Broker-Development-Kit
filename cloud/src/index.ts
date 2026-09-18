import { loginHandler, callbackHandler, type Env as AuthEnv } from "./auth";
import { schwabRequest } from "./client";
import {
  compactCandles,
  compactOptionChain,
  compactQuotes,
  normalizeSymbols,
} from "./compact";
import type { Env as TokenEnv } from "./token";

type Env = AuthEnv & TokenEnv & { BDK_API_KEY: string };

const VERSION = "0.9.0";
const PROTOCOL_VERSION = "2025-03-26";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, MCP-Protocol-Version",
};

function json(
  data: unknown,
  status = 200,
  extra: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "MCP-Protocol-Version": PROTOCOL_VERSION,
      ...CORS,
      ...extra,
    },
  });
}

function unauthorized(): Response {
  return json({ error: "Unauthorized. Send Authorization: Bearer <BDK_API_KEY>." }, 401);
}

function requireApiKey(request: Request, env: Env): boolean {
  const expected = env.BDK_API_KEY;
  if (!expected) return false;
  const header = request.headers.get("Authorization") || "";
  if (header === `Bearer ${expected}`) return true;
  const alt = request.headers.get("X-Api-Key") || "";
  return alt === expected;
}

const TOOLS = [
  {
    name: "get_quotes",
    description:
      "Live Schwab quotes for a watchlist. Pass symbols as a comma string or array. Use $SPX and $VIX for indexes. Returns compact last/bid/ask/volume/percent change.",
    inputSchema: {
      type: "object",
      properties: {
        symbols: {
          description: "Watchlist, e.g. $SPX,SPY,QQQ or an array of symbols",
        },
      },
      required: ["symbols"],
    },
  },
  {
    name: "get_history",
    description:
      "OHLCV candles for one symbol. Defaults to 1 year of daily bars. Use frequencyType=minute for intraday.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string" },
        periodType: { type: "string", description: "day | month | year | ytd" },
        period: { type: "string" },
        frequencyType: {
          type: "string",
          description: "minute | daily | weekly | monthly",
        },
        frequency: { type: "string" },
        startDate: { type: "string", description: "Epoch ms" },
        endDate: { type: "string", description: "Epoch ms" },
        needExtendedHoursData: { type: "string" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "get_option_chain",
    description:
      "Compact Schwab option chain around spot. Prefer strikeCount 8-12. Use $SPX for index options. Do not poll full chains on a tight interval.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string" },
        contractType: { type: "string", description: "ALL | CALL | PUT" },
        strikeCount: { type: "string", description: "Strikes around spot" },
        range: { type: "string" },
        fromDate: { type: "string", description: "YYYY-MM-DD" },
        toDate: { type: "string", description: "YYYY-MM-DD" },
        strategy: { type: "string" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "get_market_hours",
    description:
      "Whether equity/option markets are open and today's session hours.",
    inputSchema: {
      type: "object",
      properties: {
        markets: { type: "string", description: "equity,option" },
        date: { type: "string" },
      },
    },
  },
];

function asString(value: unknown): string | undefined {
  if (value == null) return undefined;
  return String(value);
}

async function callTool(env: Env, name: string, args: Record<string, unknown>) {
  switch (name) {
    case "get_quotes": {
      const symbols = normalizeSymbols(args.symbols ?? args.symbol);
      if (!symbols) throw new Error("symbols is required");
      const raw = await schwabRequest(
        env,
        `/marketdata/v1/quotes?symbols=${encodeURIComponent(symbols)}`
      );
      return { asOf: new Date().toISOString(), quotes: compactQuotes(raw) };
    }
    case "get_history": {
      const symbol = asString(args.symbol);
      if (!symbol) throw new Error("symbol is required");
      const params = new URLSearchParams();
      params.set("symbol", symbol);
      params.set("frequencyType", asString(args.frequencyType) ?? "daily");
      params.set("frequency", asString(args.frequency) ?? "1");
      params.set(
        "needExtendedHoursData",
        asString(args.needExtendedHoursData) ?? "false"
      );
      if (args.startDate && args.endDate) {
        params.set("startDate", String(args.startDate));
        params.set("endDate", String(args.endDate));
      } else {
        params.set("periodType", asString(args.periodType) ?? "year");
        params.set("period", asString(args.period) ?? "1");
      }
      const raw = await schwabRequest(env, `/marketdata/v1/pricehistory?${params}`);
      return compactCandles(raw);
    }
    case "get_option_chain": {
      const symbol = asString(args.symbol);
      if (!symbol) throw new Error("symbol is required");
      const params = new URLSearchParams();
      params.set("symbol", symbol);
      params.set("contractType", asString(args.contractType) ?? "ALL");
      params.set("strikeCount", asString(args.strikeCount) ?? "10");
      for (const key of ["strategy", "range", "fromDate", "toDate"] as const) {
        const value = asString(args[key]);
        if (value) params.set(key, value);
      }
      const raw = await schwabRequest(env, `/marketdata/v1/chains?${params}`);
      return compactOptionChain(raw);
    }
    case "get_market_hours": {
      const params = new URLSearchParams();
      params.set("markets", asString(args.markets) ?? "equity,option");
      if (args.date) params.set("date", String(args.date));
      return schwabRequest(env, `/marketdata/v1/markets?${params}`);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function rpcResult(id: unknown, result: unknown, extra?: Record<string, string>) {
  return json({ jsonrpc: "2.0", id, result }, 200, extra);
}

function rpcError(id: unknown, code: number, message: string, status = 200) {
  return json({ jsonrpc: "2.0", id, error: { code, message } }, status);
}

async function handleRpc(env: Env, body: any): Promise<Response> {
  const id = body?.id ?? null;
  const method = body?.method;

  if (method === "initialize") {
    return rpcResult(
      id,
      {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {
          tools: { listChanged: false },
        },
        serverInfo: { name: "bdk", version: VERSION },
        instructions:
          "Schwab market-data server. Pass the current watchlist into get_quotes on each call. Do not assume a stored list.",
      },
      { "Mcp-Session-Id": "bdk-stateless" }
    );
  }

  if (method === "notifications/initialized" || method === "initialized") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (method === "notifications/cancelled") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (method === "tools/list") {
    return rpcResult(id, { tools: TOOLS });
  }

  if (method === "resources/list") {
    return rpcResult(id, { resources: [] });
  }

  if (method === "prompts/list") {
    return rpcResult(id, { prompts: [] });
  }

  if (method === "ping") {
    return rpcResult(id, {});
  }

  if (method === "tools/call") {
    try {
      const name = body?.params?.name;
      const args = body?.params?.arguments ?? {};
      const data = await callTool(env, name, args);
      return rpcResult(id, {
        content: [{ type: "text", text: JSON.stringify(data) }],
        structuredContent: data,
      });
    } catch (err: any) {
      return rpcResult(id, {
        isError: true,
        content: [{ type: "text", text: String(err?.message ?? err) }],
      });
    }
  }

  return rpcError(id, -32601, `Method not found: ${method}`);
}

async function handleMcp(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });

  if (request.method === "GET") {
    return json({
      service: "bdk",
      transport: "streamable-http",
      protocolVersion: PROTOCOL_VERSION,
      version: VERSION,
      tools: TOOLS.map((tool) => tool.name),
      auth: "Authorization: Bearer <BDK_API_KEY>",
    });
  }

  if (request.method === "DELETE") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (request.method !== "POST") {
    return json({ error: "Use POST for MCP JSON-RPC" }, 405);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return rpcError(null, -32700, "Parse error", 400);
  }

  if (Array.isArray(body)) {
    const responses = [];
    for (const item of body) {
      const response = await handleRpc(env, item);
      if (response.status === 204) continue;
      responses.push(await response.json());
    }
    return json(responses);
  }

  return handleRpc(env, body);
}

function restQuotesPath(symbols: string) {
  return `/marketdata/v1/quotes?symbols=${encodeURIComponent(symbols)}`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return json({ ok: true });

    try {
      switch (url.pathname) {
        case "/":
        case "/health":
          return json({
            service: "Broker Development Kit",
            version: VERSION,
            status: "online",
            mcp: "/mcp",
            endpoints: [
              "/quotes",
              "/history",
              "/options",
              "/market-hours",
              "/mcp",
              "/auth/login",
            ],
          });

        case "/auth/login":
          return loginHandler(request, env);

        case "/auth/callback":
          return callbackHandler(request, env);

        case "/mcp":
          if (request.method === "GET" || request.method === "OPTIONS") {
            return handleMcp(request, env);
          }
          if (!requireApiKey(request, env)) return unauthorized();
          return handleMcp(request, env);

        case "/quotes": {
          if (!requireApiKey(request, env)) return unauthorized();
          const symbols = normalizeSymbols(url.searchParams.get("symbols"));
          if (!symbols) return json({ error: "Missing symbols" }, 400);
          const raw = await schwabRequest(env, restQuotesPath(symbols));
          return json({
            asOf: new Date().toISOString(),
            quotes: compactQuotes(raw),
          });
        }

        case "/history": {
          if (!requireApiKey(request, env)) return unauthorized();
          const symbol = url.searchParams.get("symbol");
          if (!symbol) return json({ error: "Missing symbol" }, 400);
          const params = new URLSearchParams();
          params.set("symbol", symbol);
          params.set(
            "frequencyType",
            url.searchParams.get("frequencyType") ?? "daily"
          );
          params.set("frequency", url.searchParams.get("frequency") ?? "1");
          params.set(
            "needExtendedHoursData",
            url.searchParams.get("needExtendedHoursData") ?? "false"
          );
          const startDate = url.searchParams.get("startDate");
          const endDate = url.searchParams.get("endDate");
          if (startDate && endDate) {
            params.set("startDate", startDate);
            params.set("endDate", endDate);
          } else {
            params.set(
              "periodType",
              url.searchParams.get("periodType") ?? "year"
            );
            params.set("period", url.searchParams.get("period") ?? "1");
          }
          const raw = await schwabRequest(
            env,
            `/marketdata/v1/pricehistory?${params}`
          );
          return json(compactCandles(raw));
        }

        case "/options": {
          if (!requireApiKey(request, env)) return unauthorized();
          const symbol = url.searchParams.get("symbol");
          if (!symbol) return json({ error: "Missing symbol" }, 400);
          const params = new URLSearchParams();
          params.set("symbol", symbol);
          params.set(
            "contractType",
            url.searchParams.get("contractType") ?? "ALL"
          );
          params.set(
            "strikeCount",
            url.searchParams.get("strikeCount") ?? "10"
          );
          for (const key of [
            "strategy",
            "range",
            "fromDate",
            "toDate",
            "expMonth",
            "optionType",
          ]) {
            const value = url.searchParams.get(key);
            if (value) params.set(key, value);
          }
          const raw = await schwabRequest(env, `/marketdata/v1/chains?${params}`);
          return json(compactOptionChain(raw));
        }

        case "/market-hours": {
          if (!requireApiKey(request, env)) return unauthorized();
          const params = new URLSearchParams();
          params.set("markets", url.searchParams.get("markets") ?? "equity,option");
          const date = url.searchParams.get("date");
          if (date) params.set("date", date);
          return json(await schwabRequest(env, `/marketdata/v1/markets?${params}`));
        }

        default:
          return json({ error: "Not Found" }, 404);
      }
    } catch (err: any) {
      return json({ error: String(err?.message ?? err) }, 500);
    }
  },
};
