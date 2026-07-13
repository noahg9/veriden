import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { vscodeApi, type HostToWebview, type StagedChange, type Checkpoint } from './vscode';

type Item =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool'; label: string }
  | { kind: 'change'; change: StagedChange; status: 'pending' | 'applied' | 'rejected' | 'superseded' };

export function App() {
  const [connected, setConnected] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const [input, setInput] = useState('');
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [checkpointsOpen, setCheckpointsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    const onMessage = (event: MessageEvent<HostToWebview>): void => {
      const message = event.data;
      switch (message.type) {
        case 'init':
          setConnected(true);
          setHasApiKey(message.hasApiKey);
          break;
        case 'authState':
          setHasApiKey(message.hasApiKey);
          break;
        case 'runState':
          setRunning(message.running);
          if (!message.running) sendingRef.current = false;
          break;
        case 'agentEvent':
          applyEvent(message.event);
          break;
        case 'changeResolved':
          setItems((prev) => resolveChange(prev, message.path, message.status));
          break;
        case 'checkpoints':
          setCheckpoints(message.items);
          break;
        case 'workspaceReset':
          // Every pending proposal was diffed against disk state that a
          // rollback may have just overwritten — supersede them all rather
          // than risk approving stale content.
          setItems((prev) => supersedeAllPending(prev));
          break;
      }
    };

    function applyEvent(ev: Extract<HostToWebview, { type: 'agentEvent' }>['event']): void {
      switch (ev.type) {
        case 'text':
          setItems((prev) => appendText(prev, ev.text));
          break;
        case 'error':
          setItems((prev) => appendText(prev, `\n⚠️ ${ev.message}`));
          break;
        case 'tool':
          setItems((prev) => [...prev, { kind: 'tool', label: ev.label }]);
          break;
        case 'change':
          // A fresh proposal for a path replaces any earlier pending proposal
          // for that same path in the staging overlay — mark the stale card
          // superseded so it can never be approved/rejected for content the
          // user didn't actually review.
          setItems((prev) => [
            ...supersedePending(prev, ev.change.path),
            { kind: 'change', change: ev.change, status: 'pending' },
          ]);
          break;
      }
    }

    window.addEventListener('message', onMessage);
    vscodeApi.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [items, running]);

  function submit(): void {
    const text = input.trim();
    if (!text || running || sendingRef.current) return;
    sendingRef.current = true;
    setItems((prev) => [...prev, { kind: 'user', text }]);
    setInput('');
    vscodeApi.postMessage({ type: 'submitIntent', text });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <h1 style={styles.title}>Veriden</h1>
        <span style={styles.status}>
          <span
            style={{
              ...styles.dot,
              background: connected
                ? 'var(--vscode-testing-iconPassed, #3fb950)'
                : 'var(--vscode-testing-iconQueued, #d29922)',
            }}
          />
          {connected ? 'connected' : 'connecting…'}
        </span>
      </header>

      <CheckpointsPanel
        checkpoints={checkpoints}
        open={checkpointsOpen}
        onToggle={() => setCheckpointsOpen((v) => !v)}
      />

      {!hasApiKey && (
        <div style={styles.banner}>
          <span>Set your Anthropic API key to start. It's stored in VS Code SecretStorage.</span>
          <button style={styles.button} onClick={() => vscodeApi.postMessage({ type: 'setApiKey' })}>
            Set API key
          </button>
        </div>
      )}

      <div ref={scrollRef} style={styles.transcript}>
        {items.length === 0 && (
          <p style={styles.empty}>
            Describe what you want to do. Veriden can read your files and propose edits as
            reviewable diffs — nothing is written to disk until you approve it.
          </p>
        )}
        {items.map((item, i) => (
          <ItemView key={i} item={item} />
        ))}
        {running && <div style={styles.working}>working…</div>}
      </div>

      <div style={styles.composer}>
        <textarea
          style={styles.textarea}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={hasApiKey ? 'Ask Veriden…  (Enter to send, Shift+Enter for newline)' : 'Set an API key first'}
          rows={3}
          disabled={!hasApiKey}
        />
        {running ? (
          <button
            style={{ ...styles.button, ...styles.stop }}
            onClick={() => vscodeApi.postMessage({ type: 'interrupt' })}
          >
            Stop
          </button>
        ) : (
          <button style={styles.button} onClick={submit} disabled={!hasApiKey || !input.trim()}>
            Send
          </button>
        )}
      </div>
    </div>
  );
}

