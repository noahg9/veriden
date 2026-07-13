// Typed message bridge between the extension host and the webview.
// Both sides import these types so postMessage payloads stay in sync — this is
// the single seam all host⇄webview communication flows through.

export interface WorkspaceInfo {
  name: string | null;
  folderCount: number;
}

/** A file edit the agent has staged for review (never yet written to disk). */
export interface StagedChange {
  path: string;
  kind: 'create' | 'modify';
  diff: string; // unified diff, for display
  additions: number;
  deletions: number;
}

/** A streamed step from the agent as it produces a response. */
export type AgentEvent =
  | { type: 'text'; text: string }
  | { type: 'tool'; label: string }
  | { type: 'change'; change: StagedChange }
  | { type: 'done' }
  | { type: 'error'; message: string };

/** Messages the extension host sends to the webview. */
export type HostToWebview =
  | { type: 'init'; workspace: WorkspaceInfo; extensionVersion: string; hasApiKey: boolean }
  | { type: 'authState'; hasApiKey: boolean }
  | { type: 'agentEvent'; event: AgentEvent }
  | { type: 'changeResolved'; path: string; status: 'applied' | 'rejected' }
  | { type: 'runState'; running: boolean };

/** Messages the webview sends to the extension host. */
export type WebviewToHost =
  | { type: 'ready' }
  | { type: 'submitIntent'; text: string }
  | { type: 'interrupt' }
  | { type: 'approveChange'; path: string }
  | { type: 'rejectChange'; path: string }
  | { type: 'setApiKey' };
