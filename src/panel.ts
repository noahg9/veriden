import * as vscode from 'vscode';
import type { HostToWebview, WebviewToHost } from './bridge';

/**
 * Hosts the primary panel as a webview view in the activity bar (FR-001).
 * M0 scope: mount the React webview and prove the typed bridge round-trips.
 */
export class PanelViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'veriden.panel';

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist')],
    };
    view.webview.html = this.render(view.webview);

    view.webview.onDidReceiveMessage((message: WebviewToHost) => {
      switch (message.type) {
        case 'ready':
          this.post(view.webview, {
            type: 'init',
            workspace: {
              name: vscode.workspace.name ?? null,
              folderCount: vscode.workspace.workspaceFolders?.length ?? 0,
            },
            extensionVersion: this.version(),
          });
          break;
        case 'ping':
          this.post(view.webview, { type: 'pong', at: new Date().toISOString() });
          break;
      }
    });
  }

  private post(webview: vscode.Webview, message: HostToWebview): void {
    void webview.postMessage(message);
  }

  private version(): string {
    const pkg = this.context.extension.packageJSON as { version?: string };
    return pkg.version ?? '0.0.0';
  }

  private render(webview: vscode.Webview): string {
    const nonce = getNonce();
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.js'),
    );
    const csp = [
      `default-src 'none'`,
      `img-src ${webview.cspSource} data:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `font-src ${webview.cspSource}`,
      `script-src 'nonce-${nonce}'`,
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Veriden</title>
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
