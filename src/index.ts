import open from "open";

import {
    generateState,
    buildAuthorizationUrl
} from "./auth/OAuth";

async function main() {

    console.log("Broker Development Kit");

    const state = generateState();

    const url = buildAuthorizationUrl(state);

    console.log("");
    console.log("Opening browser...");
    console.log("");

    console.log(url);

    await open(url);
}

main().catch(console.error);