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
// Detect if running under Bun
export const isBun = typeof Bun !== 'undefined';
// Lazy-loaded keytar for Node.js (avoids loading native module when using Bun)
let keytarModule = null;
async function getKeytar() {
    if (!keytarModule) {
        keytarModule = await import('keytar');
    }
    return keytarModule;
}
/**
 * Bun secrets provider using native Bun.secrets API
 */
const bunSecrets = {
    async get(service, name) {
        return Bun.secrets.get({ service, name });
    },
    async set(service, name, value) {
        await Bun.secrets.set({ service, name, value });
    },
    async delete(service, name) {
        return Bun.secrets.delete({ service, name });
    },
};
/**
 * Node.js secrets provider using keytar
 */
const nodeSecrets = {
    async get(service, name) {
        const keytar = await getKeytar();
        return keytar.getPassword(service, name);
    },
    async set(service, name, value) {
        const keytar = await getKeytar();
        await keytar.setPassword(service, name, value);
    },
    async delete(service, name) {
        const keytar = await getKeytar();
        return keytar.deletePassword(service, name);
    },
};
/**
 * Unified secrets provider - automatically uses the appropriate backend
 * based on the runtime environment
 */
export const secrets = isBun ? bunSecrets : nodeSecrets;
