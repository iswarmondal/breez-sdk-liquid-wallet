<script lang="ts">
	import { onMount } from 'svelte';
	import { storageService, type MultisigWalletConfig } from '$lib/services/storageService';
	import { goto } from '$app/navigation';

	let wallets: MultisigWalletConfig[] = [];

	onMount(() => {
		wallets = storageService.getWallets();
	});

	function viewWallet(id: string) {
		goto(`/wallets/${id}`);
	}
</script>

<div class="navbar bg-base-200 mb-8">
	<div class="navbar-start">
		<button class="btn btn-ghost" on:click={() => goto('/')}>← Home</button>
	</div>
	<div class="navbar-center">
		<h1 class="text-xl font-bold">My Multisig Wallets</h1>
	</div>
	<div class="navbar-end" />
</div>

<div class="mx-auto max-w-2xl p-4">
	{#if wallets.length === 0}
		<div class="text-center">
			<p>You haven't set up any multisig wallets yet.</p>
			<button class="btn btn-primary mt-4" on:click={() => goto('/multisig')}>
				Create a New Wallet
			</button>
		</div>
	{:else}
		<div class="space-y-4">
			{#each wallets as wallet}
				<div class="card bg-base-200 shadow-md transition-transform hover:scale-105">
					<div class="card-body">
						<h2 class="card-title">{wallet.label}</h2>
						<p>
							<strong>Type:</strong>
							{wallet.threshold}-of-{wallet.cosignerPublicKeys.length + 1}
						</p>
						<p><strong>Created:</strong> {new Date(wallet.creationDate).toLocaleString()}</p>
						<div class="card-actions justify-end">
							<button class="btn btn-secondary" on:click={() => viewWallet(wallet.id)}>
								View Details
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
