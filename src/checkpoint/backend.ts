/** The snapshot/restore mechanism behind a checkpoint (ADR-4). */
export interface CheckpointBackend {
  snapshot(id: string): Promise<void>;
  /** Undoes this checkpoint's run and every run since. `newerIds` (oldest-first)
   * lets a backend that only tracks changed files look past manifests that
   * don't mention a given path; backends that snapshot the whole tree can ignore it. */
  restore(id: string, newerIds: string[]): Promise<void>;
  forget(id: string): Promise<void>;
  /** Called by the staging layer right before writing `relPath`; no-op for backends
   * whose snapshot() already covers the whole tree. */
  beforeWrite(id: string, relPath: string): Promise<void>;
}
