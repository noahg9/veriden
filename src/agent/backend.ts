import type { AgentEvent } from '../bridge';

export type { AgentEvent };

export interface AgentTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface AgentRunInput {
  intent: string;
  history: AgentTurn[];
}

/**
 * The single seam over the model/agent provider (ADR-2, NFR-003). M1 ships a
 * Messages-API implementation that streams text; the tooled Claude Agent SDK
 * implementation replaces it behind this same interface when the gated tool
 * layer lands, with no changes to the bridge or UI.
 */
export interface AgentBackend {
  run(input: AgentRunInput, signal: AbortSignal): AsyncIterable<AgentEvent>;
}
