<script lang="ts">
	import { onMount } from 'svelte';
	import {
		fetchLightningLimits,
		fetchOnchainLimits,
		prepareReceivePayment,
		receivePayment
	} from '$lib/services/walletService';

	let amount = '';
	let description = '';
	let invoice = '';
	let bitcoinAddress = '';
	let feeSats: number | null = null;
	let error: string | null = null;
	let loading = false;
	let lightningLimits = { min: 1, max: 21000000 * 100_000_000 };
	let onchainLimits = { min: 1, max: 21000000 * 100_000_000 };
	let copied = false;
	let receiveMethod: 'lightning' | 'bitcoinAddress' = 'lightning';

	onMount(async () => {
		try {
			const [lightningRes, onchainRes] = await Promise.all([
				fetchLightningLimits(),
				fetchOnchainLimits()
			]);
			lightningLimits = { min: lightningRes.receive.minSat, max: lightningRes.receive.maxSat };
			onchainLimits = { min: onchainRes.receive.minSat, max: onchainRes.receive.maxSat };
		} catch (err) {
			error = 'Failed to fetch limits: ' + (err instanceof Error ? err.message : String(err));
		}
	});

	async function generateLightningInvoice() {
		const amountSats = parseInt(amount);
		if (isNaN(amountSats) || amountSats < lightningLimits.min || amountSats > lightningLimits.max) {
			error = `Amount must be between ${lightningLimits.min} and ${lightningLimits.max} sats for Lightning`;
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
			error =
				'Failed to generate Lightning invoice: ' +
				(err instanceof Error ? err.message : String(err));
		} finally {
			loading = false;
		}
	}

	async function generateBitcoinAddress() {
		const amountSats = parseInt(amount);
		if (isNaN(amountSats) || amountSats < onchainLimits.min || amountSats > onchainLimits.max) {
			error = `Amount must be between ${onchainLimits.min} and ${onchainLimits.max} sats for Bitcoin Address`;
			return;
		}

		error = null;
		loading = true;
		bitcoinAddress = '';
		feeSats = null;

		try {
			const prepareResponse = await prepareReceivePayment({
				paymentMethod: 'bitcoinAddress',
				amount: {
					type: 'bitcoin',
					payerAmountSat: amountSats
				}
			});
			const receiveResponse = await receivePayment({
				prepareResponse,
				description: description || ''
			});
			bitcoinAddress = receiveResponse.destination;
			feeSats = prepareResponse.feesSat || 0;
		} catch (err) {
			error =
				'Failed to generate Bitcoin address: ' + (err instanceof Error ? err.message : String(err));
		} finally {
			loading = false;
		}
	}

	async function generateReceiveOption() {
		if (receiveMethod === 'lightning') {
			await generateLightningInvoice();
		} else {
			await generateBitcoinAddress();
		}
	}

	function copyToClipboard(text: string) {
		if (text) {
			navigator.clipboard.writeText(text);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		}
	}

	$: currentLimits = receiveMethod === 'lightning' ? lightningLimits : onchainLimits;
	$: displayResult = receiveMethod === 'lightning' ? invoice : bitcoinAddress;
</script>

<div class="flex min-h-[30vh] w-full flex-col items-center justify-center">
	<div class="card bg-base-100 w-full max-w-md shadow-xl">
		<div class="card-body">
			<h2 class="card-title mb-4">Receive Payments</h2>

			<!-- Payment Method Selection -->
			<div class="tabs tabs-bordered mb-4">
				<button
					class="tab {receiveMethod === 'lightning' ? 'tab-active' : ''}"
					on:click={() => {
						receiveMethod = 'lightning';
						invoice = '';
						bitcoinAddress = '';
						error = null;
					}}
				>
					⚡ Lightning
				</button>
				<button
					class="tab {receiveMethod === 'bitcoinAddress' ? 'tab-active' : ''}"
					on:click={() => {
						receiveMethod = 'bitcoinAddress';
						invoice = '';
						bitcoinAddress = '';
						error = null;
					}}
				>
					🔗 Bitcoin Address
				</button>
			</div>

			<!-- Amount Input -->
			<label class="label">
				<span class="label-text">Amount (sats)</span>
			</label>
			<input
				class="input input-bordered mb-2 w-full"
				type="number"
				min={currentLimits.min}
				max={currentLimits.max}
				bind:value={amount}
				placeholder="Enter amount in sats"
			/>

			<!-- Description Input (for Lightning only) -->
			{#if receiveMethod === 'lightning'}
				<label class="label">
					<span class="label-text">Description (optional)</span>
				</label>
				<input
					class="input input-bordered mb-4 w-full"
					type="text"
					bind:value={description}
					placeholder="Payment description"
				/>
			{/if}

			<!-- Error Display -->
			{#if error}
				<div class="alert alert-error mb-2">
					<span>{error}</span>
				</div>
			{/if}

			<!-- Generate Button -->
			<button
				class="btn btn-primary mb-2 w-full"
				on:click={generateReceiveOption}
				disabled={loading}
			>
				{#if loading}
					<span class="loading loading-spinner loading-xs"></span>
					Generating...
				{:else if receiveMethod === 'lightning'}
					Generate Lightning Invoice
				{:else}
					Generate Bitcoin Address
				{/if}
			</button>

			<!-- Result Display -->
			{#if displayResult}
				<div class="mb-2">
					<label class="label">
						<span class="label-text font-semibold">
							{receiveMethod === 'lightning' ? 'Lightning Invoice:' : 'Bitcoin Address:'}
						</span>
					</label>
					<div
						class="mockup-code w-full cursor-pointer"
						on:click={() => copyToClipboard(displayResult)}
						title="Click to copy"
					>
						<pre data-prefix=">" class="break-all"><code>{displayResult}</code></pre>
					</div>
					<div class="mt-2 text-xs text-gray-500">
						{copied ? 'Copied!' : 'Click to copy'}
					</div>
					{#if feeSats !== null && feeSats > 0}
						<div class="mt-1 text-xs text-gray-500">Fee: {feeSats} sats</div>
					{/if}
				</div>

				<!-- Network Information -->
				<div class="alert alert-info mt-2">
					<div class="text-sm">
						{#if receiveMethod === 'lightning'}
							<strong>⚡ Lightning Network</strong><br />
							Instant payments with low fees. Sender pays via Lightning invoice.
						{:else}
							<strong>🔗 Bitcoin Address</strong><br />
							Bitcoin address that receives funds on Liquid Network via submarine swap.
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
