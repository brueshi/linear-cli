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

interface SecretsProvider {
  get(service: string, name: string): Promise<string | null>;
  set(service: string, name: string, value: string): Promise<void>;
  delete(service: string, name: string): Promise<boolean>;
}

// Lazy-loaded keytar for Node.js (avoids loading native module when using Bun)
let keytarModule: typeof import('keytar') | null = null;

async function getKeytar() {
  if (!keytarModule) {
    keytarModule = await import('keytar');
  }
  return keytarModule;
}

/**
 * Bun secrets provider using native Bun.secrets API
 */
const bunSecrets: SecretsProvider = {
  async get(service: string, name: string): Promise<string | null> {
    return Bun.secrets.get({ service, name });
  },
  async set(service: string, name: string, value: string): Promise<void> {
    await Bun.secrets.set({ service, name, value });
  },
  async delete(service: string, name: string): Promise<boolean> {
    return Bun.secrets.delete({ service, name });
  },
};

/**
 * Node.js secrets provider using keytar
 */
const nodeSecrets: SecretsProvider = {
  async get(service: string, name: string): Promise<string | null> {
    const keytar = await getKeytar();
    return keytar.getPassword(service, name);
  },
  async set(service: string, name: string, value: string): Promise<void> {
    const keytar = await getKeytar();
    await keytar.setPassword(service, name, value);
  },
  async delete(service: string, name: string): Promise<boolean> {
    const keytar = await getKeytar();
    return keytar.deletePassword(service, name);
  },
};

/**
 * Unified secrets provider - automatically uses the appropriate backend
 * based on the runtime environment
 */
export const secrets: SecretsProvider = isBun ? bunSecrets : nodeSecrets;
