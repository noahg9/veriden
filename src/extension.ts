import * as vscode from 'vscode';
import { PanelViewProvider } from './panel';

export function activate(context: vscode.ExtensionContext): void {
  const provider = new PanelViewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(PanelViewProvider.viewId, provider, {
      // Keep the webview alive when hidden so panel state survives hide/show (FR-001).
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand('veriden.openPanel', () => {
      void vscode.commands.executeCommand(`${PanelViewProvider.viewId}.focus`);
    }),
  );
}

export function deactivate(): void {
  // Nothing to clean up yet.
}
