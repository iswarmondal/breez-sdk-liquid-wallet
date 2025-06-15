<script lang="ts">
	import { onMount } from 'svelte';
	import { initWasm } from '$lib/services/wasmLoader';
	import '../app.css';
	let { children } = $props();

	onMount(async () => {
		await initWasm();
	});
</script>

{@render children()}
