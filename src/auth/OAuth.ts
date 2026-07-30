import crypto from "crypto";

export function generateState(): string {
    return crypto.randomBytes(32).toString("hex");
}

import "dotenv/config";

export function buildAuthorizationUrl(state: string): string {

    const clientId = process.env.SCHWAB_CLIENT_ID!;
    const redirectUri = process.env.SCHWAB_REDIRECT_URI!;

    console.log("Client ID:", clientId);
    console.log("Redirect URI:", redirectUri);

    const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        state
    });

    return `https://api.schwabapi.com/v1/oauth/authorize?${params.toString()}`;
}