function ItemView({ item }: { item: Item }) {
  if (item.kind === 'tool') {
    return <div style={styles.tool}>· {item.label}</div>;
  }
  if (item.kind === 'change') {
    return <ChangeCard change={item.change} status={item.status} />;
  }
  return (
    <div style={styles.turn}>
      <div style={styles.roleLabel}>{item.kind === 'user' ? 'you' : 'veriden'}</div>
      <div style={styles.turnText}>{item.text}</div>
    </div>
  );
}

function ChangeCard({
  change,
  status,
}: {
  change: StagedChange;
  status: 'pending' | 'applied' | 'rejected' | 'superseded';
}) {
  return (
    <div style={styles.card}>
      <div style={styles.cardHead}>
        <span style={styles.cardPath}>
          {change.kind === 'create' ? 'create' : 'edit'} {change.path}
        </span>
        <span style={styles.counts}>
          <span style={{ color: 'var(--vscode-gitDecoration-addedResourceForeground, #3fb950)' }}>+{change.additions}</span>{' '}
          <span style={{ color: 'var(--vscode-gitDecoration-deletedResourceForeground, #f85149)' }}>−{change.deletions}</span>
        </span>
      </div>
      <pre style={styles.diff}>
        {change.diff.split('\n').map((line, i) => (
          <div key={i} style={diffLineStyle(line)}>
            {line || ' '}
          </div>
        ))}
      </pre>
      {status === 'pending' ? (
        <div style={styles.cardActions}>
          <button style={styles.button} onClick={() => vscodeApi.postMessage({ type: 'approveChange', path: change.path })}>
            Approve
          </button>
          <button
            style={{ ...styles.button, ...styles.stop }}
            onClick={() => vscodeApi.postMessage({ type: 'rejectChange', path: change.path })}
          >
            Reject
          </button>
        </div>
      ) : (
        <div style={styles.resolved}>
          {status === 'applied' ? '✓ applied' : status === 'rejected' ? '✕ rejected' : '· superseded by a newer proposal'}
        </div>
      )}
    </div>
  );
}

function appendText(items: Item[], text: string): Item[] {
  const last = items[items.length - 1];
  if (last && last.kind === 'assistant') {
    return [...items.slice(0, -1), { ...last, text: last.text + text }];
  }
  return [...items, { kind: 'assistant', text }];
}

function supersedePending(items: Item[], path: string): Item[] {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item.kind === 'change' && item.change.path === path && item.status === 'pending') {
      const next = items.slice();
      next[i] = { ...item, status: 'superseded' };
      return next;
    }
  }
  return items;
}

function supersedeAllPending(items: Item[]): Item[] {
  return items.map((item) =>
    item.kind === 'change' && item.status === 'pending' ? { ...item, status: 'superseded' } : item,
  );
}

function resolveChange(items: Item[], path: string, status: 'applied' | 'rejected'): Item[] {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item.kind === 'change' && item.change.path === path && item.status === 'pending') {
      const next = items.slice();
      next[i] = { ...item, status };
      return next;
    }
  }
  return items;
}

