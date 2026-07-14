import Anthropic from '@anthropic-ai/sdk';
import type { AuthProvider } from '../auth/provider';
import type { Staging } from '../changes/staging';
import type { AgentBackend, AgentEvent, AgentRunInput } from './backend';
import { TOOLS, executeTool, toolLabel } from './tools';

// Per the Claude API reference: default to Opus 4.8, stream for responsive
// output. This backend runs a streaming tool-use loop over the Messages API;
// the tooled Claude Agent SDK backend can replace it behind AgentBackend
// later (ADR-2) without touching the bridge or UI.
const MODEL = 'claude-opus-4-8';
const MAX_TOKENS = 16000;
const MAX_TURNS = 16;
const SYSTEM = [
  'You are Foxbagel, an agent working inside an agent-first VS Code IDE.',
  'You can read files, list directories, and propose file edits with your tools.',
  'Edits you make with write_file are STAGED for the user to review — they are not',
  'written to disk until the user approves them, so make your best complete proposal.',
  'Read a file before editing it. Be concise and practical.',
].join(' ');

export class MessagesBackend implements AgentBackend {
  constructor(
    private readonly auth: AuthProvider,
    private readonly staging: Staging | undefined,
    private readonly root: string | undefined,
  ) {}

  async *run(input: AgentRunInput, signal: AbortSignal): AsyncIterable<AgentEvent> {
    try {
      const apiKey = await this.auth.getKey();
      if (!apiKey) {
        yield { type: 'error', message: 'No API key set. Run “Foxbagel: Set Anthropic API Key”.' };
        return;
      }

      const client = new Anthropic({ apiKey });
      const tools = this.staging && this.root ? TOOLS : undefined;
      const messages: Anthropic.MessageParam[] = [
        ...input.history.map((turn) => ({ role: turn.role, content: turn.text })),
        { role: 'user', content: input.intent },
      ];

      for (let turn = 0; turn < MAX_TURNS; turn++) {
        if (signal.aborted) {
          yield { type: 'done' };
          return;
        }

        const stream = client.messages.stream(
          { model: MODEL, max_tokens: MAX_TOKENS, system: SYSTEM, messages, tools },
          { signal },
        );
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            yield { type: 'text', text: event.delta.text };
          }
        }

        const reply = await stream.finalMessage();
        messages.push({ role: 'assistant', content: reply.content });

        if (reply.stop_reason !== 'tool_use') {
          yield { type: 'done' };
          return;
        }

        // Execute every tool call, then feed all results back in one user turn.
        // Check the abort signal before each call so Stop takes effect before
        // the next tool call, not just before the next model turn (FR-008).
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const block of reply.content) {
          if (block.type !== 'tool_use') continue;
          if (signal.aborted) {
            yield { type: 'done' };
            return;
          }
          yield { type: 'tool', label: toolLabel(block.name, block.input) };
          const outcome = await executeTool(block.name, block.input, this.staging!, this.root!);
          if (outcome.change) {
            yield { type: 'change', change: outcome.change };
          }
          results.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: outcome.resultText,
            is_error: outcome.isError,
          });
        }
        messages.push({ role: 'user', content: results });
      }

      yield { type: 'error', message: 'Reached the tool-call limit for this turn.' };
    } catch (err) {
      if (signal.aborted) {
        yield { type: 'done' };
        return;
      }
      yield { type: 'error', message: err instanceof Error ? err.message : String(err) };
    }
  }
}
