import * as esbuild from 'esbuild';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const common = {
  bundle: true,
  minify: production,
  sourcemap: !production,
  logLevel: 'info',
};

// Extension host: runs in Node inside VS Code; `vscode` is provided at runtime.
const extension = await esbuild.context({
  ...common,
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  platform: 'node',
  format: 'cjs',
  external: ['vscode'],
});

// Webview: runs in the browser sandbox; React is bundled in.
const webview = await esbuild.context({
  ...common,
  entryPoints: ['webview/index.tsx'],
  outfile: 'dist/webview.js',
  platform: 'browser',
  format: 'iife',
  jsx: 'automatic',
});

if (watch) {
  await Promise.all([extension.watch(), webview.watch()]);
  console.log('[watch] building…');
} else {
  await Promise.all([extension.rebuild(), webview.rebuild()]);
  await Promise.all([extension.dispose(), webview.dispose()]);
}
