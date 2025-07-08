<script lang="ts">
	import { walletStore } from '$lib/stores/walletStore';

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
	}
</script>

{#if $walletStore.config}
	<div class="space-y-6">
		<!-- Wallet Info Card -->
		<div class="card bg-base-200 shadow-md">
			<div class="card-body">
				<h2 class="card-title">Wallet Overview</h2>
				<p>
					<strong>Type:</strong>
					{$walletStore.config.threshold}-of-{$walletStore.config.cosignerPublicKeys.length + 1}
				</p>
				<p>
					<strong>Created:</strong>
					{new Date($walletStore.config.creationDate).toLocaleString()}
				</p>
			</div>
		</div>

		<!-- Wallet Funds Card -->
		<div class="card bg-base-200 shadow-md">
			<div class="card-body">
				<h2 class="card-title">Wallet Funds</h2>
				{#if $walletStore.loading && $walletStore.balance === 0}
					<p>Fetching funds info...</p>
				{:else}
					<p class="text-2xl font-bold">{$walletStore.balance.toLocaleString()} sats</p>
				{/if}
			</div>
		</div>

		<!-- Cosigners Card -->
		<div class="card bg-base-200 shadow-md">
			<div class="card-body">
				<h2 class="card-title">Cosigner Public Keys</h2>
				<ul class="space-y-2">
					{#each $walletStore.config.cosignerPublicKeys as publicKey, i}
						<li class="flex items-center gap-2">
							<span class="font-mono text-sm break-all">
								<strong>Signer {i + 2}:</strong>
								{publicKey}
							</span>
							<button class="btn btn-xs" on:click={() => copyToClipboard(publicKey)}> Copy </button>
						</li>
					{/each}
				</ul>
			</div>
		</div>

		<!-- Wallet ID Card -->
		<div class="card bg-base-200 shadow-md">
			<div class="card-body">
				<h2 class="card-title">Wallet ID (Address)</h2>
				<p class="font-mono text-sm break-all">{$walletStore.config.id}</p>
				<div class="card-actions justify-end">
					<button class="btn btn-sm" on:click={() => copyToClipboard($walletStore.config!.id)}>
						Copy Wallet ID
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
