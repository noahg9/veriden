import * as vscode from 'vscode';
import type { AuthProvider } from './provider';

const SECRET_KEY = 'foxbagel.anthropicApiKey';

/**
 * Stores the Anthropic API key in VS Code SecretStorage (FR-009).
 * The key never touches settings JSON, logs, or disk in plaintext.
 */
export class ApiKeyAuthProvider implements AuthProvider {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  getKey(): Promise<string | undefined> {
    return Promise.resolve(this.secrets.get(SECRET_KEY));
  }

  async setKey(key: string): Promise<void> {
    await this.secrets.store(SECRET_KEY, key);
  }

  async clearKey(): Promise<void> {
    await this.secrets.delete(SECRET_KEY);
  }

  async hasKey(): Promise<boolean> {
    return (await this.secrets.get(SECRET_KEY)) !== undefined;
  }
}
