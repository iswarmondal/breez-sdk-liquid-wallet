<script lang="ts">
	import { onMount } from 'svelte';
	import {
		fetchLightningLimits,
		prepareReceivePayment,
		receivePayment
	} from '$lib/services/walletService';
	let amount = '';
	let description = '';
	let invoice = '';
	let feeSats: number | null = null;
	let error: string | null = null;
	let loading = false;
	let limits = { min: 1, max: 21000000 * 100_000_000 };
	let copied = false;

	onMount(async () => {
		try {
			const res = await fetchLightningLimits();
			limits = { min: res.receive.minSat, max: res.receive.maxSat };
		} catch (err) {
			error = 'Failed to fetch limits: ' + (err instanceof Error ? err.message : String(err));
		}
	});

	async function generateInvoice() {
		const amountSats = parseInt(amount);
		if (isNaN(amountSats) || amountSats < limits.min || amountSats > limits.max) {
			error = `Amount must be between ${limits.min} and ${limits.max} sats`;
			return;
		}
		error = null;
		loading = true;
		invoice = '';
		feeSats = null;
		try {
			const prepareResponse = await prepareReceivePayment({
				paymentMethod: 'lightning',
				amount: {
					type: 'bitcoin',
					payerAmountSat: amountSats
				}
			});
			const receiveResponse = await receivePayment({
				prepareResponse,
				description
			});
			invoice = receiveResponse.destination;
			feeSats = prepareResponse.feesSat || 0;
		} catch (err) {
			error = 'Failed to generate invoice: ' + (err instanceof Error ? err.message : String(err));
		} finally {
			loading = false;
		}
	}

	function copyInvoice() {
		if (invoice) {
			navigator.clipboard.writeText(invoice);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		}
	}
</script>

<div class="flex min-h-[30vh] w-full flex-col items-center justify-center">
	<div class="card bg-base-100 w-full max-w-md shadow-xl">
		<div class="card-body">
			<h2 class="card-title mb-4">Receive Sats</h2>
			<label class="label">
				<span class="label-text">Amount (sats)</span>
			</label>
			<input
				class="input input-bordered mb-2 w-full"
				type="number"
				min={limits.min}
				max={limits.max}
				bind:value={amount}
				placeholder="Enter amount in sats"
			/>
			<label class="label">
				<span class="label-text">Description (optional)</span>
			</label>
			<input
				class="input input-bordered mb-4 w-full"
				type="text"
				bind:value={description}
				placeholder="Description"
			/>
			{#if error}
				<div class="alert alert-error mb-2">
					<span>{error}</span>
				</div>
			{/if}
			<button class="btn btn-primary mb-2 w-full" on:click={generateInvoice} disabled={loading}>
				{#if loading}
					<span class="loading loading-spinner loading-xs"></span> Generating...
				{:else}
					Generate Invoice
				{/if}
			</button>
			{#if invoice}
				<div
					class="mockup-code w-full cursor-pointer"
					on:click={copyInvoice}
					title="Click to copy invoice"
				>
					<pre data-prefix=">" class="truncate"><code>{invoice}</code></pre>
				</div>
				<div class="mt-2 text-xs text-gray-500">{copied ? 'Copied!' : 'Click invoice to copy'}</div>
				{#if feeSats !== null && feeSats > 0}
					<div class="mt-1 text-xs text-gray-500">Fee: {feeSats} sats</div>
				{/if}
			{/if}
		</div>
	</div>
</div>
