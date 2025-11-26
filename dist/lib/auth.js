import keytar from 'keytar';
const SERVICE_NAME = 'linear-cli';
const ACCOUNT_NAME = 'api-key';
/**
 * AuthManager handles secure storage and retrieval of Linear API keys
 * using the macOS Keychain via keytar.
 */
export const AuthManager = {
    /**
     * Store an API key securely in the system keychain
     */
    async saveApiKey(apiKey) {
        await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, apiKey);
    },
    /**
     * Retrieve the stored API key from the system keychain
     * @returns The API key if found, null otherwise
     */
    async getApiKey() {
        return keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
    },
    /**
     * Remove the stored API key from the system keychain
     * @returns true if a key was deleted, false if no key existed
     */
    async deleteApiKey() {
        return keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
    },
    /**
     * Check if an API key is currently stored
     */
    async hasApiKey() {
        const key = await this.getApiKey();
        return key !== null;
    },
};
