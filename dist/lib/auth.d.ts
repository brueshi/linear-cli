/**
 * AuthManager handles secure storage and retrieval of Linear API keys
 * using the macOS Keychain via keytar.
 */
export declare const AuthManager: {
    /**
     * Store an API key securely in the system keychain
     */
    saveApiKey(apiKey: string): Promise<void>;
    /**
     * Retrieve the stored API key from the system keychain
     * @returns The API key if found, null otherwise
     */
    getApiKey(): Promise<string | null>;
    /**
     * Remove the stored API key from the system keychain
     * @returns true if a key was deleted, false if no key existed
     */
    deleteApiKey(): Promise<boolean>;
    /**
     * Check if an API key is currently stored
     */
    hasApiKey(): Promise<boolean>;
};
