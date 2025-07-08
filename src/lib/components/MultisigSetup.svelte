<script lang="ts">
	import { onMount } from 'svelte';
	import {
		getSavedMnemonic,
		initWalletWithMultisig,
		createMultisigTx
	} from '../services/walletService';
	import { storageService, type MultisigWalletConfig } from '../services/storageService';
	import { walletStore } from '../stores/walletStore';
	import { goto } from '$app/navigation';
	import * as bip39 from 'bip39';

	let activeTab: 'create' | 'join' = 'create';
	let label = '';
	let threshold = 2;
	let totalSigners = 3;
	let isLoading = false;
	let errorMessage = '';
	let myPublicKey = '';
	let newWalletConfig: MultisigWalletConfig | null = null;
	let step: 'CONFIG' | 'SHARE' | 'FINALIZE' = 'CONFIG';

	// State for joining a wallet
	let joinCode = '';
	let joinError = '';

	let mySignerIndex: number | null = null;
	let myPubKeyInput = '';

	async function generatePublicKey() {
		const mnemonic = getSavedMnemonic();
		if (!mnemonic) {
			errorMessage = 'No wallet found. Please create or import a wallet first.';
			return;
		}
		isLoading = true;
		try {
			// Temporarily init signer to get the public key.
			// This is a workaround for the POC. In a real app, key generation
			// would be separate from wallet initialization.
			const tempSigner = await initWalletWithMultisig(mnemonic, [], 1, 0);
			// @ts-ignore
			myPublicKey = tempSigner.hdNode.publicKey.toString('hex');
			step = 'SHARE';
		} catch (e: any) {
			errorMessage = e.message;
		} finally {
			isLoading = false;
		}
	}

	function handleCreate() {
		if (threshold > totalSigners) {
			errorMessage = 'Threshold cannot be greater than the total number of signers.';
			return;
		}
		if (threshold < 1) {
			errorMessage = 'Threshold must be at least 1.';
			return;
		}
		errorMessage = '';
		generatePublicKey();
	}

	function handleJoin() {
		joinError = '';
		if (!joinCode) {
			joinError = 'Please enter a join code.';
			return;
		}
		try {
			const decodedConfig = JSON.parse(atob(joinCode));
			// Basic validation
			if (!decodedConfig.label || !decodedConfig.threshold || !decodedConfig.initiatorPublicKey) {
				throw new Error('Invalid join code.');
			}

			const allKeys = [decodedConfig.initiatorPublicKey, myPublicKey];

			const config: MultisigWalletConfig = {
				id: `ms_${new Date().getTime()}`,
				label: decodedConfig.label,
				threshold: decodedConfig.threshold,
				cosignerPublicKeys: [decodedConfig.initiatorPublicKey],
				allPublicKeys: allKeys,
				creationDate: new Date().toISOString()
			};

			storageService.addWallet(config);
			goto(`/wallets/${config.id}`);
		} catch (e) {
			joinError = 'Invalid or corrupt join code. Please check the code and try again.';
			console.error(e);
		}
	}

	function createJoinCode() {
		// In a real app, this would be more robust.
		// We're creating a "partial" config to be shared.
		const partialConfig = {
			label,
			threshold,
			totalSigners,
			initiatorPublicKey: myPublicKey
			// In a real app, you'd have a session ID to coordinate key exchange
		};
		return btoa(JSON.stringify(partialConfig));
	}

	function finalizeSetup() {
		// Prompt for all public keys and let the user select their own
		const pubKeys: string[] = [];
		for (let i = 0; i < totalSigners; i++) {
			const key = prompt(`Enter public key for participant ${i + 1}`);
			if (!key) {
				alert('All public keys are required.');
				return;
			}
			pubKeys.push(key);
		}
		// Ask user which index is theirs
		const indexStr = prompt(`Which index (1-${totalSigners}) is your public key?`);
		const index = indexStr ? parseInt(indexStr, 10) - 1 : -1;
		if (index < 0 || index >= totalSigners) {
			alert('Invalid index.');
			return;
		}
		mySignerIndex = index;
		myPubKeyInput = pubKeys[index];
		const cosignerPublicKeys = pubKeys.filter((_, i) => i !== index);
		const config: MultisigWalletConfig = {
			id: `ms_${new Date().getTime()}`,
			label,
			threshold,
			cosignerPublicKeys,
			allPublicKeys: pubKeys,
			creationDate: new Date().toISOString(),
			// @ts-ignore
			signerIndex: mySignerIndex
		};
		storageService.addWallet(config);
		newWalletConfig = config;
		step = 'FINALIZE';
	}
</script>

