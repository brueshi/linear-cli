import { secrets } from '../secrets.js';

const SERVICE_NAME = 'linear-cli-anthropic';
const ACCOUNT_NAME = 'api-key';
const ENV_VAR_NAME = 'ANTHROPIC_API_KEY';

/**
 * AnthropicAuthManager handles secure storage and retrieval of Anthropic API keys.
 *
 * Priority order:
 * 1. ANTHROPIC_API_KEY environment variable (for headless/CI/server environments)
 * 2. System keychain via Bun.secrets (Bun runtime) or keytar (Node.js)
 *
 * When ANTHROPIC_API_KEY is set, keytar is never imported for this key,
 * avoiding D-Bus crashes on headless servers without a secrets service.
 */
export const AnthropicAuthManager = {
  /**
   * Check if authentication is provided via environment variable.
   */
  isEnvAuth(): boolean {
    return !!process.env[ENV_VAR_NAME];
  },

  /**
   * Store an Anthropic API key securely in the system keychain
   */
  async saveApiKey(apiKey: string): Promise<void> {
    await secrets.set(SERVICE_NAME, ACCOUNT_NAME, apiKey);
  },

  /**
   * Retrieve the Anthropic API key. Checks ANTHROPIC_API_KEY env var first,
   * then falls back to the system keychain.
   * @returns The API key if found, null otherwise
   */
  async getApiKey(): Promise<string | null> {
    const envKey = process.env[ENV_VAR_NAME];
    if (envKey) {
      return envKey;
    }
    return secrets.get(SERVICE_NAME, ACCOUNT_NAME);
  },

  /**
   * Remove the stored Anthropic API key from the system keychain
   * @returns true if a key was deleted, false if no key existed
   */
  async deleteApiKey(): Promise<boolean> {
    return secrets.delete(SERVICE_NAME, ACCOUNT_NAME);
  },

  /**
   * Check if an Anthropic API key is available (via env var or keychain)
   */
  async hasApiKey(): Promise<boolean> {
    const key = await this.getApiKey();
    return key !== null;
  },
};
