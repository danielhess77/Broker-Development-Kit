const AUTHORIZE_URL = "https://api.schwabapi.com/v1/oauth/authorize";
const TOKEN_URL = "https://api.schwabapi.com/v1/oauth/token";

export interface Env {
  SCHWAB_CLIENT_ID: string;
  SCHWAB_CLIENT_SECRET: string;
  SCHWAB_REDIRECT_URI: string;

  BDK_AUTH: KVNamespace;
}

function jsonResponse(
  data: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export async function loginHandler(
  _request: Request,
  env: Env
): Promise<Response> {

  const state = crypto.randomUUID();

  await env.BDK_AUTH.put("oauth_state", state);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.SCHWAB_CLIENT_ID,
    redirect_uri: env.SCHWAB_REDIRECT_URI,
    state,
  });

  return Response.redirect(
    `${AUTHORIZE_URL}?${params.toString()}`,
    302
  );
}

export async function callbackHandler(
  request: Request,
  env: Env
): Promise<Response> {

  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const expectedState =
    await env.BDK_AUTH.get("oauth_state");

  if (!code) {
    return jsonResponse(
      { error: "Missing authorization code" },
      400
    );
  }

  if (state !== expectedState) {
    return jsonResponse(
      { error: "Invalid OAuth state" },
      400
    );
  }

  const credentials = btoa(
    `${env.SCHWAB_CLIENT_ID}:${env.SCHWAB_CLIENT_SECRET}`
  );

  const response = await fetch(TOKEN_URL, {
    method: "POST",

    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type":
        "application/x-www-form-urlencoded",
    },

    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: env.SCHWAB_REDIRECT_URI,
    }),
  });

  const token: any = await response.json();

  if (!response.ok) {
    return jsonResponse(token, response.status);
  }

  await env.BDK_AUTH.put(
    "tokens",
    JSON.stringify(token)
  );

  return jsonResponse({
    success: true,
    expires: token.expires_in,
  });
}