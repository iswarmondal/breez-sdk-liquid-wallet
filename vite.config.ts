import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
	plugins: [wasm(), nodePolyfills(), tailwindcss(), sveltekit()],
	optimizeDeps: {
		exclude: ['@breeztech/breez-sdk-liquid/web']
	}
});
