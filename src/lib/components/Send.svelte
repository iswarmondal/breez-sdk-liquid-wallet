<script lang="ts">
	import { walletStore } from '$lib/stores/walletStore';
	import { createMultisigTx } from '$lib/services/walletService';
	import { Buffer } from 'buffer';

	let recipientAddress = '';
	let amount = '';
	let psbt = '';
	let errorMessage = '';
	let successMessage = '';
	let isLoading = false;

	async function handleSend() {
		psbt = '';
		errorMessage = '';
		successMessage = '';
		isLoading = true;
		try {
			if (!$walletStore.config) {
				throw new Error('Wallet configuration not loaded.');
			}
			const { cosignerPublicKeys, threshold } = $walletStore.config;
			// TODO: Replace with actual method to get the user's own public key
			const myPublicKeyHex = '03...your_own_public_key_hex...';
			const allPubkeys = [
				Buffer.from(myPublicKeyHex, 'hex'),
				...cosignerPublicKeys.map((pk: string) => Buffer.from(pk, 'hex'))
			];
			const outputs = [{ address: recipientAddress, value: parseInt(amount, 10) }];
			const result = await createMultisigTx(allPubkeys, threshold || 2, outputs);
			psbt = result;
			successMessage = 'PSBT created successfully! Copy it and send to your co-signer to sign.';
		} catch (e: any) {
			errorMessage = e.message;
		} finally {
			isLoading = false;
		}
	}

	async function copyToClipboard(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			successMessage = 'PSBT copied to clipboard!';
		} catch (err) {
			errorMessage = 'Failed to copy PSBT.';
		}
	}
</script>

<div class="card bg-base-100 shadow-xl">
	<div class="card-body">
		<h2 class="card-title">Send Funds</h2>
		<div class="form-control w-full">
			<label class="label" for="recipient-input">
				<span class="label-text">Recipient Address</span>
			</label>
			<input
				id="recipient-input"
				type="text"
				placeholder="Liquid Address"
				class="input input-bordered w-full"
				bind:value={recipientAddress}
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
				bind:value={amount}
			/>
		</div>
		<button class="btn btn-primary mt-6 w-full" on:click={handleSend} disabled={isLoading}>
			{#if isLoading}
				<span class="loading loading-spinner loading-xs"></span>
			{/if}
			Create PSBT
		</button>
		{#if errorMessage}
			<div class="alert alert-error mt-4">
				<span>{errorMessage}</span>
			</div>
		{/if}
		{#if psbt}
			<div class="mt-6">
				<h3 class="text-lg font-semibold">Transaction PSBT</h3>
				{#if successMessage}
					<div class="alert alert-success mt-2 mb-2">
						<span>{successMessage}</span>
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
