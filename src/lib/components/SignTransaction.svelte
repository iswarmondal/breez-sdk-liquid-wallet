<script lang="ts">
	import { onMount } from 'svelte';
	import { walletStore } from '$lib/stores/walletStore';
	import {
		createMultisigTx,
		getPsbtDetails,
		signPsbt,
		finalizePsbt
	} from '$lib/services/walletService';
	import QRCode from 'qrcode';

	let psbtInput = '';
	let psbtDetails: any = null;
	let signedPsbt = '';
	let finalTxHex = '';
	let isLoading = false;
	let isBroadcasting = false;
	let broadcastResult: { txid: string; status: string } | null = null;
	let showModal = false;
	let modalError = '';

	function updateDetails() {
		psbtDetails = null;
		if (psbtInput) {
			try {
				psbtDetails = getPsbtDetails(psbtInput);
			} catch (e) {
				psbtDetails = null;
			}
		}
	}

	async function handleSign() {
		isLoading = true;
		modalError = '';
		try {
			signedPsbt = signPsbt(psbtInput);
		} catch (e: any) {
			modalError = e.message || 'Failed to sign PSBT.';
		} finally {
			isLoading = false;
		}
	}

	function handleFinalize() {
		modalError = '';
		try {
			finalTxHex = finalizePsbt(psbtInput);
			showModal = true;
		} catch (e: any) {
			modalError = e.message || 'Failed to finalize PSBT.';
		}
	}

	async function handleBroadcast() {
		isBroadcasting = true;
		modalError = '';
		broadcastResult = null;
		try {
			const response = await fetch('https://blockstream.info/liquidtestnet/api/tx', {
				method: 'POST',
				headers: { 'Content-Type': 'text/plain' },
				body: finalTxHex
			});
			if (!response.ok) {
				const errText = await response.text();
				throw new Error(`Broadcast failed: ${errText}`);
			}
			const txid = await response.text();
			broadcastResult = { txid, status: 'Success' };
		} catch (e: any) {
			modalError = e.message || 'Broadcast failed.';
			broadcastResult = { txid: '', status: 'Failed' };
		} finally {
			isBroadcasting = false;
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
			></textarea>
		</div>

		{#if psbtDetails}
			<div class="mt-4">
				<h4 class="font-bold">Transaction Details:</h4>
				<pre class="bg-base-300 rounded-md p-2 text-xs"><code
						>{JSON.stringify(psbtDetails, null, 2)}</code
					></pre>
			</div>
		{/if}

		<div class="card-actions mt-4 justify-end gap-2">
			<button class="btn btn-secondary" on:click={handleSign} disabled={isLoading || !psbtInput}>
				{#if isLoading && !isBroadcasting}<span class="loading loading-spinner loading-xs"
					></span>{/if}
				Sign
			</button>
			<button class="btn btn-accent" on:click={handleFinalize} disabled={isLoading || !psbtInput}>
				Finalize
			</button>
		</div>

		{#if signedPsbt}
			<div class="mt-4">
				<h4 class="font-bold">Signed PSBT:</h4>
				<textarea class="textarea textarea-bordered mt-2 w-full" rows="4" readonly
					>{signedPsbt}</textarea
				>
				<p class="text-sm text-gray-400">Share this with the next signer.</p>
			</div>
		{/if}

		{#if finalTxHex}
			<div class="mt-4">
				<h4 class="font-bold">Finalized Transaction Hex:</h4>
				<textarea class="textarea textarea-bordered mt-2 w-full" rows="3" readonly
					>{finalTxHex}</textarea
				>
				<button
					class="btn btn-primary mt-2 w-full"
					on:click={handleBroadcast}
					disabled={isBroadcasting}
				>
					{#if isBroadcasting}<span class="loading loading-spinner loading-xs"></span>{/if}
					Broadcast Transaction
				</button>
			</div>
		{/if}

		{#if broadcastResult}
			<div class="alert alert-success mt-4">
				<div>
					<h3 class="font-bold">Broadcast Successful!</h3>
					<div class="text-xs">TXID: {broadcastResult.txid}</div>
				</div>
			</div>
		{/if}

		{#if modalError}
			<div class="alert alert-error mt-4">
				<span>{modalError}</span>
			</div>
		{/if}
	</div>
</div>

{#if showModal}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Finalize & Broadcast Transaction</h3>
			{#if psbtDetails}
				<div class="mt-2">
					<p><strong>Outputs:</strong></p>
					<ul>
						{#each psbtDetails.outputs as output}
							<li>{output.value} sats → {output.address}</li>
						{/each}
					</ul>
					<p class="mt-2"><strong>Signed By:</strong> {psbtDetails.signedBy.join(', ')}</p>
				</div>
			{/if}
			{#if modalError}
				<div class="alert alert-error mt-2">{modalError}</div>
			{/if}
			{#if !broadcastResult}
				<div class="modal-action">
					<button class="btn btn-primary" on:click={handleBroadcast} disabled={isBroadcasting}>
						{#if isBroadcasting}<span class="loading loading-spinner loading-xs"></span>{/if}
						Broadcast
					</button>
					<button class="btn" on:click={() => (showModal = false)}>Cancel</button>
				</div>
			{:else}
				<div class="mt-4">
					{#if broadcastResult.status === 'Success'}
						<div class="alert alert-success">
							Broadcasted!<br />TxID: <span class="font-mono">{broadcastResult.txid}</span>
						</div>
					{:else}
						<div class="alert alert-error">Broadcast failed.</div>
					{/if}
				</div>
				<div class="modal-action">
					<button class="btn" on:click={() => (showModal = false)}>Close</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
