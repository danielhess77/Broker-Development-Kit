export interface Env {
  SCHWAB_CLIENT_ID: string;
  SCHWAB_CLIENT_SECRET: string;
  BDK_AUTH: KVNamespace;
}

const TOKEN_URL =
  "https://api.schwabapi.com/v1/oauth/token";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export async function getAccessToken(
  env: Env
): Promise<string> {

  const stored = await env.BDK_AUTH.get("tokens");

  if (!stored) {
    throw new Error("No OAuth tokens found.");
  }

  const token: TokenResponse =
    JSON.parse(stored);

  if (token.access_token) {
    return token.access_token;
  }

  throw new Error("Access token missing.");
}

export async function refreshAccessToken(
  env: Env
): Promise<string> {

  const stored = await env.BDK_AUTH.get("tokens");

  if (!stored) {
    throw new Error("No OAuth tokens found.");
  }

  const token: TokenResponse =
    JSON.parse(stored);

  if (!token.refresh_token) {
    throw new Error("Refresh token missing.");
  }

  const credentials = btoa(
    `${env.SCHWAB_CLIENT_ID}:${env.SCHWAB_CLIENT_SECRET}`
  );

  const response = await fetch(
    TOKEN_URL,
    {
      method: "POST",

      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type":
          "application/x-www-form-urlencoded"
      },

      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: token.refresh_token
      })
    }
  );

  if (!response.ok) {
    throw new Error(
      `Refresh failed (${response.status})`
    );
  }

  const refreshed =
    await response.json() as TokenResponse;

  if (!refreshed.refresh_token) {
    refreshed.refresh_token =
      token.refresh_token;
  }

  await env.BDK_AUTH.put(
    "tokens",
    JSON.stringify(refreshed)
  );

  return refreshed.access_token;
}