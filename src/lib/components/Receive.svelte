<script lang="ts">
	import { onMount } from 'svelte';
	import { walletStore } from '$lib/stores/walletStore';
	import QRCode from 'qrcode';

	let qrCodeUrl = '';
	let copyMessage = '';

	onMount(() => {
		if ($walletStore.address) {
			QRCode.toDataURL(
				$walletStore.address,
				{ errorCorrectionLevel: 'H' },
				(err: any, url: string) => {
					if (err) console.error(err);
					qrCodeUrl = url;
				}
			);
		}
	});

	async function copyToClipboard(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copyMessage = 'Address copied to clipboard!';
			setTimeout(() => (copyMessage = ''), 2000);
		} catch (err) {
			copyMessage = 'Failed to copy address.';
			setTimeout(() => (copyMessage = ''), 2000);
		}
	}
</script>

<div class="card bg-base-100 shadow-xl">
	<div class="card-body">
		<h2 class="card-title">Receive Funds</h2>
		<p>Share this address to receive Liquid Bitcoin (L-BTC) into your wallet.</p>
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
		{#if copyMessage}
			<div class="alert alert-success mt-2">
				<span>{copyMessage}</span>
			</div>
		{/if}
	</div>
</div>
