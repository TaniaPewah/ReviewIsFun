import { build } from 'esbuild';
import { mkdir, cp } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await build({ entryPoints: ['src/extension.ts'], outfile: 'dist/extension.cjs', bundle: true, platform: 'node', target: 'node20', format: 'cjs', external: ['vscode', '@openai/codex-sdk'], sourcemap: true });
await build({ entryPoints: ['src/webview/main.tsx'], outfile: 'dist/webview.js', bundle: true, platform: 'browser', target: 'es2022', format: 'iife', minify: true });
await cp('media', 'dist/media', { recursive: true });
