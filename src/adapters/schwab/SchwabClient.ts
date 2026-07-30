export class SchwabClient {
    constructor() {
        console.log("SchwabClient initialized.");
    }

    public async connect(): Promise<void> {
        throw new Error("Not implemented");
    }

    public async getQuote(symbol: string): Promise<void> {
        throw new Error(`getQuote(${symbol}) not implemented`);
    }

    public async getOptionChain(symbol: string): Promise<void> {
        throw new Error(`getOptionChain(${symbol}) not implemented`);
    }
}