<script lang="ts">
	import { onMount } from 'svelte';
	import { getWalletInfo, getTransactions } from '$lib/services/walletService';
	import type * as breezSdk from '@breeztech/breez-sdk-liquid/web';

	let walletInfo: breezSdk.GetInfoResponse | null = null;
	let transactions: breezSdk.Payment[] = [];
	let loading = true;
	let error: any = null;

	onMount(async () => {
		await loadWalletData();
	});

	async function loadWalletData() {
		loading = true;
		error = null;
		try {
			const [info, txs] = await Promise.all([getWalletInfo(), getTransactions()]);
			walletInfo = info;
			transactions = txs.slice(0, 10); // Show last 10 transactions
		} catch (err) {
			error = err instanceof Error ? err.stack || err.message : JSON.stringify(err);
		} finally {
			loading = false;
		}
	}

	function formatAmount(payment: breezSdk.Payment): string {
		// Use amountSat if available, fallback to any amount property
		const amount =
			((payment as any).amountSat ?? (payment as any).amountMsat)
				? (payment as any).amountMsat / 1000
				: 0;
		return Math.abs(amount).toLocaleString();
	}

	function getPaymentIcon(payment: breezSdk.Payment): string {
		const paymentType = (payment as any).type || 'unknown';
		const destination = (payment as any).destination || '';

		switch (paymentType) {
			case 'Send':
				if (
					destination.includes('bitcoin:') ||
					destination.includes('bc1') ||
					destination.includes('3') ||
					destination.includes('1')
				) {
					return '🔗'; // Bitcoin address
				}
				return '⚡'; // Lightning
			case 'Receive':
				return '📥';
			default:
				return '💰';
		}
	}

	function getPaymentTypeDisplay(payment: breezSdk.Payment): string {
		const paymentType = (payment as any).type || 'unknown';
		const destination = (payment as any).destination || '';

		switch (paymentType) {
			case 'Send':
				// Try to determine if it's a submarine swap to Bitcoin
				if (
					destination.includes('bitcoin:') ||
					destination.includes('bc1') ||
					destination.includes('3') ||
					destination.includes('1')
				) {
					return 'Bitcoin Address (Submarine Swap)';
				}
				return 'Lightning Payment';
			case 'Receive':
				return 'Received Payment';
			default:
				return paymentType;
		}
	}

	function getPaymentDescription(payment: breezSdk.Payment): string {
		const description = (payment as any).description || '';
		const destination = (payment as any).destination || '';
		const paymentType = (payment as any).type || '';

		// Try to get description from payment details
		if (description) {
			return description;
		}

		// For sends, show destination info
		if (paymentType === 'Send' && destination) {
			if (destination.length > 30) {
				return `${destination.substring(0, 15)}...${destination.substring(destination.length - 15)}`;
			}
			return destination;
		}

		return 'No description';
	}

	function formatDate(timestamp: number): string {
		const date = new Date(timestamp * 1000);
		return (
			date.toLocaleDateString() +
			' ' +
			date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
		);
	}

	function getStatusColor(status: string): string {
		switch (status?.toLowerCase()) {
			case 'complete':
			case 'succeeded':
				return 'text-green-600';
			case 'pending':
				return 'text-yellow-600';
			case 'failed':
				return 'text-red-600';
			default:
				return 'text-gray-600';
		}
	}

	function isOutgoingPayment(payment: breezSdk.Payment): boolean {
		const paymentType = (payment as any).type || '';
		return paymentType === 'Send';
	}

	async function refreshData() {
		await loadWalletData();
	}

	$: totalBalance = walletInfo?.walletInfo?.balanceSat ?? 0;
	$: pendingBalance = walletInfo?.walletInfo?.pendingReceiveSat ?? 0;
	$: hasTransactions = transactions.length > 0;
</script>

