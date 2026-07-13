import * as crypto from 'crypto';
import type { Checkpoint } from '../bridge';
import type { CheckpointBackend } from './backend';
import { CheckpointMetadata } from './metadata';
import { GitCheckpointBackend, isGitTopLevel } from './gitBackend';
import { FileCopyCheckpointBackend } from './fileCopyBackend';

/** A workspace snapshot taken before each run, with one-click rollback (FR-006). */
export class CheckpointStore {
  private activeId: string | undefined;

  constructor(
    private readonly meta: CheckpointMetadata,
    private readonly backend: CheckpointBackend,
  ) {}

  async create(label: string): Promise<Checkpoint> {
    const id = crypto.randomUUID();
    await this.backend.snapshot(id);
    const checkpoint: Checkpoint = { id, label, createdAt: new Date().toISOString() };
    const forgotten = await this.meta.add(checkpoint);
    await Promise.all(forgotten.map((fid) => this.backend.forget(fid)));
    this.activeId = id;
    return checkpoint;
  }

  list(): Promise<Checkpoint[]> {
    return this.meta.list();
  }

  async rollback(id: string): Promise<void> {
    const list = await this.meta.list();
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) {
      throw new Error('That checkpoint no longer exists.');
    }
    const newerIds = list.slice(0, idx).map((c) => c.id).reverse();
    await this.backend.restore(id, newerIds);
  }

  async beforeWrite(relPath: string): Promise<void> {
    if (!this.activeId) return;
    await this.backend.beforeWrite(this.activeId, relPath);
  }
}

/** Prefers the git-ref backend when the workspace root IS the git top-level;
 * falls back to file-copy otherwise (no git, or a subfolder of a larger repo). */
export async function createCheckpointStore(root: string, storageDir: string): Promise<CheckpointStore> {
  const meta = new CheckpointMetadata(storageDir);
  const backend: CheckpointBackend = (await isGitTopLevel(root))
    ? new GitCheckpointBackend(root)
    : new FileCopyCheckpointBackend(root, storageDir);
  return new CheckpointStore(meta, backend);
}
