import { mkdirSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Windows 下 esbuild 在系统 TEMP 中的临时副本删除会报 Access is denied，导致 vite build 失败。
// 把 esbuild 的临时目录固定到项目内，规避该系统环境问题。
const esbuildTempDir = fileURLToPath(new URL('./node_modules/.cache/esbuild-temp', import.meta.url));
mkdirSync(esbuildTempDir, { recursive: true });
process.env.TEMP = esbuildTempDir;
process.env.TMP = esbuildTempDir;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5180,
    strictPort: true,
  },
  worker: {
    format: 'es',
  },
});
