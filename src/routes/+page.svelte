<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let hasWallet = false;

	onMount(() => {
		const mnemonic = localStorage.getItem('walletMnemonic');
		hasWallet = !!mnemonic;
	});

	function goToCreate() {
		goto('/create');
	}
	function goToImport() {
		goto('/import');
	}
	function goToWallet() {
		goto('/wallet');
	}
</script>

<div class="flex min-h-[60vh] items-center justify-center">
	<div class="card bg-base-100 w-full max-w-lg shadow-xl">
		<div class="card-body items-center">
			<h2 class="card-title mb-2">Self Custody Bitcoin Lightning Wallet</h2>
			<div
				style="display: flex; flex-direction: column; gap: 1rem; max-width: 300px; margin: 2rem auto;"
			>
				{#if hasWallet}
					<button onclick={goToWallet} class="btn btn-primary btn-lg">Open Wallet</button>
				{:else}
					<button onclick={goToCreate} class="btn btn-primary btn-lg">Create Wallet</button>
					<button onclick={goToImport} class="btn btn-secondary btn-lg">Import Wallet</button>
				{/if}
			</div>
		</div>
		<div class="card-body items-center text-yellow-400">
			<p>
				The web app will store your wallet locally in browser local storage. So please use a dummy
				wallet as local storage is not encrypted.
			</p>
			<br />
			<p>Currently running on testnet</p>
		</div>
	</div>
</div>