function CheckpointsPanel({
  checkpoints,
  open,
  onToggle,
}: {
  checkpoints: Checkpoint[];
  open: boolean;
  onToggle: () => void;
}) {
  if (checkpoints.length === 0) return null;
  return (
    <div style={styles.checkpoints}>
      <button style={styles.checkpointsToggle} onClick={onToggle}>
        {open ? '▾' : '▸'} Checkpoints ({checkpoints.length})
      </button>
      {open && (
        <div style={styles.checkpointsList}>
          {checkpoints.map((cp) => (
            <div key={cp.id} style={styles.checkpointRow}>
              <div style={styles.checkpointInfo}>
                <div style={styles.checkpointLabel}>{truncate(cp.label, 48)}</div>
                <div style={styles.checkpointTime}>{formatRelative(cp.createdAt)}</div>
              </div>
              <button
                style={{ ...styles.button, ...styles.stop }}
                onClick={() => vscodeApi.postMessage({ type: 'rollbackCheckpoint', id: cp.id })}
              >
                Roll back
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function diffLineStyle(line: string): CSSProperties {
  if (line.startsWith('+') && !line.startsWith('+++')) {
    return { color: 'var(--vscode-gitDecoration-addedResourceForeground, #3fb950)' };
  }
  if (line.startsWith('-') && !line.startsWith('---')) {
    return { color: 'var(--vscode-gitDecoration-deletedResourceForeground, #f85149)' };
  }
  if (line.startsWith('@@')) {
    return { opacity: 0.6 };
  }
  return {};
}

const styles: Record<string, CSSProperties> = {
  root: {
    fontFamily: 'var(--vscode-font-family)',
    fontSize: 'var(--vscode-font-size)',
    color: 'var(--vscode-foreground)',
    height: '100vh',
    boxSizing: 'border-box',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flex: '0 0 auto' },
  title: { fontSize: 15, fontWeight: 600, margin: 0, letterSpacing: 0.2 },
  status: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, opacity: 0.8 },
  dot: { width: 8, height: 8, borderRadius: '50%', display: 'inline-block' },
  banner: {
    flex: '0 0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    fontSize: 12,
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid var(--vscode-panel-border, rgba(128,128,128,0.35))',
  },
  checkpoints: { flex: '0 0 auto' },
  checkpointsToggle: {
    background: 'none',
    border: 'none',
    color: 'var(--vscode-foreground)',
    opacity: 0.7,
    fontSize: 11,
    padding: 0,
    cursor: 'pointer',
    textAlign: 'left',
  },
  checkpointsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginTop: 6,
    maxHeight: 160,
    overflowY: 'auto',
  },
  checkpointRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    fontSize: 11,
    padding: '4px 6px',
    borderRadius: 4,
    border: '1px solid var(--vscode-panel-border, rgba(128,128,128,0.35))',
  },
  checkpointInfo: { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 },
  checkpointLabel: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  checkpointTime: { opacity: 0.6 },
  transcript: { flex: '1 1 auto', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 },
  empty: { margin: 0, opacity: 0.6, lineHeight: 1.5 },
  turn: { display: 'flex', flexDirection: 'column', gap: 3 },
  roleLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, opacity: 0.5 },
  turnText: { whiteSpace: 'pre-wrap', lineHeight: 1.5, wordBreak: 'break-word' },
  tool: {
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    fontSize: 11,
    opacity: 0.6,
  },
  working: { fontSize: 11, opacity: 0.5, fontStyle: 'italic' },
  card: {
    border: '1px solid var(--vscode-panel-border, rgba(128,128,128,0.35))',
    borderRadius: 6,
    overflow: 'hidden',
  },
  cardHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
    fontSize: 12,
    background: 'var(--vscode-editorWidget-background, rgba(128,128,128,0.08))',
  },
  cardPath: { fontFamily: 'var(--vscode-editor-font-family, monospace)' },
  counts: { fontSize: 11, fontVariantNumeric: 'tabular-nums' },
  diff: {
    margin: 0,
    padding: '6px 8px',
    maxHeight: 260,
    overflow: 'auto',
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    fontSize: 11,
    lineHeight: 1.45,
    whiteSpace: 'pre',
  },
  cardActions: { display: 'flex', gap: 6, padding: '6px 8px', justifyContent: 'flex-end' },
  resolved: { padding: '6px 8px', fontSize: 11, opacity: 0.7, textAlign: 'right' },
  composer: { flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 6 },
  textarea: {
    fontFamily: 'inherit',
    fontSize: 12,
    color: 'var(--vscode-input-foreground)',
    background: 'var(--vscode-input-background)',
    border: '1px solid var(--vscode-input-border, var(--vscode-panel-border, rgba(128,128,128,0.35)))',
    borderRadius: 4,
    padding: '6px 8px',
    resize: 'vertical',
  },
  button: {
    color: 'var(--vscode-button-foreground)',
    background: 'var(--vscode-button-background)',
    border: 'none',
    padding: '6px 12px',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
  },
  stop: {
    color: 'var(--vscode-button-secondaryForeground, var(--vscode-button-foreground))',
    background: 'var(--vscode-button-secondaryBackground, #6e7681)',
  },
};
