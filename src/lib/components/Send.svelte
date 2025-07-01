<script lang="ts">
	import { onMount } from 'svelte';
	import {
		parseInput,
		prepareSendPayment,
		sendPayment,
		preparePayOnchain,
		payOnchain,
		fetchLightningLimits,
		fetchOnchainLimits
	} from '$lib/services/walletService';
	import type * as breezSdk from '@breeztech/breez-sdk-liquid/web';

	let destination = '';
	let amount = '';
	let loading = false;
	let error: string | null = null;
	let success: string | null = null;
	let parsedInput: breezSdk.InputType | null = null;
	let sendPreview: breezSdk.PrepareSendResponse | breezSdk.PreparePayOnchainResponse | null = null;
	let lightningLimits = { min: 1, max: 21000000 * 100_000_000 };
	let onchainLimits = { min: 1, max: 21000000 * 100_000_000 };

	onMount(async () => {
		try {
			const [lightningRes, onchainRes] = await Promise.all([
				fetchLightningLimits(),
				fetchOnchainLimits()
			]);
			lightningLimits = { min: lightningRes.send.minSat, max: lightningRes.send.maxSat };
			onchainLimits = { min: onchainRes.send.minSat, max: onchainRes.send.maxSat };
		} catch (err) {
			error = 'Failed to fetch limits: ' + (err instanceof Error ? err.message : String(err));
		}
	});

	async function analyzeDestination() {
		if (!destination.trim()) {
			error = 'Please enter a destination';
			return;
		}

		error = null;
		success = null;
		parsedInput = null;
		sendPreview = null;
		loading = true;

		try {
			// Parse the input to determine what type it is
			parsedInput = await parseInput(destination.trim());
			console.log('Parsed input:', parsedInput);
		} catch (err) {
			error = 'Invalid destination: ' + (err instanceof Error ? err.message : String(err));
		} finally {
			loading = false;
		}
	}

	async function prepareSend() {
		if (!parsedInput) {
			error = 'Please analyze the destination first';
			return;
		}

		const amountSats = parseInt(amount);
		if (isNaN(amountSats) || amountSats <= 0) {
			error = 'Please enter a valid amount';
			return;
		}

		// Check limits based on payment type
		const isLightning = parsedInput.type === 'bolt11' || parsedInput.type === 'lnUrlPay';
		const limits = isLightning ? lightningLimits : onchainLimits;

		if (amountSats < limits.min || amountSats > limits.max) {
			error = `Amount must be between ${limits.min} and ${limits.max} sats for ${isLightning ? 'Lightning' : 'on-chain'} payments`;
			return;
		}

		error = null;
		loading = true;

		try {
			// Determine if this is a Bitcoin address that needs onchain payment
			if (parsedInput.type === 'bitcoinAddress') {
				// Use onchain payment for Bitcoin addresses
				sendPreview = await preparePayOnchain({
					amount: {
						type: 'bitcoin',
						receiverAmountSat: amountSats
					}
				});
			} else {
				// Use regular payment for Lightning and other types
				sendPreview = await prepareSendPayment({
					destination: destination.trim(),
					amount: {
						type: 'bitcoin',
						receiverAmountSat: amountSats
					}
				});
			}
			console.log('Send preview:', sendPreview);
		} catch (err) {
			error = 'Failed to prepare payment: ' + (err instanceof Error ? err.message : String(err));
		} finally {
			loading = false;
		}
	}

	async function executeSend() {
		if (!sendPreview || !parsedInput) {
			error = 'Please prepare the payment first';
			return;
		}

		error = null;
		loading = true;

		try {
			let result;
			if (parsedInput.type === 'bitcoinAddress') {
				// Use onchain payment for Bitcoin addresses
				const bitcoinAddressData = (parsedInput as any).address;
				const address = bitcoinAddressData?.address || destination.trim();
				result = await payOnchain({
					address: address,
					prepareResponse: sendPreview as breezSdk.PreparePayOnchainResponse
				});
			} else {
				// Use regular payment for Lightning and other types
				result = await sendPayment({
					prepareResponse: sendPreview as breezSdk.PrepareSendResponse
				});
			}

			success = `Payment sent successfully! Payment ID: ${(result.payment as any).id || 'N/A'}`;
			// Reset form
			destination = '';
			amount = '';
			parsedInput = null;
			sendPreview = null;
		} catch (err) {
			error = 'Failed to send payment: ' + (err instanceof Error ? err.message : String(err));
		} finally {
			loading = false;
		}
	}

	function getInputTypeDisplay(type: string): string {
		switch (type) {
			case 'bolt11':
				return '⚡ Lightning Invoice';
			case 'bolt12Offer':
				return '⚡ BOLT12 Offer';
			case 'bitcoinAddress':
				return '🔗 Bitcoin Address';
			case 'liquidAddress':
				return '💧 Liquid Address';
			case 'lnUrlPay':
				return '⚡ Lightning Address';
			case 'lnUrlWithdraw':
				return '⚡ LNURL Withdraw';
			case 'nodeId':
				return '⚡ Node ID';
			case 'url':
				return '🌐 URL';
			default:
				return `📄 ${type}`;
		}
	}

	function getPaymentMethodInfo(type: string): string {
		switch (type) {
			case 'bolt11':
			case 'bolt12Offer':
			case 'lnUrlPay':
			case 'nodeId':
				return 'This will be sent via the Lightning Network with instant settlement.';
			case 'bitcoinAddress':
				return 'This will be sent to a Bitcoin address via submarine swap (L-BTC → Bitcoin).';
			case 'liquidAddress':
				return 'This will be sent directly on the Liquid Network.';
			default:
				return 'Payment method will be determined automatically.';
		}
	}

	function getEstimatedFees(): number {
		if (!sendPreview) return 0;
		return (sendPreview as any).feesSat || 0;
	}

	$: canPrepare = destination.trim() && amount && parsedInput && !loading;
	$: canSend = sendPreview && !loading;
