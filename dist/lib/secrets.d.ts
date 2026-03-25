/**
 * Cross-runtime secrets management
 * Uses Bun.secrets when running under Bun, falls back to keytar for Node.js
 *
 * Both use the same underlying OS APIs:
 * - macOS: Keychain Services
 * - Linux: libsecret (GNOME Keyring, KWallet, etc.)
 * - Windows: Credential Manager
 *
 * This means credentials stored with one runtime can be read by the other.
 */
export declare const isBun: boolean;
interface SecretsProvider {
    get(service: string, name: string): Promise<string | null>;
    set(service: string, name: string, value: string): Promise<void>;
    delete(service: string, name: string): Promise<boolean>;
}
/**
 * Unified secrets provider - automatically uses the appropriate backend
 * based on the runtime environment
 */
export declare const secrets: SecretsProvider;
export {};
