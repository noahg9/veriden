import * as fs from 'fs/promises';
import * as path from 'path';
import type { CheckpointBackend } from './backend';

interface ManifestEntry {
  existed: boolean;
  backup?: string; // filename under this checkpoint's storage dir
}
type Manifest = Record<string, ManifestEntry>;

/** File-copy fallback (ADR-4) for non-git workspaces. Staging.apply() calls
 * beforeWrite() before every write, so a file's prior content is captured
 * the first time it changes after a checkpoint is created. */
export class FileCopyCheckpointBackend implements CheckpointBackend {
  constructor(
    private readonly root: string,
    private readonly storageDir: string,
  ) {}

  private dirFor(id: string): string {
    return path.join(this.storageDir, 'checkpoint-files', id);
  }

  private manifestPath(id: string): string {
    return path.join(this.dirFor(id), 'manifest.json');
  }

  async snapshot(id: string): Promise<void> {
    await fs.mkdir(this.dirFor(id), { recursive: true });
    await this.writeManifest(id, {});
  }

  async beforeWrite(id: string, relPath: string): Promise<void> {
    const manifest = await this.readManifest(id);
    if (relPath in manifest) return; // already captured for this checkpoint

    const abs = path.join(this.root, relPath);
    let entry: ManifestEntry;
    try {
      const content = await fs.readFile(abs);
      const backup = encodeName(relPath);
      await fs.mkdir(this.dirFor(id), { recursive: true });
      await fs.writeFile(path.join(this.dirFor(id), backup), content);
      entry = { existed: true, backup };
    } catch {
      entry = { existed: false };
    }
    manifest[relPath] = entry;
    await this.writeManifest(id, manifest);
  }

  async restore(id: string, newerIds: string[]): Promise<void> {
    // First manifest entry found walking id -> newest wins: that's the
    // file's state right after id, before this run or any later one touched it.
    const resolved = new Map<string, { entry: ManifestEntry; sourceId: string }>();
    for (const cpId of [id, ...newerIds]) {
      const manifest = await this.readManifest(cpId);
      for (const [relPath, entry] of Object.entries(manifest)) {
        if (!resolved.has(relPath)) {
          resolved.set(relPath, { entry, sourceId: cpId });
        }
      }
    }

    for (const [relPath, { entry, sourceId }] of resolved) {
      const abs = path.join(this.root, relPath);
      if (entry.existed && entry.backup) {
        const content = await fs.readFile(path.join(this.dirFor(sourceId), entry.backup));
        await fs.mkdir(path.dirname(abs), { recursive: true });
        await fs.writeFile(abs, content);
      } else {
        await fs.rm(abs, { force: true });
      }
    }
  }

  async forget(id: string): Promise<void> {
    await fs.rm(this.dirFor(id), { recursive: true, force: true });
  }

  private async readManifest(id: string): Promise<Manifest> {
    try {
      return JSON.parse(await fs.readFile(this.manifestPath(id), 'utf8')) as Manifest;
    } catch {
      return {};
    }
  }

  private async writeManifest(id: string, manifest: Manifest): Promise<void> {
    await fs.writeFile(this.manifestPath(id), JSON.stringify(manifest), 'utf8');
  }
}

function encodeName(relPath: string): string {
  return Buffer.from(relPath).toString('base64url');
}
