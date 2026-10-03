import { defineConfig } from 'tsdown'

// Host-only build. 0.3.0 dropped the Client bundle: this plugin no longer
// ships a sidebar icon or a Web UI tab — it registers a custom agent
// preset (see cordis.patch.yml) and the only runtime artifact we ship is the
// host module that exposes ctx.craft (the CraftStore) and the two chat
// tools that ride on it.
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  dts: true,
  clean: true,
  sourcemap: false,
  outDir: 'lib',
  outExtensions: () => ({ js: '.mjs' }),
})