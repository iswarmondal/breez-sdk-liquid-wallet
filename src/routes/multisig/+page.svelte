<script lang="ts">
	import MultisigSetup from '$lib/components/MultisigSetup.svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { isMultisigWallet } from '$lib/services/walletService';

	let showSetup = true;

	onMount(() => {
		// Check if multisig is already configured
		if (isMultisigWallet()) {
			console.log('Multisig wallet already configured');
		}
	});

	function goToWallet() {
		goto('/wallet');
	}
</script>

<svelte:head>
	<title>Multisig Setup - Breez Wallet</title>
</svelte:head>

<main class="min-h-screen p-5">
	<div class="bg-base-200 mx-auto max-w-3xl overflow-hidden rounded-xl shadow-xl">
		{#if showSetup}
			<MultisigSetup />

			<div class="p-5 text-center">
				<button on:click={goToWallet} class="btn btn-outline btn-sm"> ← Back to Wallet </button>
			</div>
		{/if}
	</div>
</main>
