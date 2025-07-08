<script lang="ts">
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import { storageService, type MultisigWalletConfig } from '$lib/services/storageService';
	import { goto } from '$app/navigation';
	import { walletStore, type WalletState } from '$lib/stores/walletStore';
	import WalletInfoTab from '$lib/components/WalletInfoTab.svelte';
	import TransactionsTab from '$lib/components/TransactionsTab.svelte';
	import CreateEscrow from '$lib/components/CreateEscrow.svelte';
	import SignTransaction from '$lib/components/SignTransaction.svelte';

	let walletConfig: MultisigWalletConfig | undefined;
	let activeTab: 'info' | 'transactions' | 'escrow' = 'info';

	onMount(async () => {
		const walletId = $page.params.id;
		walletConfig = storageService.getWalletById(walletId);

		if (walletConfig) {
			walletStore.initialize(walletConfig);
		} else {
			walletStore.update((ws: WalletState) => ({
				...ws,
				error: 'Wallet configuration not found.'
			}));
		}
	});

	onDestroy(() => {
		walletStore.reset();
	});

	function deleteWallet() {
		if (!walletConfig) return;
		if (confirm(`Are you sure you want to delete the wallet "${walletConfig.label}"?`)) {
			storageService.removeWallet(walletConfig.id);
			goto('/wallets');
		}
	}
</script>

<div class="navbar bg-base-200 mb-8">
	<div class="navbar-start">
		<button class="btn btn-ghost" on:click={() => goto('/wallets')}>← My Wallets</button>
	</div>
	<div class="navbar-center">
		<h1 class="text-xl font-bold">{walletConfig ? walletConfig.label : 'Wallet Details'}</h1>
	</div>
	<div class="navbar-end">
		<div class="dropdown dropdown-end">
			<button class="btn btn-ghost btn-circle" aria-label="Open menu">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 6h16M4 12h16M4 18h7"
					/>
				</svg>
			</button>
			<ul
				class="menu menu-compact dropdown-content bg-base-100 rounded-box mt-3 w-52 p-2 shadow"
			>
				<li><button on:click={deleteWallet} class="text-error">Delete Wallet</button></li>
			</ul>
		</div>
	</div>
</div>

<div class="mx-auto max-w-4xl p-4">
	{#if $walletStore.loading && !$walletStore.initialized}
		<div class="flex flex-col items-center justify-center gap-4">
			<span class="loading loading-spinner loading-lg"></span>
			<p>Initializing wallet...</p>
		</div>
	{:else if $walletStore.error}
		<div class="alert alert-error whitespace-pre-wrap">
			<span>{$walletStore.error}</span>
		</div>
	{:else if walletConfig}
		<div class="tabs tabs-boxed mb-6 flex justify-center">
			<button
				class="tab tab-lg {activeTab === 'info' ? 'tab-active' : ''}"
				on:click={() => (activeTab = 'info')}>Wallet Info</button
			>
			<button
				class="tab tab-lg {activeTab === 'transactions' ? 'tab-active' : ''}"
				on:click={() => (activeTab = 'transactions')}>Transactions</button
			>
			<button
				class="tab tab-lg {activeTab === 'escrow' ? 'tab-active' : ''}"
				on:click={() => (activeTab = 'escrow')}>Escrow</button
			>
		</div>

		{#if activeTab === 'info'}
			<WalletInfoTab />
		{:else if activeTab === 'transactions'}
			<TransactionsTab />
		{:else if activeTab === 'escrow'}
			<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<CreateEscrow />
				<SignTransaction />
			</div>
		{/if}
	{/if}
</div>
