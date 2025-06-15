import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
	plugins: [wasm(), topLevelAwait(), nodePolyfills(), tailwindcss(), sveltekit()],
	build: {
		target: 'esnext',
		outDir: 'dist',
		assetsDir: 'assets',
		sourcemap: true
	},
	optimizeDeps: {
		exclude: ['@breeztech/breez-sdk-liquid/web']
	}
});
