<script lang="ts">
	import {
		getPsbtDetails,
		signPsbt,
		finalizePsbt,
		broadcastTransaction
	} from '$lib/services/walletService';

	let psbtInput = '';
	let psbtDetails: { inputs: any[]; outputs: any[]; signedBy: string[] } | null = null;
	let error = '';
	let newPsbtOutput = '';
	let broadcastTxId = '';
	let successMessage = '';

	function handleAnalyzePsbt() {
		error = '';
		newPsbtOutput = '';
		broadcastTxId = '';
		psbtDetails = null;
		successMessage = '';

		try {
			if (!psbtInput.trim()) {
				throw new Error('Please paste a PSBT to analyze.');
			}
			const details = getPsbtDetails(psbtInput);
			psbtDetails = details;
		} catch (e: any) {
			error = 'Invalid PSBT: ' + e.message;
		}
	}

	function handleSignPsbt() {
		error = '';
		successMessage = '';
		try {
			const signedPsbt = signPsbt(psbtInput);
			newPsbtOutput = signedPsbt;
			successMessage =
				'PSBT signed successfully! Copy the new PSBT below and send it to your co-signer.';
		} catch (e: any) {
			error = 'Failed to sign PSBT: ' + e.message;
		}
	}

	async function handleFinalizeAndBroadcast() {
		error = '';
		successMessage = '';
		try {
			const txHex = finalizePsbt(psbtInput);
			const txid = await broadcastTransaction(txHex);
			broadcastTxId = txid;
			successMessage = `Transaction broadcasted successfully! TXID: ${txid}`;
		} catch (e: any) {
			error = 'Failed to finalize or broadcast: ' + e.message;
		}
	}

	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(newPsbtOutput);
			successMessage = 'Copied to clipboard!';
		} catch (err) {
			error = 'Failed to copy PSBT.';
		}
	}

	$: isReadyForBroadcast = psbtDetails ? psbtDetails.signedBy.length >= 2 : false;
</script>

<div class="container mx-auto max-w-2xl p-4">
	<h1 class="mb-4 text-2xl font-bold">Sign Multisig Transaction</h1>
	<p class="mb-4 text-sm text-gray-500">
		Paste a PSBT from your co-signer below to analyze, sign, and broadcast it.
	</p>

	<div class="form-control w-full">
		<label class="label" for="psbt-input">
			<span class="label-text">Paste PSBT Here</span>
		</label>
		<textarea
			id="psbt-input"
			class="textarea textarea-bordered h-40 w-full font-mono text-xs"
			placeholder="Paste the Base64 PSBT string from your co-signer"
			bind:value={psbtInput}
		></textarea>
	</div>
	<button class="btn btn-primary mt-4 w-full" on:click={handleAnalyzePsbt}>Analyze PSBT</button>

	{#if error}
		<div class="alert alert-error mt-4 shadow-lg">
			<div>
				<span>{error}</span>
			</div>
		</div>
	{/if}

	{#if psbtDetails}
		<div class="mt-6 rounded-md border p-4">
			<h2 class="mb-2 text-xl font-semibold">Transaction Details</h2>
			<div class="divider"></div>
			<div class="mb-4">
				<h3 class="font-bold">Inputs</h3>
				{#each psbtDetails.inputs as input, i}
					<div class="font-mono text-xs break-all">Input {i + 1}: {input.txid}:{input.vout}</div>
				{/each}
			</div>
			<div class="mb-4">
				<h3 class="font-bold">Outputs</h3>
				{#each psbtDetails.outputs as output}
					<div class="font-mono text-xs break-all">
						&rarr; {output.address} <span class="font-bold">{output.value} sats</span>
					</div>
				{/each}
			</div>
			<div>
				<h3 class="font-bold">Signatures</h3>
				<p class="text-sm">
					{psbtDetails.signedBy.length} of 2 required signatures are present.
				</p>
				{#each psbtDetails.signedBy as signature}
					<div class="badge badge-success mt-1 gap-2">✓ {signature}</div>
				{/each}
			</div>

			<div class="divider"></div>

			{#if !isReadyForBroadcast}
				<button class="btn btn-secondary w-full" on:click={handleSignPsbt}>
					Add Your Signature
				</button>
			{:else}
				<div class="alert alert-success">
					This transaction has enough signatures and is ready to be broadcast.
				</div>
				<button class="btn btn-success mt-4 w-full" on:click={handleFinalizeAndBroadcast}>
					Finalize & Broadcast
				</button>
			{/if}
		</div>
	{/if}

	{#if successMessage && !newPsbtOutput && !broadcastTxId}
		<div class="alert alert-success mt-4 shadow-lg">
			<div>
				<span>{successMessage}</span>
			</div>
		</div>
	{/if}

	{#if newPsbtOutput}
		<div class="mt-6">
			<h2 class="text-lg font-semibold">New Signed PSBT</h2>
			{#if successMessage}
				<div class="alert alert-success mt-2 mb-2 shadow-lg">
					<div>
						<span>{successMessage}</span>
					</div>
				</div>
			{/if}
			<textarea
				class="textarea textarea-bordered h-48 w-full font-mono text-xs"
				readonly
				bind:value={newPsbtOutput}
			></textarea>
			<button class="btn btn-secondary mt-2 w-full" on:click={copyToClipboard}>
				Copy New PSBT
			</button>
		</div>
	{/if}

	{#if broadcastTxId}
		<div class="mt-6">
			<h2 class="text-lg font-semibold">Broadcast Successful!</h2>
			<div class="alert alert-success mt-2 mb-2 shadow-lg">
				<div>
					<span class="break-all"><strong>TxID:</strong> {broadcastTxId}</span>
				</div>
			</div>
			<a
				href="https://blockstream.info/liquidtestnet/tx/{broadcastTxId}"
				target="_blank"
				class="btn btn-accent mt-2 w-full"
			>
				View on Block Explorer
			</a>
		</div>
	{/if}
</div>
