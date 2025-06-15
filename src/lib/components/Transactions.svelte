<script lang="ts">
	import { onMount } from 'svelte';
	import { getWalletInfo, getTransactions } from '$lib/services/walletService';
	let balance: number | null = null;
	let transactions: any[] = [];
	let loading = true;
	let error: any = null;

	onMount(async () => {
		loading = true;
		error = null;
		try {
			const info = await getWalletInfo();
			balance = info?.walletInfo?.balanceSat ?? 0;
			transactions = (await getTransactions()).slice(0, 5);
		} catch (err) {
			error = err instanceof Error ? err.stack || err.message : JSON.stringify(err);
		} finally {
			loading = false;
		}
	});

	function formatAmount(tx: any) {
		const amount = tx.amountMsat ? tx.amountMsat / 1000 : 0;
		return (amount > 0 ? '+' : '-') + Math.abs(amount).toLocaleString();
	}
</script>

{#if loading}
	<span class="loading loading-spinner loading-lg mx-auto"></span>
	<p>Loading...</p>
{:else if error}
	<div class="alert alert-error w-full whitespace-pre-wrap">
		<span>{error}</span>
	</div>
{:else}
	<div class="flex w-full flex-col items-center">
		<div class="mb-6 text-4xl font-bold">{balance} sats</div>
		<div class="w-full">
			<h3 class="mb-2 text-lg font-semibold">Recent Transactions</h3>
			<ul class="w-full">
				{#each transactions as tx}
					<li class="mb-2">
						<span class="font-mono text-lg {tx.amountMsat > 0 ? 'text-green-600' : 'text-red-600'}">
							{formatAmount(tx)}
						</span>
					</li>
				{/each}
			</ul>
		</div>
	</div>
{/if}
