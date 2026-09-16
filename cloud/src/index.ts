import { loginHandler, callbackHandler, type Env as AuthEnv } from "./auth";
import { schwabRequest } from "./client";
import type { Env as TokenEnv } from "./token";

type Env = AuthEnv & TokenEnv & { BDK_API_KEY: string };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, Accept, MCP-Protocol-Version",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
  });
}

function unauthorized(): Response {
  return json({ error: "Unauthorized" }, 401);
}

function requireApiKey(request: Request, env: Env): boolean {
  const expected = env.BDK_API_KEY;
  if (!expected) return false;
  const header = request.headers.get("Authorization") || "";
  return header === `Bearer ${expected}`;
}

const TOOLS = [
  {
    name: "get_quotes",
    description:
      "Live Schwab quotes for one or more symbols. Use $SPX for the S&P 500 index.",
    inputSchema: {
      type: "object",
      properties: {
        symbols: {
          type: "string",
          description: "Comma-separated symbols, e.g. SPY,QQQ,$SPX",
        },
      },
      required: ["symbols"],
    },
  },
  {
    name: "get_history",
    description: "Price history / candles for one symbol.",
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
      "Schwab option chain for a symbol. Use $SPX for index options.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string" },
        contractType: { type: "string", description: "ALL | CALL | PUT" },
        strikeCount: { type: "string" },
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
    description: "Market hours for equity, option, future, bond, or forex.",
    inputSchema: {
      type: "object",
      properties: {
        markets: { type: "string", description: "equity,option" },
        date: { type: "string" },
      },
    },
  },
];

async function callTool(
  env: Env,
  name: string,
  args: Record<string, string> = {}
) {
  switch (name) {
    case "get_quotes": {
      if (!args.symbols) throw new Error("symbols is required");
      return schwabRequest(
        env,
        `/marketdata/v1/quotes?symbols=${encodeURIComponent(args.symbols)}`
      );
    }
    case "get_history": {
      if (!args.symbol) throw new Error("symbol is required");
      const params = new URLSearchParams();
      params.set("symbol", args.symbol);
      params.set("frequencyType", args.frequencyType ?? "daily");
      params.set("frequency", args.frequency ?? "1");
      params.set(
        "needExtendedHoursData",
        args.needExtendedHoursData ?? "false"
      );
      if (args.startDate && args.endDate) {
        params.set("startDate", args.startDate);
        params.set("endDate", args.endDate);
      } else {
        params.set("periodType", args.periodType ?? "year");
        params.set("period", args.period ?? "1");
      }
      return schwabRequest(env, `/marketdata/v1/pricehistory?${params}`);
    }
    case "get_option_chain": {
      if (!args.symbol) throw new Error("symbol is required");
      const params = new URLSearchParams();
      params.set("symbol", args.symbol);
      params.set("contractType", args.contractType ?? "ALL");
      params.set("strikeCount", args.strikeCount ?? "20");
      if (args.strategy) params.set("strategy", args.strategy);
      if (args.range) params.set("range", args.range);
      if (args.fromDate) params.set("fromDate", args.fromDate);
      if (args.toDate) params.set("toDate", args.toDate);
      return schwabRequest(env, `/marketdata/v1/chains?${params}`);
    }
    case "get_market_hours": {
      const params = new URLSearchParams();
      params.set("markets", args.markets ?? "equity");
      if (args.date) params.set("date", args.date);
      return schwabRequest(env, `/marketdata/v1/markets?${params}`);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function handleMcp(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "POST only" }, 405);

  const body: any = await request.json();
  const id = body?.id ?? null;
  const method = body?.method;

  if (method === "initialize") {
    return json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "bdk", version: "0.8.0" },
      },
    });
  }

  if (method === "notifications/initialized" || method === "initialized") {
    return new Response(null, { status: 204 });
  }

  if (method === "tools/list") {
    return json({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
  }

  if (method === "tools/call") {
    try {
      const name = body?.params?.name;
      const args = body?.params?.arguments ?? {};
      const data = await callTool(env, name, args);
      return json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(data) }],
        },
      });
    } catch (err: any) {
      return json({
        jsonrpc: "2.0",
        id,
        result: {
          isError: true,
          content: [{ type: "text", text: String(err?.message ?? err) }],
        },
      });
    }
  }

  if (method === "ping") {
    return json({ jsonrpc: "2.0", id, result: {} });
  }

  return json({
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return json({ ok: true });

    switch (url.pathname) {
      case "/":
        return json({
          service: "Broker Development Kit",
          version: "0.8.0",
          status: "online",
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
        if (!requireApiKey(request, env)) return unauthorized();
        return handleMcp(request, env);

      case "/quotes": {
        if (!requireApiKey(request, env)) return unauthorized();
        const symbols = url.searchParams.get("symbols");
        if (!symbols) return json({ error: "Missing symbols" }, 400);
        return json(
          await schwabRequest(
            env,
            `/marketdata/v1/quotes?symbols=${encodeURIComponent(symbols)}`
          )
        );
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
        return json(
          await schwabRequest(env, `/marketdata/v1/pricehistory?${params}`)
        );
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
          url.searchParams.get("strikeCount") ?? "20"
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
        return json(await schwabRequest(env, `/marketdata/v1/chains?${params}`));
      }

      case "/market-hours": {
        if (!requireApiKey(request, env)) return unauthorized();
        const params = new URLSearchParams();
        params.set("markets", url.searchParams.get("markets") ?? "equity");
        const date = url.searchParams.get("date");
        if (date) params.set("date", date);
        return json(
          await schwabRequest(env, `/marketdata/v1/markets?${params}`)
        );
      }

      default:
        return json({ error: "Not Found" }, 404);
    }
  },
};
