const SERVICE_NAME = 'linear-cli';
const ACCOUNT_NAME = 'api-key';
const ENV_VAR_NAME = 'LINEAR_API_KEY';
/**
 * Lazily import secrets module so that keytar (and its D-Bus dependency)
 * is never loaded when env var auth is active.
 */
async function loadSecrets() {
    const { secrets } = await import('./secrets.js');
    return secrets;
}
/**
 * AuthManager handles secure storage and retrieval of Linear API keys.
 *
 * Priority order:
 * 1. LINEAR_API_KEY environment variable (for headless/CI/server environments)
 * 2. System keychain via Bun.secrets (Bun runtime) or keytar (Node.js)
 *
 * When LINEAR_API_KEY is set, secrets.ts is never imported, so keytar
 * is never loaded — avoiding D-Bus crashes on headless servers.
 */
export const AuthManager = {
    /**
     * Check if authentication is provided via environment variable.
     */
    isEnvAuth() {
        return !!process.env[ENV_VAR_NAME];
    },
    /**
     * Store an API key securely in the system keychain
     */
    async saveApiKey(apiKey) {
        const secrets = await loadSecrets();
        await secrets.set(SERVICE_NAME, ACCOUNT_NAME, apiKey);
    },
    /**
     * Retrieve the API key. Checks LINEAR_API_KEY env var first,
     * then falls back to the system keychain.
     * @returns The API key if found, null otherwise
     */
    async getApiKey() {
        const envKey = process.env[ENV_VAR_NAME];
        if (envKey) {
            return envKey;
        }
        const secrets = await loadSecrets();
        return secrets.get(SERVICE_NAME, ACCOUNT_NAME);
    },
    /**
     * Remove the stored API key from the system keychain
     * @returns true if a key was deleted, false if no key existed
     */
    async deleteApiKey() {
        const secrets = await loadSecrets();
        return secrets.delete(SERVICE_NAME, ACCOUNT_NAME);
    },
    /**
     * Check if an API key is available (via env var or keychain)
     */
    async hasApiKey() {
        const key = await this.getApiKey();
        return key !== null;
    },
};
