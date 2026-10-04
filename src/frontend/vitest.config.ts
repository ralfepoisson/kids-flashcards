import { defineConfig } from 'vitest/config';

// Keep browser unit tests reliable on the local Node 26 runtime.
export default defineConfig({ test: { maxWorkers: 1, pool: 'threads' } });
