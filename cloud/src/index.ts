import {
  loginHandler,
  callbackHandler,
} from "./auth";

export interface Env {
  SCHWAB_CLIENT_ID: string;
}

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
          version: "0.3.0",
          status: "online",
        });

      case "/auth/login":
        return loginHandler(request, env);

      case "/auth/callback":
        return callbackHandler();

      default:
        return Response.json(
          { error: "Not Found" },
          { status: 404 }
        );

    }

  },

};