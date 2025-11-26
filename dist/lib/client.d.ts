import { LinearClient } from '@linear/sdk';
/**
 * Create a Linear client instance with the provided API key
 */
export declare function createLinearClient(apiKey: string): LinearClient;
/**
 * Get an authenticated Linear client using stored credentials.
 * Exits the process if not authenticated.
 */
export declare function getAuthenticatedClient(): Promise<LinearClient>;
