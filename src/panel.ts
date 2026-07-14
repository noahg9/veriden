import * as vscode from 'vscode';
import type { HostToWebview, WebviewToHost } from './bridge';
import type { AuthProvider } from './auth/provider';
import type { AgentBackend, AgentTurn } from './agent/backend';
import type { Staging } from './changes/staging';
import type { CheckpointStore } from './checkpoint/store';

/**
 * Hosts the primary panel as a webview view in the activity bar (FR-001).
 * Runs an intent, streams the reply, stages proposed edits for review, and
 * takes a checkpoint before each run so any run can be rolled back (FR-006).
 */
export class PanelViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'foxbagel.panel';

  private view?: vscode.WebviewView;
  private readonly history: AgentTurn[] = [];
  private abort?: AbortController;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly auth: AuthProvider,
    private readonly backend: AgentBackend,
    private readonly staging: Staging | undefined,
    private readonly checkpoints: CheckpointStore | undefined,
  ) {
    // Reflect key changes (from the set/clear commands) into the panel.
    context.subscriptions.push(
      context.secrets.onDidChange(() => void this.pushAuthState()),
    );
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist')],
    };
    view.webview.html = this.render(view.webview);

    view.webview.onDidReceiveMessage((message: WebviewToHost) => {
      switch (message.type) {
        case 'ready':
          void this.onReady();
          break;
        case 'submitIntent':
          void this.onSubmit(message.text);
          break;
        case 'interrupt':
          this.abort?.abort();
          break;
        case 'approveChange':
          void this.onResolveChange(message.path, true);
          break;
        case 'rejectChange':
          void this.onResolveChange(message.path, false);
          break;
        case 'rollbackCheckpoint':
          void this.onRollback(message.id);
          break;
        case 'setApiKey':
          void vscode.commands.executeCommand('foxbagel.setApiKey');
          break;
      }
    });
  }

  private async onReady(): Promise<void> {
    this.post({
      type: 'init',
      workspace: {
        name: vscode.workspace.name ?? null,
        folderCount: vscode.workspace.workspaceFolders?.length ?? 0,
      },
      extensionVersion: this.version(),
      hasApiKey: await this.auth.hasKey(),
    });
    await this.pushCheckpoints();
  }

  private async onSubmit(text: string): Promise<void> {
    const intent = text.trim();
    if (!intent || this.abort) {
      return;
    }

    if (this.checkpoints) {
      try {
        await this.checkpoints.create(intent);
        await this.pushCheckpoints();
      } catch (err) {
        void vscode.window.showWarningMessage(
          `Foxbagel: couldn't take a checkpoint before this run, so it won't be rollback-able. (${errMsg(err)})`,
        );
      }
    }

    this.abort = new AbortController();
    this.post({ type: 'runState', running: true });

    let reply = '';
    try {
      for await (const event of this.backend.run(
        { intent, history: [...this.history] },
        this.abort.signal,
      )) {
        if (event.type === 'text') {
          reply += event.text;
        }
        this.post({ type: 'agentEvent', event });
      }
    } finally {
      this.abort = undefined;
      this.post({ type: 'runState', running: false });
    }

    // Record the turn so the next message carries context.
    this.history.push({ role: 'user', text: intent });
    if (reply) {
      this.history.push({ role: 'assistant', text: reply });
    }
  }

  private async onResolveChange(relPath: string, approve: boolean): Promise<void> {
    if (!this.staging) return;
    if (approve) {
      await this.staging.apply(relPath);
      this.post({ type: 'changeResolved', path: relPath, status: 'applied' });
    } else {
      this.staging.discard(relPath);
      // Reject-feedback into the session so the agent doesn't reapply it (FR-004).
      this.history.push({
        role: 'user',
        text: `(I rejected the proposed change to ${relPath}. Don't reapply it unless I ask.)`,
      });
      this.post({ type: 'changeResolved', path: relPath, status: 'rejected' });
    }
  }

  private async onRollback(id: string): Promise<void> {
    if (!this.checkpoints) return;
    const checkpoint = (await this.checkpoints.list()).find((c) => c.id === id);
    const label = checkpoint ? truncate(checkpoint.label, 60) : 'this checkpoint';

    const choice = await vscode.window.showWarningMessage(
      `Roll back the workspace to before "${label}"? This overwrites files changed since then and cannot be undone.`,
      { modal: true },
      'Roll Back',
    );
    if (choice !== 'Roll Back') return;

    try {
      await this.checkpoints.rollback(id);
      // Any pending staged proposal was diffed against disk state that may
      // no longer exist after the restore — discard rather than risk
      // applying stale content.
      this.staging?.discardAll();
      this.post({ type: 'workspaceReset' });
      void vscode.window.showInformationMessage('Foxbagel: workspace rolled back.');
    } catch (err) {
      void vscode.window.showErrorMessage(`Foxbagel: rollback failed. (${errMsg(err)})`);
    }
  }

  private async pushCheckpoints(): Promise<void> {
    if (!this.checkpoints) return;
    this.post({ type: 'checkpoints', items: await this.checkpoints.list() });
  }

  private async pushAuthState(): Promise<void> {
    this.post({ type: 'authState', hasApiKey: await this.auth.hasKey() });
  }

  private post(message: HostToWebview): void {
    void this.view?.webview.postMessage(message);
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
    <title>Foxbagel</title>
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

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
