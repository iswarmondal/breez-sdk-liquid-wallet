<script lang="ts">
	import { signPsbt, finalizePsbt, broadcastTransaction, getPsbtDetails } from '$lib/services/walletService';

	let psbtInput = '';
	let signedPsbt = '';
	let finalTxHex = '';
	let txId = '';
	let isLoading = false;
	let isBroadcasting = false;
	let errorMessage = '';
	let psbtDetails: any = null;

	function handleSign() {
		isLoading = true;
		errorMessage = '';
		try {
			signedPsbt = signPsbt(psbtInput);
			psbtDetails = getPsbtDetails(signedPsbt);
		} catch (e: any) {
			errorMessage = `Failed to sign: ${e.message}`;
		} finally {
			isLoading = false;
		}
	}

	function handleFinalize() {
		isLoading = true;
		errorMessage = '';
		try {
			const toFinalize = signedPsbt || psbtInput;
			finalTxHex = finalizePsbt(toFinalize);
		} catch (e: any) {
			errorMessage = `Failed to finalize: ${e.message}`;
		} finally {
			isLoading = false;
		}
	}

	async function handleBroadcast() {
		isBroadcasting = true;
		errorMessage = '';
		try {
			txId = await broadcastTransaction(finalTxHex);
		} catch (e: any) {
			errorMessage = `Failed to broadcast: ${e.message}`;
		} finally {
			isBroadcasting = false;
		}
	}

	function updateDetails() {
		if (psbtInput) {
			try {
				psbtDetails = getPsbtDetails(psbtInput);
				errorMessage = '';
			} catch (e: any) {
				psbtDetails = null;
				errorMessage = 'Invalid PSBT format.';
			}
		}
	}
</script>

<div class="card bg-base-100 shadow-xl">
	<div class="card-body">
		<h3 class="card-title">Sign & Broadcast Transaction</h3>
		<div class="form-control w-full">
			<label for="psbtInput" class="label">
				<span class="label-text font-semibold">Paste PSBT Here</span>
			</label>
			<textarea
				id="psbtInput"
				bind:value={psbtInput}
				on:input={updateDetails}
				class="textarea textarea-bordered w-full"
				rows="4"
				placeholder="Paste the PSBT received from a co-signer"
			/>
		</div>

		{#if psbtDetails}
			<div class="mt-4">
				<h4 class="font-bold">Transaction Details:</h4>
				<pre class="bg-base-300 p-2 rounded-md text-xs"><code>{JSON.stringify(psbtDetails, null, 2)}</code></pre>
			</div>
		{/if}

		<div class="card-actions mt-4 justify-end gap-2">
			<button class="btn btn-secondary" on:click={handleSign} disabled={isLoading || !psbtInput}>
				{#if isLoading && !isBroadcasting}<span class="loading loading-spinner loading-xs" />{/if}
				Sign
			</button>
			<button class="btn btn-accent" on:click={handleFinalize} disabled={isLoading || !psbtInput}>
				Finalize
			</button>
		</div>

		{#if signedPsbt}
			<div class="mt-4">
				<h4 class="font-bold">Signed PSBT:</h4>
				<textarea class="textarea textarea-bordered mt-2 w-full" rows="4" readonly>{signedPsbt}</textarea>
				<p class="text-sm text-gray-400">Share this with the next signer.</p>
			</div>
		{/if}

		{#if finalTxHex}
			<div class="mt-4">
				<h4 class="font-bold">Finalized Transaction Hex:</h4>
				<textarea class="textarea textarea-bordered mt-2 w-full" rows="3" readonly>{finalTxHex}</textarea>
				<button class="btn btn-primary w-full mt-2" on:click={handleBroadcast} disabled={isBroadcasting}>
					{#if isBroadcasting}<span class="loading loading-spinner loading-xs" />{/if}
					Broadcast Transaction
				</button>
			</div>
		{/if}

		{#if txId}
			<div class="alert alert-success mt-4">
				<div>
					<h3 class="font-bold">Broadcast Successful!</h3>
					<div class="text-xs">TXID: {txId}</div>
				</div>
			</div>
		{/if}

		{#if errorMessage}
			<div class="alert alert-error mt-4">
				<span>{errorMessage}</span>
			</div>
		{/if}
	</div>
</div>
