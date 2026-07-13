// Typed message bridge between the extension host and the webview.
// Both sides import these types so postMessage payloads stay in sync — this is
// the single seam all host⇄webview communication flows through.

export interface WorkspaceInfo {
  name: string | null;
  folderCount: number;
}

/** Messages the extension host sends to the webview. */
export type HostToWebview =
  | { type: 'init'; workspace: WorkspaceInfo; extensionVersion: string }
  | { type: 'pong'; at: string };

/** Messages the webview sends to the extension host. */
export type WebviewToHost =
  | { type: 'ready' }
  | { type: 'ping' };
