import { SCHWAB } from "./config";

export interface Env {
  SCHWAB_CLIENT_ID: string;
}

export async function loginHandler(
  request: Request,
  env: Env
): Promise<Response> {

  const redirectUri =
    new URL(SCHWAB.redirectPath, request.url).toString();

  const url = new URL(SCHWAB.authorizeUrl);

  url.searchParams.set("client_id", env.SCHWAB_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");

  return Response.redirect(url.toString(), 302);
}

export async function callbackHandler(): Promise<Response> {

  return Response.json({
    success: true,
    message: "Authorization code received.",
    next: "Exchange code for tokens",
  });

}