import { useEffect, useState, type CSSProperties } from 'react';
import { vscodeApi, type HostToWebview } from './vscode';

type Init = Extract<HostToWebview, { type: 'init' }>;

export function App() {
  const [init, setInit] = useState<Init | null>(null);
  const [pongAt, setPongAt] = useState<string | null>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent<HostToWebview>): void => {
      const message = event.data;
      if (message.type === 'init') {
        setInit(message);
      } else if (message.type === 'pong') {
        setPongAt(message.at);
      }
    };
    window.addEventListener('message', onMessage);
    // Announce we're mounted; the host replies with `init`.
    vscodeApi.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const connected = init !== null;

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
          {connected ? 'bridge connected' : 'connecting…'}
        </span>
      </header>

      <p style={styles.tagline}>
        The agent conversation and live change stream will live here — the primary surface.
        This is the M0 shell: the extension host ⇄ webview bridge is wired, and nothing more yet.
      </p>

      <div style={styles.card}>
        <Row label="Workspace" value={init?.workspace.name ?? '—'} />
        <Row label="Folders" value={init ? String(init.workspace.folderCount) : '—'} />
        <Row label="Extension" value={init ? `v${init.extensionVersion}` : '—'} />
      </div>

      <button style={styles.button} onClick={() => vscodeApi.postMessage({ type: 'ping' })}>
        Ping host
      </button>
      {pongAt && <div style={styles.pong}>pong · {pongAt}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.row}>
      <span style={styles.rowLabel}>{label}</span>
      <span style={styles.rowValue}>{value}</span>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  root: {
    fontFamily: 'var(--vscode-font-family)',
    fontSize: 'var(--vscode-font-size)',
    color: 'var(--vscode-foreground)',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: 600,
    margin: 0,
    letterSpacing: 0.2,
  },
  status: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    opacity: 0.8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    display: 'inline-block',
  },
  tagline: {
    margin: 0,
    lineHeight: 1.5,
    opacity: 0.85,
  },
  card: {
    border: '1px solid var(--vscode-panel-border, rgba(128,128,128,0.35))',
    borderRadius: 6,
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    fontSize: 12,
  },
  rowLabel: { opacity: 0.7 },
  rowValue: { fontVariantNumeric: 'tabular-nums' },
  button: {
    alignSelf: 'flex-start',
    color: 'var(--vscode-button-foreground)',
    background: 'var(--vscode-button-background)',
    border: 'none',
    padding: '6px 12px',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
  },
  pong: {
    fontSize: 11,
    opacity: 0.7,
    fontVariantNumeric: 'tabular-nums',
  },
};
