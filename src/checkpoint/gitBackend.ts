import { execFile } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import type { CheckpointBackend } from './backend';

const execFileP = promisify(execFile);
const REF_PREFIX = 'refs/foxbagel/checkpoints/';

/** Git-ref checkpoints (ADR-4): a shadow commit on a hidden ref, built via a
 * temporary index so the user's real index/branch is never touched. */
export class GitCheckpointBackend implements CheckpointBackend {
  constructor(private readonly root: string) {}

  async snapshot(id: string): Promise<void> {
    const tree = await snapshotTree(this.root);
    const parent = await tryRevParse(this.root, 'HEAD');
    const args = ['commit-tree', tree, '-m', `foxbagel checkpoint ${id}`];
    if (parent) args.splice(2, 0, '-p', parent);
    const commit = await git(this.root, args);
    await git(this.root, ['update-ref', refFor(id), commit]);
  }

  async restore(id: string): Promise<void> {
    const commit = await git(this.root, ['rev-parse', refFor(id)]);
    const checkpointTree = await git(this.root, ['rev-parse', `${commit}^{tree}`]);
    const currentTree = await snapshotTree(this.root);

    const [checkpointFiles, currentFiles] = await Promise.all([
      listTreeFiles(this.root, checkpointTree),
      listTreeFiles(this.root, currentTree),
    ]);
    const keep = new Set(checkpointFiles);
    const toDelete = currentFiles.filter((f) => !keep.has(f));

    const idx = tmpIndexPath();
    try {
      await git(this.root, ['read-tree', checkpointTree], idx);
      await git(this.root, ['checkout-index', '-a', '-f'], idx);
    } finally {
      await fs.rm(idx, { force: true });
    }
    for (const rel of toDelete) {
      await fs.rm(path.join(this.root, rel), { force: true });
    }
  }

  async forget(id: string): Promise<void> {
    try {
      await git(this.root, ['update-ref', '-d', refFor(id)]);
    } catch {
      // already gone — fine
    }
  }

  async beforeWrite(): Promise<void> {
    // no-op — the whole-tree snapshot at create() time already covers this file.
  }
}

export async function isGitTopLevel(root: string): Promise<boolean> {
  try {
    const inside = await git(root, ['rev-parse', '--is-inside-work-tree']);
    if (inside !== 'true') return false;
    const top = await git(root, ['rev-parse', '--show-toplevel']);
    // --show-toplevel resolves symlinks (e.g. macOS /tmp -> /private/tmp); resolve root too or this false-negatives.
    const [resolvedTop, resolvedRoot] = await Promise.all([
      fs.realpath(top).catch(() => path.resolve(top)),
      fs.realpath(root).catch(() => path.resolve(root)),
    ]);
    return resolvedTop === resolvedRoot;
  } catch {
    return false;
  }
}

function refFor(id: string): string {
  return REF_PREFIX + id;
}

function tmpIndexPath(): string {
  return path.join(os.tmpdir(), `foxbagel-idx-${crypto.randomUUID()}`);
}

/** Stage the entire working tree (respecting .gitignore) into a temp index and return its tree sha. */
async function snapshotTree(root: string): Promise<string> {
  const idx = tmpIndexPath();
  try {
    await git(root, ['add', '-A', '.'], idx);
    return await git(root, ['write-tree'], idx);
  } finally {
    await fs.rm(idx, { force: true });
  }
}

async function listTreeFiles(root: string, tree: string): Promise<string[]> {
  const out = await git(root, ['ls-tree', '-r', '--name-only', '-z', tree]);
  return out.split('\0').filter(Boolean);
}

async function tryRevParse(root: string, ref: string): Promise<string | null> {
  try {
    return await git(root, ['rev-parse', ref]);
  } catch {
    return null; // e.g. an unborn repo with no commits yet
  }
}

async function git(root: string, args: string[], indexFile?: string): Promise<string> {
  const env = indexFile ? { ...process.env, GIT_INDEX_FILE: indexFile } : process.env;
  try {
    const { stdout } = await execFileP('git', args, { cwd: root, env, maxBuffer: 64 * 1024 * 1024 });
    return stdout.trim();
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`git ${args.join(' ')} failed: ${detail}`);
  }
}
