<script lang="ts">
	import { goto } from '$app/navigation';
	import { saveMnemonic } from '$lib/services/walletService';

	let mnemonic = '';
	let error = '';

	function handleImport() {
		const cleaned = mnemonic.trim().replace(/\s+/g, ' ');
		const wordCount = cleaned.split(' ').length;
		if (wordCount !== 12 && wordCount !== 24) {
			error = 'Please enter a valid 12 or 24-word recovery phrase';
			return;
		}
		saveMnemonic(cleaned);
		goto('/wallet');
	}
</script>

<div class="navbar bg-base-200 mb-8">
	<div class="navbar-center">
		<button class="btn btn-ghost text-xl" onclick={() => goto('/')}>Breez Self Custody Wallet</button>
	</div>
</div>

<div class="flex min-h-[60vh] items-center justify-center">
	<div class="card bg-base-100 w-full max-w-lg shadow-xl">
		<div class="card-body">
			<h2 class="card-title mb-2">Import Wallet</h2>
			<textarea
				bind:value={mnemonic}
				rows="3"
				class="textarea textarea-bordered mb-2 w-full text-lg"
				placeholder="Enter your 12 or 24-word recovery phrase"
			></textarea>
			{#if error}
				<div class="alert alert-error mb-2">
					<span>{error}</span>
				</div>
			{/if}
			<button class="btn btn-primary w-full" onclick={handleImport}>Import</button>
		</div>
	</div>
</div>
