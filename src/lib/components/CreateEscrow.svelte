<script lang="ts">
	import { walletStore } from '$lib/stores/walletStore';
 	import { createMultisigTx, getPsbtDetails } from '$lib/services/walletService';
	import { Buffer } from 'buffer';

	let recipientAddress = '';
	let amount = 0;
	let isLoading = false;
	let errorMessage = '';
	let psbt = '';
	let psbtDetails: any = null;

	async function handleCreateEscrow() {
		isLoading = true;
		errorMessage = '';
		psbt = '';
		psbtDetails = null;

		try {
			const config = $walletStore.config;
			if (!config) {
				throw new Error('Wallet configuration not found.');
			}

			const allPubkeys = config.allPublicKeys.map((pk) => Buffer.from(pk, 'hex'));

			const outputs = [{ address: recipientAddress, value: amount }];

			const createdPsbt = await createMultisigTx(allPubkeys, config.threshold, outputs);
			psbt = createdPsbt;
			psbtDetails = getPsbtDetails(psbt);
		} catch (e: any) {
			errorMessage = e.message;
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="card bg-base-100 shadow-xl">
	<div class="card-body">
		<h3 class="card-title">Create Escrow Transaction</h3>
		<div class="form-control w-full">
			<label for="recipient" class="label">
				<span class="label-text font-semibold">Recipient Address</span>
			</label>
			<input
				id="recipient"
				type="text"
				bind:value={recipientAddress}
				placeholder="Liquid address"
				class="input input-bordered w-full"
			/>
		</div>
		<div class="form-control w-full">
			<label for="amount" class="label">
				<span class="label-text font-semibold">Amount (sats)</span>
			</label>
			<input
				id="amount"
				type="number"
				bind:value={amount}
				placeholder="Amount in satoshis"
				class="input input-bordered w-full"
			/>
		</div>
		<div class="card-actions mt-4 justify-end">
			<button class="btn btn-primary" on:click={handleCreateEscrow} disabled={isLoading}>
				{#if isLoading}
					<span class="loading loading-spinner loading-xs"></span>
				{/if}
				Create PSBT
			</button>
		</div>

		{#if errorMessage}
			<div class="alert alert-error mt-4">
				<span>{errorMessage}</span>
			</div>
		{/if}

		{#if psbt}
			<div class="mt-4">
				<h4 class="font-bold">Transaction PSBT:</h4>
				<textarea class="textarea textarea-bordered mt-2 w-full" rows="4" readonly>{psbt}</textarea>
				<button class="btn btn-sm mt-2" on:click={() => navigator.clipboard.writeText(psbt)}
					>Copy PSBT</button
				>
			</div>
		{/if}

		{#if psbtDetails}
			<div class="mt-4">
				<h4 class="font-bold">Transaction Details:</h4>
				<pre class="bg-base-300 rounded-md p-2 text-xs"><code
						>{JSON.stringify(psbtDetails, null, 2)}</code
					></pre>
			</div>
		{/if}
	</div>
</div>