<div class="mx-auto max-w-2xl p-4 font-sans">
	<h2 class="mb-6 text-center text-3xl font-bold text-gray-100">Escrow Wallet Setup</h2>

	<div class="tabs tabs-boxed bg-base-300 mb-6">
		<button
			class="tab tab-lg"
			class:tab-active={activeTab === 'create'}
			on:click={() => (activeTab = 'create')}>Create New Escrow</button
		>
		<button
			class="tab tab-lg"
			class:tab-active={activeTab === 'join'}
			on:click={() => (activeTab = 'join')}>Join Existing Escrow</button
		>
	</div>

	{#if activeTab === 'create'}
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				{#if step === 'CONFIG'}
					<h3 class="card-title">1. Configure Your Escrow Wallet</h3>
					<div class="form-control w-full">
						<label for="label" class="label">
							<span class="label-text font-semibold">Escrow Label</span>
						</label>
						<input
							id="label"
							type="text"
							bind:value={label}
							placeholder="e.g., 'Project Phoenix Escrow'"
							class="input input-bordered w-full"
						/>
					</div>
					<div class="grid grid-cols-2 gap-4">
						<div class="form-control w-full">
							<label for="totalSigners" class="label">
								<span class="label-text font-semibold">Total Participants</span>
							</label>
							<input
								id="totalSigners"
								type="number"
								bind:value={totalSigners}
								min="2"
								class="input input-bordered w-full"
							/>
						</div>
						<div class="form-control w-full">
							<label for="threshold" class="label">
								<span class="label-text font-semibold">Signatures Required</span>
							</label>
							<input
								id="threshold"
								type="number"
								bind:value={threshold}
								min="1"
								max={totalSigners}
								class="input input-bordered w-full"
							/>
						</div>
					</div>
					<div class="mt-2 text-sm text-gray-400">
						This will be a {threshold}-of-{totalSigners} multisig wallet.
					</div>
					<div class="card-actions mt-4 justify-end">
						<button class="btn btn-primary" on:click={handleCreate} disabled={isLoading}>
							{#if isLoading}
								<span class="loading loading-spinner loading-xs" />
							{/if}
							Continue
						</button>
					</div>
				{/if}

				{#if step === 'SHARE'}
					<h3 class="card-title">2. Share Your Public Key & Invite Others</h3>
					<p>
						Share your public key with the other participants. Then, provide them with the
						invitation code below so they can join.
					</p>
					<div class="form-control mt-4 w-full">
						<label class="label">
							<span class="label-text font-semibold">Your Public Key</span>
						</label>
						<input type="text" readonly value={myPublicKey} class="input input-bordered w-full" />
						<button
							class="btn btn-sm mt-2"
							on:click={() => navigator.clipboard.writeText(myPublicKey)}>Copy Key</button
						>
					</div>
					<div class="form-control mt-4 w-full">
						<label class="label">
							<span class="label-text font-semibold">Invitation Code</span>
						</label>
						<textarea readonly class="textarea textarea-bordered w-full" rows="3"
							>{createJoinCode()}</textarea
						>
						<button
							class="btn btn-sm mt-2"
							on:click={() => navigator.clipboard.writeText(createJoinCode())}>Copy Code</button
						>
					</div>
					<div class="card-actions mt-4 justify-end">
						<button class="btn btn-primary" on:click={finalizeSetup}>Finalize (POC only)</button>
					</div>
				{/if}

				{#if step === 'FINALIZE'}
					<h3 class="card-title">3. Escrow Wallet Created!</h3>
					<div class="alert alert-success">
						<p>
							Your new escrow wallet has been configured. Once all participants have joined and
							confirmed, it will be ready to use.
						</p>
					</div>
					<div class="mt-4">
						<h4 class="font-bold">Wallet Details:</h4>
						<pre class="bg-base-300 rounded-md p-2 text-xs"><code
								>{JSON.stringify(newWalletConfig, null, 2)}</code
							></pre>
					</div>
					<div class="card-actions mt-4 justify-end">
						<button class="btn" on:click={() => goto(`/wallets/${newWalletConfig?.id}`)}
							>Go to Wallet</button
						>
					</div>
				{/if}

				{#if errorMessage}
					<div class="alert alert-error mt-4">
						<span>{errorMessage}</span>
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<h3 class="card-title">Join an Existing Escrow Wallet</h3>
				<p>Enter the invitation code provided by the escrow creator.</p>
				<div class="form-control mt-4 w-full">
					<label for="joinCode" class="label">
						<span class="label-text font-semibold">Invitation Code</span>
					</label>
					<textarea
						id="joinCode"
						bind:value={joinCode}
						class="textarea textarea-bordered w-full"
						rows="4"
						placeholder="Paste the invitation code here"
					></textarea>
				</div>
				<div class="card-actions mt-4 justify-end">
					<button class="btn btn-primary" on:click={handleJoin}>Join Escrow</button>
				</div>
				{#if joinError}
					<div class="alert alert-error mt-4">
						<span>{joinError}</span>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
