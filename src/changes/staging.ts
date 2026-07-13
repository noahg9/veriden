import * as fs from 'fs/promises';
import * as path from 'path';
import { createTwoFilesPatch } from 'diff';
import type { StagedChange } from '../bridge';

/**
 * The staging overlay (ADR-3). Agent writes land here as proposed file content,
 * never on disk directly; disk is mutated only when a change is approved and
 * applied. Reads go through the overlay first so the agent sees a self-consistent
 * view of its own pending edits.
 *
 * M1: full-file staging with per-file review. Per-hunk apply + on-disk journal
 * are the next refinements.
 */
export class Staging {
  private readonly overlay = new Map<string, string>();

  constructor(private readonly root: string) {}

  stagedContent(relPath: string): string | undefined {
    return this.overlay.get(relPath);
  }

  async readOriginal(relPath: string): Promise<string | null> {
    try {
      return await fs.readFile(path.join(this.root, relPath), 'utf8');
    } catch {
      return null;
    }
  }

  /** Stage proposed content and return its reviewable diff against disk. */
  async stage(relPath: string, content: string): Promise<StagedChange> {
    this.overlay.set(relPath, content);
    const original = await this.readOriginal(relPath);
    const diff = createTwoFilesPatch(relPath, relPath, original ?? '', content, '', '');

    let additions = 0;
    let deletions = 0;
    for (const line of diff.split('\n')) {
      if (line.startsWith('+') && !line.startsWith('+++')) additions++;
      else if (line.startsWith('-') && !line.startsWith('---')) deletions++;
    }

    return {
      path: relPath,
      kind: original === null ? 'create' : 'modify',
      diff,
      additions,
      deletions,
    };
  }

  /** Land an approved change on disk and clear it from the overlay. */
  async apply(relPath: string): Promise<void> {
    const content = this.overlay.get(relPath);
    if (content === undefined) return;
    const abs = path.join(this.root, relPath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, 'utf8');
    this.overlay.delete(relPath);
  }

  discard(relPath: string): void {
    this.overlay.delete(relPath);
  }
}
