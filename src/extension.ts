import * as vscode from 'vscode';
import { PanelViewProvider } from './panel';
import { ApiKeyAuthProvider } from './auth/apiKey';
import { MessagesBackend } from './agent/anthropic';
import { Staging } from './changes/staging';

export function activate(context: vscode.ExtensionContext): void {
  const auth = new ApiKeyAuthProvider(context.secrets);
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const staging = root ? new Staging(root) : undefined;
  const backend = new MessagesBackend(auth, staging, root);
  const provider = new PanelViewProvider(context, auth, backend, staging);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(PanelViewProvider.viewId, provider, {
      // Keep the webview alive when hidden so panel state survives hide/show (FR-001).
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand('veriden.openPanel', () => {
      void vscode.commands.executeCommand(`${PanelViewProvider.viewId}.focus`);
    }),
    vscode.commands.registerCommand('veriden.setApiKey', async () => {
      const key = await vscode.window.showInputBox({
        title: 'Veriden — Anthropic API Key',
        prompt: 'Stored in VS Code SecretStorage. Never written to logs or settings.',
        placeHolder: 'sk-ant-…',
        password: true,
        ignoreFocusOut: true,
      });
      if (key && key.trim()) {
        await auth.setKey(key.trim());
        void vscode.window.showInformationMessage('Veriden: API key saved.');
      }
    }),
    vscode.commands.registerCommand('veriden.clearApiKey', async () => {
      await auth.clearKey();
      void vscode.window.showInformationMessage('Veriden: API key cleared.');
    }),
  );
}

export function deactivate(): void {
  // Nothing to clean up yet.
}
