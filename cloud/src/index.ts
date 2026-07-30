import {
  loginHandler,
  callbackHandler,
  type Env,
} from "./auth";

import { schwabRequest } from "./client";

export default {

  async fetch(
    request: Request,
    env: Env
  ): Promise<Response> {

    const url = new URL(request.url);

    switch (url.pathname) {

      case "/":
        return Response.json({
          service: "Broker Development Kit",
          version: "0.7.0",
          status: "online",
        });

      case "/auth/login":
        return loginHandler(request, env);

      case "/auth/callback":
        return callbackHandler(request, env);

      case "/quotes": {

        const symbols = url.searchParams.get("symbols");

        if (!symbols) {
          return Response.json(
            {
              error: "Missing required query parameter: symbols"
            },
            {
              status: 400
            }
          );
        }

        return Response.json(
          await schwabRequest(
            env,
            `/marketdata/v1/quotes?symbols=${encodeURIComponent(symbols)}`
          )
        );

      }

      case "/history": {

        const symbol = url.searchParams.get("symbol");

        if (!symbol) {
          return Response.json(
            {
              error: "Missing required query parameter: symbol"
            },
            {
              status: 400
            }
          );
        }

        const periodType =
          url.searchParams.get("periodType") ?? "year";

        const period =
          url.searchParams.get("period") ?? "1";

        const frequencyType =
          url.searchParams.get("frequencyType") ?? "daily";

        const frequency =
          url.searchParams.get("frequency") ?? "1";

        const needExtendedHoursData =
          url.searchParams.get("needExtendedHoursData") ?? "false";

        const params = new URLSearchParams({
          symbol,
          periodType,
          period,
          frequencyType,
          frequency,
          needExtendedHoursData,
        });

        return Response.json(
          await schwabRequest(
            env,
            `/marketdata/v1/pricehistory?${params.toString()}`
          )
        );

      }

      case "/options": {

  const symbol = url.searchParams.get("symbol");

  if (!symbol) {
    return Response.json(
      {
        error: "Missing required query parameter: symbol"
      },
      {
        status: 400
      }
    );
  }

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

  const strategy = url.searchParams.get("strategy");
  if (strategy) params.set("strategy", strategy);

  const range = url.searchParams.get("range");
  if (range) params.set("range", range);

  const fromDate = url.searchParams.get("fromDate");
  if (fromDate) params.set("fromDate", fromDate);

  const toDate = url.searchParams.get("toDate");
  if (toDate) params.set("toDate", toDate);

  const expMonth = url.searchParams.get("expMonth");
  if (expMonth) params.set("expMonth", expMonth);

  const optionType = url.searchParams.get("optionType");
  if (optionType) params.set("optionType", optionType);

  return Response.json(
    await schwabRequest(
      env,
      `/marketdata/v1/chains?${params.toString()}`
    )
  );

}

case "/market-hours": {

  const markets =
    url.searchParams.get("markets") ?? "equity";

  const date =
    url.searchParams.get("date");

  const params = new URLSearchParams();

  params.set("markets", markets);

  if (date) {
    params.set("date", date);
  }

  return Response.json(
    await schwabRequest(
      env,
      `/marketdata/v1/markets?${params.toString()}`
    )
  );

}

      default:
        return Response.json(
          {
            error: "Not Found"
          },
          {
            status: 404
          }
        );

    }

  },

};