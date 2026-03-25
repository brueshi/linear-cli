/**
 * AnthropicAuthManager handles secure storage and retrieval of Anthropic API keys.
 *
 * Priority order:
 * 1. ANTHROPIC_API_KEY environment variable (for headless/CI/server environments)
 * 2. System keychain via Bun.secrets (Bun runtime) or keytar (Node.js)
 *
 * When ANTHROPIC_API_KEY is set, secrets.ts is never imported, so keytar
 * is never loaded — avoiding D-Bus crashes on headless servers.
 */
export declare const AnthropicAuthManager: {
    /**
     * Check if authentication is provided via environment variable.
     */
    isEnvAuth(): boolean;
    /**
     * Store an Anthropic API key securely in the system keychain
     */
    saveApiKey(apiKey: string): Promise<void>;
    /**
     * Retrieve the Anthropic API key. Checks ANTHROPIC_API_KEY env var first,
     * then falls back to the system keychain.
     * @returns The API key if found, null otherwise
     */
    getApiKey(): Promise<string | null>;
    /**
     * Remove the stored Anthropic API key from the system keychain
     * @returns true if a key was deleted, false if no key existed
     */
    deleteApiKey(): Promise<boolean>;
    /**
     * Check if an Anthropic API key is available (via env var or keychain)
     */
    hasApiKey(): Promise<boolean>;
};
