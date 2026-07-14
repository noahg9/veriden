import * as vscode from 'vscode';
import { PanelViewProvider } from './panel';
import { ApiKeyAuthProvider } from './auth/apiKey';
import { MessagesBackend } from './agent/anthropic';
import { Staging } from './changes/staging';
import { createCheckpointStore } from './checkpoint/store';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const auth = new ApiKeyAuthProvider(context.secrets);
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const storageDir = (context.storageUri ?? context.globalStorageUri).fsPath;

  const checkpoints = root ? await createCheckpointStore(root, storageDir) : undefined;
  const staging = root ? new Staging(root, checkpoints) : undefined;
  const backend = new MessagesBackend(auth, staging, root);
  const provider = new PanelViewProvider(context, auth, backend, staging, checkpoints);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(PanelViewProvider.viewId, provider, {
      // Keep the webview alive when hidden so panel state survives hide/show (FR-001).
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand('foxbagel.openPanel', () => {
      void vscode.commands.executeCommand(`${PanelViewProvider.viewId}.focus`);
    }),
    vscode.commands.registerCommand('foxbagel.setApiKey', async () => {
      const key = await vscode.window.showInputBox({
        title: 'Foxbagel — Anthropic API Key',
        prompt: 'Stored in VS Code SecretStorage. Never written to logs or settings.',
        placeHolder: 'sk-ant-…',
        password: true,
        ignoreFocusOut: true,
      });
      if (key && key.trim()) {
        await auth.setKey(key.trim());
        void vscode.window.showInformationMessage('Foxbagel: API key saved.');
      }
    }),
    vscode.commands.registerCommand('foxbagel.clearApiKey', async () => {
      await auth.clearKey();
      void vscode.window.showInformationMessage('Foxbagel: API key cleared.');
    }),
  );
}

export function deactivate(): void {
  // Nothing to clean up yet.
}
