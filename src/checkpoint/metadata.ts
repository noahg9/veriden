import * as fs from 'fs/promises';
import * as path from 'path';
import type { Checkpoint } from '../bridge';

const FILE = 'checkpoints.json';
const MAX_KEPT = 20;

/** The last-N checkpoint list, persisted as JSON so it survives an extension
 * restart (FR-006 AC), independent of the CheckpointBackend in use. */
export class CheckpointMetadata {
  private cache: Checkpoint[] | undefined;

  constructor(private readonly storageDir: string) {}

  private get filePath(): string {
    return path.join(this.storageDir, FILE);
  }

  private async load(): Promise<Checkpoint[]> {
    if (this.cache) return this.cache;
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      this.cache = Array.isArray(parsed) ? (parsed as Checkpoint[]) : [];
    } catch {
      this.cache = [];
    }
    return this.cache;
  }

  private async save(list: Checkpoint[]): Promise<void> {
    this.cache = list;
    await fs.mkdir(this.storageDir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(list, null, 2), 'utf8');
  }

  /** Add a new checkpoint at the front. Returns ids trimmed off the end, to forget. */
  async add(entry: Checkpoint): Promise<string[]> {
    const list = [entry, ...(await this.load())];
    const trimmed = list.splice(MAX_KEPT);
    await this.save(list);
    return trimmed.map((c) => c.id);
  }

  async list(): Promise<Checkpoint[]> {
    return [...(await this.load())];
  }

  async get(id: string): Promise<Checkpoint | undefined> {
    return (await this.load()).find((c) => c.id === id);
  }
}
