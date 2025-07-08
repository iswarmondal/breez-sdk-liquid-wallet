<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let hasWallet = false;

	onMount(() => {
		const mnemonic = localStorage.getItem('walletMnemonic');
		hasWallet = !!mnemonic;
	});

	function goToCreate() {
		goto('/create');
	}
	function goToImport() {
		goto('/import');
	}
	function goToWallet() {
		goto('/wallet');
	}
	function goToWallets() {
		goto('/wallets');
	}
</script>

<div class="flex min-h-[60vh] items-center justify-center">
	<div class="card bg-base-100 w-full max-w-lg shadow-xl">
		<div class="card-body items-center">
			<h2 class="card-title mb-4 text-center">Breez SDK Liquid Wallet</h2>
			<div class="mb-4 text-center">
				<p class="mb-2 text-lg font-semibold">⚡ Lightning + 💧 Liquid Network</p>
				<p class="text-sm text-gray-600">
					Self-custodial wallet powered by the Breez SDK with seamless integration between Lightning
					Network and Liquid sidechain
				</p>
			</div>

			<!-- Feature highlights -->
			<div class="mb-6 grid w-full grid-cols-1 gap-4 md:grid-cols-2">
				<div class="alert alert-info">
					<div class="text-sm">
						<strong>⚡ Lightning Payments</strong><br />
						Instant, low-fee payments via Lightning Network
					</div>
				</div>
				<div class="alert alert-success">
					<div class="text-sm">
						<strong>🔗 Bitcoin Addresses</strong><br />
						Send to any Bitcoin address via submarine swaps
					</div>
				</div>
				<div class="alert alert-warning">
					<div class="text-sm">
						<strong>💧 Liquid Network</strong><br />
						Funds stored as L-BTC on Liquid sidechain
					</div>
				</div>
				<div class="alert alert-neutral">
					<div class="text-sm">
						<strong>🔄 Auto Swaps</strong><br />
						Automatic submarine swaps between networks
					</div>
				</div>
			</div>

			<div class="flex w-full max-w-xs flex-col gap-4">
				{#if hasWallet}
					<!-- <button onclick={goToWallet} class="btn btn-primary btn-lg"
						>Open Single-Signer Wallet</button
					> -->
					<button onclick={goToWallets} class="btn btn-secondary btn-lg"
						>Manage Multisig Wallets</button
					>
				{:else}
					<button onclick={goToCreate} class="btn btn-primary btn-lg"
						>Create Single-Signer Wallet</button
					>
					<button onclick={goToImport} class="btn btn-secondary btn-lg"
						>Import Single-Signer Wallet</button
					>
					<div class="divider">OR</div>
					<button onclick={goToWallets} class="btn btn-accent btn-lg">Set Up Multisig</button>
				{/if}
			</div>
		</div>

		<div class="card-body items-center text-center">
			<div class="alert alert-warning w-full">
				<div class="text-sm">
					<strong>⚠️ Testnet Warning</strong><br />
					This wallet runs on testnet and stores keys in browser localStorage (unencrypted). Use only
					for testing purposes.
				</div>
			</div>
		</div>
	</div>
</div>
