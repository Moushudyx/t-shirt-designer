import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'TShirtDesigner',
      formats: ['es', 'umd'],
      fileName: (format) => `index.${format === 'es' ? 'esm' : format}.js`,
      cssFileName: 'style'
    },
    rollupOptions: {
      external: ['three'],
      output: {
        globals: {
          three: 'THREE'
        }
      }
    }
  }
});
