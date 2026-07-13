import * as fs from 'fs/promises';
import * as path from 'path';
import type Anthropic from '@anthropic-ai/sdk';
import type { StagedChange } from '../bridge';
import type { Staging } from '../changes/staging';

// The gated tool layer (FR-003, ADR-6). Every path is confined to the workspace
// and checked against a deny-list that no approval mode can override. Writes are
// staged, never applied here.
const DENY_PATTERNS: RegExp[] = [
  /(^|\/)\.env(\.[^/]*)?$/, // .env, .env.local, ...
  /(^|\/)\.git(\/|$)/,
  /(^|\/)\.ssh(\/|$)/,
  /(^|\/)id_rsa/,
  /(^|\/)\.aws(\/|$)/,
];

export const TOOLS: Anthropic.Tool[] = [
  {
    name: 'read_file',
    description:
      'Read a UTF-8 text file, relative to the workspace root. Returns the pending staged version if one exists, otherwise the version on disk.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Workspace-relative file path' } },
      required: ['path'],
    },
  },
  {
    name: 'list_dir',
    description: 'List the entries of a directory, relative to the workspace root.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Workspace-relative directory path; defaults to root' } },
    },
  },
  {
    name: 'write_file',
    description:
      'Propose the full new contents of a file. The change is STAGED for the user to review and approve — it is NOT written to disk until the user approves it. Provide the complete file, not a fragment.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Workspace-relative file path' },
        content: { type: 'string', description: 'Full new file contents' },
      },
      required: ['path', 'content'],
    },
  },
];

export interface ToolOutcome {
  resultText: string;
  isError?: boolean;
  change?: StagedChange;
}

export function toolLabel(name: string, input: unknown): string {
  const p = typeof input === 'object' && input && 'path' in input ? String((input as { path: unknown }).path) : '';
  switch (name) {
    case 'read_file':
      return `read ${p}`;
    case 'list_dir':
      return `list ${p || '.'}`;
    case 'write_file':
      return `propose changes to ${p}`;
    default:
      return name;
  }
}

export async function executeTool(
  name: string,
  input: unknown,
  staging: Staging,
  root: string,
): Promise<ToolOutcome> {
  const args = (input ?? {}) as { path?: unknown; content?: unknown };

  if (name === 'list_dir') {
    const rel = args.path ? safeRel(root, String(args.path)) : '';
    if (rel === null) return denied('path escapes the workspace');
    if (isDenied(rel)) return denied(`access to "${rel}" is blocked by the deny-list`);
    try {
      const entries = await fs.readdir(path.join(root, rel), { withFileTypes: true });
      const listing = entries
        .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
        .sort()
        .join('\n');
      return { resultText: listing || '(empty directory)' };
    } catch (err) {
      return { resultText: `Could not list "${rel}": ${errMsg(err)}`, isError: true };
    }
  }

  const relPath = safeRel(root, String(args.path ?? ''));
  if (relPath === null) return denied('path escapes the workspace');
  if (isDenied(relPath)) return denied(`access to "${relPath}" is blocked by the deny-list`);

  if (name === 'read_file') {
    const staged = staging.stagedContent(relPath);
    const content = staged ?? (await staging.readOriginal(relPath));
    if (content === null) return { resultText: `File not found: ${relPath}`, isError: true };
    return { resultText: content };
  }

  if (name === 'write_file') {
    if (typeof args.content !== 'string') {
      return { resultText: 'write_file requires a string "content".', isError: true };
    }
    const change = await staging.stage(relPath, args.content);
    return {
      resultText: `Staged ${change.kind} of ${relPath} (+${change.additions} -${change.deletions}). Awaiting user review — not yet written to disk.`,
      change,
    };
  }

  return { resultText: `Unknown tool: ${name}`, isError: true };
}

function safeRel(root: string, input: string): string | null {
  const abs = path.resolve(root, input);
  const rel = path.relative(root, abs);
  if (rel === '' ) return '';
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join('/');
}

function isDenied(relPath: string): boolean {
  return DENY_PATTERNS.some((re) => re.test(relPath));
}

function denied(reason: string): ToolOutcome {
  return { resultText: `Refused: ${reason}.`, isError: true };
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
