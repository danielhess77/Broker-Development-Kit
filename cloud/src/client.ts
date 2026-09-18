import { getAccessToken, refreshAccessToken, type Env } from "./token";

const API_BASE = "https://api.schwabapi.com";

export async function schwabRequest(
  env: Env,
  path: string,
  init: RequestInit = {}
): Promise<any> {
  const send = async (accessToken: string) =>
    fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });

  let accessToken = await getAccessToken(env);
  let response = await send(accessToken);

  if (response.status === 401) {
    accessToken = await refreshAccessToken(env);
    response = await send(accessToken);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status}: ${body}`);
  }

  return response.json();
}
