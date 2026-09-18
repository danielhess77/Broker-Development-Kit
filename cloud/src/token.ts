export interface Env {
  SCHWAB_CLIENT_ID: string;
  SCHWAB_CLIENT_SECRET: string;
  BDK_AUTH: KVNamespace;
}

const TOKEN_URL = "https://api.schwabapi.com/v1/oauth/token";
const EXPIRY_SKEW_MS = 60_000;

export interface StoredToken {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
  obtained_at?: number;
}

export async function readTokens(env: Env): Promise<StoredToken> {
  const stored = await env.BDK_AUTH.get("tokens");
  if (!stored) {
    throw new Error(
      "No Schwab OAuth tokens. Open https://bdk.daniel-hess7.workers.dev/auth/login and complete login."
    );
  }
  return JSON.parse(stored) as StoredToken;
}

export async function writeTokens(
  env: Env,
  token: StoredToken,
  previous?: StoredToken
): Promise<StoredToken> {
  const next: StoredToken = {
    ...token,
    refresh_token: token.refresh_token ?? previous?.refresh_token,
    obtained_at: Date.now(),
  };
  await env.BDK_AUTH.put("tokens", JSON.stringify(next));
  return next;
}

function isExpired(token: StoredToken): boolean {
  if (!token.access_token) return true;
  const obtained = token.obtained_at ?? 0;
  const ttlMs = Math.max(0, (token.expires_in ?? 1800) * 1000);
  return Date.now() >= obtained + ttlMs - EXPIRY_SKEW_MS;
}

export async function refreshAccessToken(env: Env): Promise<string> {
  const token = await readTokens(env);
  if (!token.refresh_token) {
    throw new Error(
      "Schwab refresh token missing. Open /auth/login and complete login again."
    );
  }

  const credentials = btoa(
    `${env.SCHWAB_CLIENT_ID}:${env.SCHWAB_CLIENT_SECRET}`
  );

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token.refresh_token,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `Schwab refresh failed (${response.status}). Re-login at /auth/login. ${JSON.stringify(body)}`
    );
  }

  const refreshed = await writeTokens(env, body as StoredToken, token);
  return refreshed.access_token;
}

export async function getAccessToken(env: Env): Promise<string> {
  const token = await readTokens(env);
  if (isExpired(token)) {
    return refreshAccessToken(env);
  }
  return token.access_token;
}
