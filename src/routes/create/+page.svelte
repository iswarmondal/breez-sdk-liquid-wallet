<script lang="ts">
	import { onMount } from 'svelte';
	import { getSavedMnemonic, saveMnemonic } from '$lib/services/walletService';
	import * as bip39 from 'bip39';
	import { goto } from '$app/navigation';

	let mnemonic: string | null = null;
	let loading = true;
	let copied = false;

	onMount(async () => {
		const existing = getSavedMnemonic();
		if (existing) {
			mnemonic = existing;
		} else {
			mnemonic = bip39.generateMnemonic();
			if (mnemonic) saveMnemonic(mnemonic);
		}
		loading = false;
	});

	function copyMnemonic() {
		if (mnemonic) {
			navigator.clipboard.writeText(mnemonic);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		}
	}
</script>

<div class="navbar bg-base-200 mb-8">
	<div class="navbar-center">
		<button class="btn btn-ghost text-xl" onclick={() => goto('/')}>Breez Self Custody Wallet</button>
	</div>
</div>

<div class="flex min-h-[60vh] items-center justify-center">
	{#if loading}
		<p>Loading...</p>
	{:else}
		<div style="max-width: 500px; margin: 2rem auto;">
			<p><strong>Your Recovery Phrase (Mnemonic):</strong></p>
			<textarea readonly rows="3" style="width: 100%; font-size: 1.1rem;">{mnemonic}</textarea>
			<p style="color: #b00; font-size: 0.95rem;">
				Copy and save this phrase securely. It is the ONLY way to recover your wallet.
			</p>
		</div>
	{/if}
</div>

<div class="flex min-h-[60vh] items-center justify-center">
	<div class="card bg-base-100 w-full max-w-lg shadow-xl">
		<div class="card-body items-center">
			<h2 class="card-title mb-2">Wallet</h2>
			<p>Your wallet is ready. (Dashboard coming soon...)</p>
		</div>
	</div>
</div>
