<script lang="ts">
	import {
		initWalletWithMultisig,
		saveMultisigConfig,
		isMultisigWallet,
		getMultisigConfig
	} from '../services/walletService';

	// Component state
	let mnemonic = '';
	let threshold = 2;
	let signerIndex = 0;
	let cosignerKeys: string[] = ['', ''];
	let isLoading = false;
	let setupComplete = false;
	let errorMessage = '';

	// Add/remove cosigner key fields
	function addCosignerKey() {
		cosignerKeys = [...cosignerKeys, ''];
	}

	function removeCosignerKey(index: number) {
		cosignerKeys = cosignerKeys.filter((_, i) => i !== index);
	}

	// Validate the setup before proceeding
	function validateSetup(): string | null {
		if (!mnemonic.trim()) return 'Mnemonic is required';
		if (threshold < 1) return 'Threshold must be at least 1';
		if (threshold > cosignerKeys.length + 1) {
			return `Threshold (${threshold}) cannot exceed total signers (${cosignerKeys.length + 1})`;
		}
		if (signerIndex < 0 || signerIndex > cosignerKeys.length) {
			return 'Invalid signer index';
		}

		// Check that cosigner keys are provided (in a real app, validate they're valid public keys)
		const emptyKeys = cosignerKeys.filter((key) => !key.trim());
		if (emptyKeys.length > 0) {
			return 'All cosigner public keys must be provided';
		}

		return null;
	}

	// Initialize the multisig wallet
	async function setupMultisigWallet() {
		const validationError = validateSetup();
		if (validationError) {
			errorMessage = validationError;
			return;
		}

		isLoading = true;
		errorMessage = '';

		try {
			// Filter out empty keys
			const validCosignerKeys = cosignerKeys.filter((key) => key.trim());

			// Initialize the multisig wallet
			await initWalletWithMultisig(mnemonic, validCosignerKeys, threshold, signerIndex);

			// Save configuration for future use
			saveMultisigConfig({
				threshold,
				cosignerPublicKeys: validCosignerKeys,
				signerIndex
			});

			setupComplete = true;
			console.log('Multisig wallet setup completed successfully!');
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			console.error('Multisig setup failed:', error);
		} finally {
			isLoading = false;
		}
	}

	// Load existing configuration if available
	function loadExistingConfig() {
		const config = getMultisigConfig();
		if (config) {
			threshold = config.threshold;
			cosignerKeys = [...config.cosignerPublicKeys];
			signerIndex = config.signerIndex;
		}
	}

	// Check if already set up on component mount
	let alreadySetup = false;
	$: alreadySetup = isMultisigWallet();

	// Load config on mount
	import { onMount } from 'svelte';
	onMount(() => {
		loadExistingConfig();
	});
</script>

<div class="mx-auto max-w-xl p-5 font-sans">
	<h2 class="mb-8 text-center text-2xl font-bold text-gray-200">🔐 Multisig Wallet Setup</h2>

	{#if alreadySetup && !setupComplete}
		<div class="alert alert-info mb-5">
			<p class="text-gray-100">✅ Multisig wallet is already configured!</p>
			<button class="btn btn-sm btn-outline" on:click={loadExistingConfig}
				>Load Configuration</button
			>
		</div>
	{/if}

	{#if setupComplete}
		<div class="alert alert-success mb-5">
			<h3 class="font-bold text-gray-100">🎉 Multisig Wallet Ready!</h3>
			<p class="text-gray-100">Your multisig wallet has been initialized successfully.</p>
			<p class="text-gray-100">
				<strong>Configuration:</strong>
				{threshold}-of-{cosignerKeys.length + 1} multisig
			</p>
			<p class="text-gray-100"><strong>Your position:</strong> Signer #{signerIndex}</p>
		</div>
	{:else}
		<div class="space-y-6">
			<div class="alert alert-info">
				<h3 class="font-bold">📚 What is Multisig?</h3>
				<p>
					A multisig (multi-signature) wallet requires multiple signatures to authorize
					transactions. For example, in a 2-of-3 setup, any 2 out of 3 parties must sign to spend
					funds.
				</p>
			</div>

			<div class="form-control w-full">
				<label for="mnemonic" class="label">
					<span class="label-text font-semibold text-gray-100">Your Mnemonic Phrase:</span>
				</label>
				<input
					id="mnemonic"
					type="password"
					bind:value={mnemonic}
					placeholder="Enter your 12 or 24 word mnemonic phrase"
					disabled={isLoading}
					class="input input-bordered w-full"
				/>
				<label class="label">
					<span class="label-text-alt text-gray-500"
						>This will be used to generate your part of the multisig keys</span
					>
				</label>
			</div>

			<div class="grid grid-cols-1 gap-5 md:grid-cols-2">
				<div class="form-control w-full">
					<label for="threshold" class="label">
						<span class="label-text font-semibold text-gray-100">Signature Threshold:</span>
					</label>
					<input
						id="threshold"
						type="number"
						bind:value={threshold}
						min="1"
						max={cosignerKeys.length + 1}
						disabled={isLoading}
						class="input input-bordered w-full"
					/>
					<label class="label">
						<span class="label-text-alt text-gray-500">Minimum signatures required</span>
					</label>
				</div>

				<div class="form-control w-full">
					<label for="signerIndex" class="label">
						<span class="label-text font-semibold text-gray-100">Your Signer Index:</span>
					</label>
					<input
						id="signerIndex"
						type="number"
						bind:value={signerIndex}
						min="0"
						max={cosignerKeys.length}
						disabled={isLoading}
						class="input input-bordered w-full"
					/>
					<label class="label">
						<span class="label-text-alt text-gray-500"
							>Your position in the signing order (0, 1, 2...)</span
						>
					</label>
				</div>
			</div>

			<div class="card bg-base-200 p-4 shadow-sm">
				<h4 class="mb-3 font-semibold text-gray-100">Other Signers' Public Keys:</h4>
				{#each cosignerKeys as key, index}
					<div class="mb-3 flex items-center gap-3">
						<input
							type="text"
							bind:value={cosignerKeys[index]}
							placeholder="Public key of signer #{index + 1}"
							disabled={isLoading}
							class="input input-bordered flex-1"
						/>
						<button
							type="button"
							on:click={() => removeCosignerKey(index)}
							disabled={isLoading || cosignerKeys.length <= 1}
							class="btn btn-error btn-sm"
						>
							Remove
						</button>
					</div>
				{/each}

				<button
					type="button"
					on:click={addCosignerKey}
					disabled={isLoading}
					class="btn btn-success btn-sm w-full"
				>
					+ Add Another Signer
				</button>
			</div>

			{#if errorMessage}
				<div class="alert alert-error">
					<p class="text-gray-100">❌ {errorMessage}</p>
				</div>
			{/if}

			<div class="card bg-base-200 p-4 shadow-sm">
				<h4 class="mb-2 font-semibold text-gray-100">Setup Summary:</h4>
				<p class="text-gray-100">
					<strong>Total Signers:</strong>
					{cosignerKeys.length + 1} (you + {cosignerKeys.length} others)
				</p>
				<p class="text-gray-100"><strong>Required Signatures:</strong> {threshold}</p>
				<p class="text-gray-100">
					<strong>Type:</strong>
					{threshold}-of-{cosignerKeys.length + 1} multisig
				</p>
			</div>

			<button
				on:click={setupMultisigWallet}
				disabled={isLoading || !mnemonic.trim()}
				class="btn btn-primary w-full"
			>
				{isLoading ? 'Setting up...' : 'Initialize Multisig Wallet'}
			</button>
		</div>
	{/if}
</div>