</script>

<div class="flex min-h-[30vh] w-full flex-col items-center justify-center">
	<div class="card bg-base-100 w-full max-w-md shadow-xl">
		<div class="card-body">
			<h2 class="card-title mb-4">Send Payment</h2>

			<!-- Destination Input -->
			<label class="label">
				<span class="label-text">Destination</span>
			</label>
			<textarea
				class="textarea textarea-bordered mb-2 w-full"
				rows="3"
				bind:value={destination}
				placeholder="Enter Lightning invoice, Bitcoin address, Lightning address, or LNURL"
			></textarea>
			<button
				class="btn btn-outline btn-sm mb-4"
				on:click={analyzeDestination}
				disabled={loading || !destination.trim()}
			>
				{#if loading}
					<span class="loading loading-spinner loading-xs"></span>
				{/if}
				Analyze Destination
			</button>

			<!-- Parsed Input Display -->
			{#if parsedInput}
				<div class="alert alert-success mb-4">
					<div>
						<div class="font-semibold">{getInputTypeDisplay(parsedInput.type)}</div>
						<div class="text-sm">{getPaymentMethodInfo(parsedInput.type)}</div>
					</div>
				</div>
			{/if}

			<!-- Amount Input -->
			{#if parsedInput}
				<label class="label">
					<span class="label-text">Amount (sats)</span>
				</label>
				<input
					class="input input-bordered mb-4 w-full"
					type="number"
					min="1"
					bind:value={amount}
					placeholder="Enter amount in sats"
				/>

				<button class="btn btn-primary mb-4 w-full" on:click={prepareSend} disabled={!canPrepare}>
					{#if loading}
						<span class="loading loading-spinner loading-xs"></span>
						Preparing...
					{:else}
						Prepare Payment
					{/if}
				</button>
			{/if}

			<!-- Send Preview -->
			{#if sendPreview}
				<div class="alert alert-info mb-4">
					<div>
						<div class="font-semibold">Payment Preview</div>
						<div class="text-sm">
							Amount: {parseInt(amount).toLocaleString()} sats
						</div>
						{#if getEstimatedFees() > 0}
							<div class="text-sm">
								Fees: {getEstimatedFees().toLocaleString()} sats
							</div>
							<div class="text-sm font-semibold">
								Total: {(parseInt(amount) + getEstimatedFees()).toLocaleString()} sats
							</div>
						{/if}
					</div>
				</div>

				<button class="btn btn-success w-full" on:click={executeSend} disabled={!canSend}>
					{#if loading}
						<span class="loading loading-spinner loading-xs"></span>
						Sending...
					{:else}
						Confirm & Send Payment
					{/if}
				</button>
			{/if}

			<!-- Error Display -->
			{#if error}
				<div class="alert alert-error mt-4">
					<span>{error}</span>
				</div>
			{/if}

			<!-- Success Display -->
			{#if success}
				<div class="alert alert-success mt-4">
					<span>{success}</span>
				</div>
			{/if}

			<!-- Help Text -->
			<div class="mt-4 text-xs text-gray-500">
				<strong>Supported formats:</strong><br />
				• Lightning invoices (lnbc...)<br />
				• Bitcoin addresses<br />
				• Lightning addresses (user@domain.com)<br />
				• LNURL-Pay links<br />
				• BOLT12 offers
			</div>
		</div>
	</div>
</div>
