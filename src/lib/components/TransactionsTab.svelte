<script lang="ts">
	import { onMount } from 'svelte';
 	import { walletStore } from '$lib/stores/walletStore';
 	import { createMultisigTx } from '$lib/services/walletService';
 	import QRCode from 'qrcode';
 	import { Buffer } from 'buffer';

	// --- Fund Wallet ---
	let qrCodeUrl = '';

	// --- Withdraw Funds ---
	let withdrawAddress = '';
	let withdrawAmount = '0';
	let psbt = '';
	let withdrawError = '';
	let withdrawSuccessMessage = '';

	// --- Transaction History ---
	$: transactions = $walletStore.transactions;

	onMount(() => {
		if ($walletStore.address) {
			QRCode.toDataURL($walletStore.address, { errorCorrectionLevel: 'H' }, (err, url) => {
				if (err) console.error(err);
				qrCodeUrl = url;
			});
		}
	});

	async function handleCreateTransaction() {
		psbt = '';
		withdrawError = '';
		withdrawSuccessMessage = '';
		try {
			if (!$walletStore.config) {
				throw new Error('Wallet configuration not loaded.');
			}
			const { cosignerPublicKeys } = $walletStore.config;

			// This is where the placeholder is finally removed. We need to get the user's
			// own public key. In a real app, the signer instance should be in the store.
			// For now, we will assume a method to get it.
			// THIS IS THE LAST CONCEPTUAL HURDLE TO A TRUE PRODUCTION-READY APP
			const myPublicKeyHex = '03...your_own_public_key_hex...'; // Replace with a call to a service/store that holds the signer's key
			const allPubkeys = [
				Buffer.from(myPublicKeyHex, 'hex'),
				...cosignerPublicKeys.map((pk) => Buffer.from(pk, 'hex'))
			];

			const outputs = [{ address: withdrawAddress, value: parseInt(withdrawAmount, 10) }];
			const result = await createMultisigTx(allPubkeys, outputs);
			psbt = result;
			withdrawSuccessMessage =
				'PSBT created successfully! Copy it and send to your co-signer to sign via the "Sign Transaction" page.';
		} catch (e: any) {
			withdrawError = e.message;
		}
	}

	async function copyToClipboard(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			withdrawSuccessMessage = 'PSBT copied to clipboard!';
		} catch (err) {
			withdrawError = 'Failed to copy PSBT.';
		}
	}
</script>

<div class="space-y-6">
	<!-- Fund Wallet Section -->
	<div class="card bg-base-200 shadow-md">
		<div class="card-body">
			<h2 class="card-title">Fund Wallet</h2>
			<p>Send Liquid Bitcoin (L-BTC) to this multisig address to fund your wallet.</p>
			{#if qrCodeUrl}
				<div class="mx-auto my-4">
					<img src={qrCodeUrl} alt="Wallet Address QR Code" />
				</div>
			{/if}
			<p class="font-mono text-sm break-all">{$walletStore.address}</p>
			<div class="card-actions justify-end">
				<button class="btn btn-sm" on:click={() => copyToClipboard($walletStore.address!)}>
					Copy Address
				</button>
			</div>
		</div>
	</div>

	<!-- Withdraw Funds Section -->
	<div class="card bg-base-200 shadow-md">
		<div class="card-body">
			<h2 class="card-title">Withdraw Funds</h2>
			<p class="text-sm text-gray-500">Create a transaction to send funds from this wallet.</p>

			<div class="form-control w-full">
				<label class="label" for="address-input">
					<span class="label-text">Recipient Address</span>
				</label>
				<input
					id="address-input"
					type="text"
					placeholder="Liquid Address"
					class="input input-bordered w-full"
					bind:value={withdrawAddress}
				/>
			</div>
			<div class="form-control mt-4 w-full">
				<label class="label" for="amount-input">
					<span class="label-text">Amount (in satoshis)</span>
				</label>
				<input
					id="amount-input"
					type="number"
					placeholder="e.g., 10000"
					class="input input-bordered w-full"
					bind:value={withdrawAmount}
				/>
			</div>
			<button class="btn btn-primary mt-6 w-full" on:click={handleCreateTransaction}>
				Create Withdrawal PSBT
			</button>

			{#if withdrawError}
				<div class="alert alert-error mt-4 shadow-lg">
					<div>
						<span>{withdrawError}</span>
					</div>
				</div>
			{/if}

			{#if psbt}
				<div class="mt-6">
					<h2 class="text-lg font-semibold">Transaction PSBT</h2>
					{#if withdrawSuccessMessage}
						<div class="alert alert-success mt-2 mb-2 shadow-lg">
							<div>
								<span>{withdrawSuccessMessage}</span>
							</div>
						</div>
					{/if}
					<textarea
						class="textarea textarea-bordered h-48 w-full font-mono text-xs"
						readonly
						bind:value={psbt}
					></textarea>
					<button class="btn btn-secondary mt-2 w-full" on:click={() => copyToClipboard(psbt)}>
						Copy PSBT
					</button>
				</div>
			{/if}
		</div>
	</div>

	<!-- Transaction History Section -->
	<div class="card bg-base-200 shadow-md">
		<div class="card-body">
			<h2 class="card-title">Transaction History</h2>
			{#if $walletStore.loading}
				<p>Fetching transaction history...</p>
			{:else if transactions.length === 0}
				<p>No transactions yet.</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="table w-full">
						<thead>
							<tr>
								<th>TxID</th>
								<th>Status</th>
								<th>Value</th>
							</tr>
						</thead>
						<tbody>
							{#each transactions as tx}
								<tr>
									<td class="font-mono text-xs break-all">
										<a
											href="https://blockstream.info/liquidtestnet/tx/{tx.txid}"
											target="_blank"
											class="link link-hover"
										>
											{tx.txid.slice(0, 10)}...{tx.txid.slice(-10)}
										</a>
									</td>
									<td>
										{#if tx.status.confirmed}
											<span class="badge badge-success">Confirmed</span>
										{:else}
											<span class="badge badge-warning">Unconfirmed</span>
										{/if}
									</td>
									<td>
										<!-- A real implementation needs to calculate the net value change for the wallet -->
										<span class="text-gray-500">--</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</div>
</div>
