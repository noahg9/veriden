import type { HostToWebview, WebviewToHost, StagedChange } from '../src/bridge';

interface VsCodeApi {
  postMessage(message: WebviewToHost): void;
  getState<T>(): T | undefined;
  setState<T>(state: T): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

// The webview may only acquire this handle once per load.
export const vscodeApi = acquireVsCodeApi();
export type { HostToWebview, WebviewToHost, StagedChange };
