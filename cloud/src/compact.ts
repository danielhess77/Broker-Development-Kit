type AnyRecord = Record<string, any>;

function pickNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

export function normalizeSymbols(input: unknown): string {
  if (Array.isArray(input)) {
    return input
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
      .join(",");
  }
  if (typeof input === "string") {
    return input
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .join(",");
  }
  return "";
}

export function compactQuotes(raw: AnyRecord): AnyRecord[] {
  const rows: AnyRecord[] = [];

  for (const [key, value] of Object.entries(raw ?? {})) {
    if (!value || typeof value !== "object") continue;
    const quote = (value as AnyRecord).quote ?? value;
    const ref = (value as AnyRecord).reference ?? {};
    const regular = (value as AnyRecord).regular ?? {};

    rows.push({
      symbol: pickString(quote.symbol, ref.symbol, key),
      description: pickString(quote.description, ref.description),
      assetType: pickString(
        (value as AnyRecord).assetMainType,
        quote.assetType,
        ref.assetType
      ),
      last: pickNumber(
        quote.lastPrice,
        quote.mark,
        quote.closePrice,
        regular.regularMarketLastPrice
      ),
      mark: pickNumber(quote.mark, quote.lastPrice),
      bid: pickNumber(quote.bidPrice),
      ask: pickNumber(quote.askPrice),
      bidSize: pickNumber(quote.bidSize),
      askSize: pickNumber(quote.askSize),
      netChange: pickNumber(quote.netChange, quote.netPercentChangeInDouble),
      netPercent: pickNumber(
        quote.netPercentChangeInDouble,
        quote.netPercentChange
      ),
      volume: pickNumber(quote.totalVolume),
      high: pickNumber(quote.highPrice),
      low: pickNumber(quote.lowPrice),
      open: pickNumber(quote.openPrice),
      close: pickNumber(quote.closePrice),
      previousClose: pickNumber(
        quote.closePrice,
        regular.regularMarketPreviousClose
      ),
      delayed: Boolean(quote.delayed),
    });
  }

  return rows;
}

function compactContract(contract: AnyRecord) {
  return {
    symbol: pickString(contract.symbol),
    strike: pickNumber(contract.strikePrice),
    expiry: pickString(contract.expirationDate),
    dte: pickNumber(contract.daysToExpiration),
    type: pickString(contract.putCall),
    bid: pickNumber(contract.bid),
    ask: pickNumber(contract.ask),
    last: pickNumber(contract.last),
    mark: pickNumber(contract.mark),
    volume: pickNumber(contract.totalVolume),
    openInterest: pickNumber(contract.openInterest),
    iv: pickNumber(contract.volatility),
    delta: pickNumber(contract.delta),
    gamma: pickNumber(contract.gamma),
    theta: pickNumber(contract.theta),
    vega: pickNumber(contract.vega),
    inTheMoney: Boolean(contract.inTheMoney),
  };
}

function flattenSide(expMap: AnyRecord | undefined, limit: number) {
  const out: ReturnType<typeof compactContract>[] = [];
  if (!expMap || typeof expMap !== "object") return out;

  for (const strikeMap of Object.values(expMap)) {
    if (!strikeMap || typeof strikeMap !== "object") continue;
    for (const contracts of Object.values(strikeMap as AnyRecord)) {
      const list = Array.isArray(contracts) ? contracts : [contracts];
      for (const contract of list) {
        out.push(compactContract(contract as AnyRecord));
        if (out.length >= limit) return out;
      }
    }
  }

  return out;
}

export function compactOptionChain(raw: AnyRecord, maxContracts = 40) {
  const underlying = raw.underlying ?? {};
  const perSide = Math.max(4, Math.floor(maxContracts / 2));

  return {
    symbol: pickString(raw.symbol, underlying.symbol),
    status: pickString(raw.status),
    underlying: {
      mark: pickNumber(underlying.mark, raw.underlyingPrice),
      last: pickNumber(underlying.last),
      change: pickNumber(underlying.change),
      percentChange: pickNumber(underlying.percentChange),
    },
    calls: flattenSide(raw.callExpDateMap, perSide),
    puts: flattenSide(raw.putExpDateMap, perSide),
  };
}

export function compactCandles(raw: AnyRecord) {
  const candles = Array.isArray(raw.candles) ? raw.candles : [];
  return {
    symbol: pickString(raw.symbol),
    empty: Boolean(raw.empty),
    candles: candles.map((candle: AnyRecord) => ({
      datetime: candle.datetime ?? null,
      open: pickNumber(candle.open),
      high: pickNumber(candle.high),
      low: pickNumber(candle.low),
      close: pickNumber(candle.close),
      volume: pickNumber(candle.volume),
    })),
  };
}
