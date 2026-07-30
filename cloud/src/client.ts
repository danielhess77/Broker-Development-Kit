import { getAccessToken, refreshAccessToken } from "./token";
import type { Env } from "./token";

const API_BASE = "https://api.schwabapi.com";

export async function schwabRequest(
  env: Env,
  path: string,
  init: RequestInit = {}
): Promise<any> {

  let accessToken = await getAccessToken(env);

  let response = await fetch(
    `${API_BASE}${path}`,
    {
      ...init,

      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(init.headers ?? {})
      }
    }
  );

  if (response.status === 401) {

    accessToken = await refreshAccessToken(env);

    response = await fetch(
      `${API_BASE}${path}`,
      {
        ...init,

        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          ...(init.headers ?? {})
        }
      }
    );

  }

  if (!response.ok) {

    const body = await response.text();

    throw new Error(
      `${response.status}: ${body}`
    );

  }

  return response.json();

}