{#if loading}
	<div class="flex flex-col items-center justify-center">
		<span class="loading loading-spinner loading-lg mx-auto"></span>
		<p class="mt-2">Loading wallet data...</p>
	</div>
{:else if error}
	<div class="w-full">
		<div class="alert alert-error mb-4 w-full whitespace-pre-wrap">
			<span>{error}</span>
		</div>
		<button class="btn btn-outline btn-sm" on:click={refreshData}> Try Again </button>
	</div>
{:else}
	<div class="flex w-full flex-col items-center">
		<!-- Balance Display -->
		<div class="mb-6 text-center">
			<div class="mb-2 text-4xl font-bold">{totalBalance.toLocaleString()} sats</div>
			<div class="text-sm text-gray-500">Available Balance</div>
			{#if pendingBalance > 0}
				<div class="mt-1 text-sm text-yellow-600">
					+{pendingBalance.toLocaleString()} sats pending
				</div>
			{/if}
		</div>

		<!-- Liquid Network Info -->
		<div class="alert alert-info mb-4 w-full">
			<div class="text-sm">
				<strong>💧 Liquid Network Integration</strong><br />
				Your funds are stored on the Liquid Network as L-BTC and can be sent/received via Lightning Network
				through automatic submarine swaps.
			</div>
		</div>

		<!-- Refresh Button -->
		<button class="btn btn-outline btn-sm mb-4" on:click={refreshData}> 🔄 Refresh </button>
		<a href="/multisig" class="btn btn-outline btn-sm mb-4"> 🤝 Multisig Setup </a>
		<!-- Transaction History -->
		<div class="w-full">
			<h3 class="mb-4 flex items-center text-lg font-semibold">
				📋 Recent Transactions
				{#if hasTransactions}
					<span class="badge badge-neutral ml-2">{transactions.length}</span>
				{/if}
			</h3>

			{#if hasTransactions}
				<div class="space-y-3">
					{#each transactions as tx}
						<div class="card bg-base-200 shadow-sm">
							<div class="card-body p-4">
								<div class="flex items-start justify-between">
									<div class="flex items-center space-x-3">
										<div class="text-2xl">{getPaymentIcon(tx)}</div>
										<div class="flex-1">
											<div class="font-semibold">
												{getPaymentTypeDisplay(tx)}
											</div>
											<div class="mt-1 text-sm text-gray-500">
												{getPaymentDescription(tx)}
											</div>
											<div class="mt-1 text-xs text-gray-400">
												{formatDate((tx as any).timestamp || Date.now() / 1000)}
											</div>
										</div>
									</div>
									<div class="text-right">
										<div
											class="font-mono text-lg {isOutgoingPayment(tx)
												? 'text-red-600'
												: 'text-green-600'}"
										>
											{isOutgoingPayment(tx) ? '-' : '+'}
											{formatAmount(tx)}
										</div>
										{#if (tx as any).status}
											<div class="text-xs {getStatusColor((tx as any).status)} mt-1">
												{(tx as any).status}
											</div>
										{/if}
									</div>
								</div>

								<!-- Additional Details -->
								{#if (tx as any).feesMsat && (tx as any).feesMsat > 0}
									<div class="mt-2 text-xs text-gray-500">
										Fee: {((tx as any).feesMsat / 1000).toLocaleString()} sats
									</div>
								{:else if (tx as any).feesSat && (tx as any).feesSat > 0}
									<div class="mt-2 text-xs text-gray-500">
										Fee: {(tx as any).feesSat.toLocaleString()} sats
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>

				<!-- Load More Button -->
				<div class="mt-4 text-center">
					<button class="btn btn-outline btn-sm" on:click={refreshData}>
						Load More Transactions
					</button>
				</div>
			{:else}
				<div class="py-8 text-center">
					<div class="mb-4 text-6xl">💰</div>
					<h4 class="mb-2 text-lg font-semibold">No Transactions Yet</h4>
					<p class="text-gray-500">
						Start by receiving your first payment or sending sats to someone!
					</p>
				</div>
			{/if}
		</div>
	</div>
{/if}
