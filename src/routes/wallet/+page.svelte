<script lang="ts">
	import { onMount } from 'svelte';
	import { initWallet, getSavedMnemonic } from '$lib/services/walletService';
	import Transactions from '$lib/components/Transactions.svelte';
	import Send from '$lib/components/Send.svelte';
	import Receive from '$lib/components/Receive.svelte';
	import { goto } from '$app/navigation';

	let loading = true;
	let error: any = null;
	let tab: 'transactions' | 'send' | 'receive' = 'transactions';

	onMount(async () => {
		loading = true;
		error = null;
		try {
			const mnemonic = getSavedMnemonic();
			if (!mnemonic) {
				throw new Error('No mnemonic found in local storage. Please create or import a wallet.');
			}
			await initWallet(mnemonic);
		} catch (err) {
			error = err instanceof Error ? err.stack || err.message : JSON.stringify(err);
		} finally {
			loading = false;
		}
	});
</script>

<div class="navbar bg-base-200 mb-8">
	<div class="navbar-center">
		<button class="btn btn-ghost text-xl" onclick={() => goto('/')}
			>Breez Self Custody Wallet</button
		>
	</div>
</div>

<div class="flex min-h-[60vh] items-center justify-center">
	<div class="card bg-base-100 w-full max-w-lg shadow-xl">
		<div class="card-body w-full items-center">
			<div class="tabs tabs-boxed mb-6 flex w-full justify-center">
				<button
					class="tab tab-lg {tab === 'transactions' ? 'tab-active' : ''}"
					onclick={() => (tab = 'transactions')}>Transactions</button
				>
				<button
					class="tab tab-lg {tab === 'send' ? 'tab-active' : ''}"
					onclick={() => (tab = 'send')}>Send</button
				>
				<button
					class="tab tab-lg {tab === 'receive' ? 'tab-active' : ''}"
					onclick={() => (tab = 'receive')}>Receive</button
				>
			</div>
			{#if loading}
				<span class="loading loading-spinner loading-lg mx-auto"></span>
				<p>Loading...</p>
			{:else if error}
				<div class="alert alert-error w-full whitespace-pre-wrap">
					<span>{error}</span>
				</div>
			{:else if tab === 'transactions'}
				<Transactions />
			{:else if tab === 'send'}
				<Send />
			{:else if tab === 'receive'}
				<Receive />
			{/if}
		</div>
	</div>
</div>
