import * as breezSdk from '@breeztech/breez-sdk-liquid/web';
import { Buffer } from 'buffer';
import { MultiSigSigner, createMultiSigSigner } from './customSigner';
import { coordinationService } from './coordinationService';
import type { PayOnchainRequest, SendPaymentResponse } from '@breeztech/breez-sdk-liquid/web';

// Private SDK instance - not exposed outside this module
let sdk: breezSdk.BindingLiquidSdk | null = null;
let multiSigSigner: MultiSigSigner | null = null;

export const initWallet = async (mnemonic: string): Promise<void> => {
	try {
		const config = breezSdk.defaultConfig('testnet');
		// Configure working directory and cache dir
		config.workingDir = './breez_data';

		// Get the API key from environment variables
		const breezApiKey = import.meta.env.VITE_BREEZ_API_KEY;

		if (!breezApiKey) {
			throw new Error('Breez API key not found in environment variables');
		}

		config.breezApiKey = breezApiKey;

		// Connect to Breez network with user mnemonic
		sdk = await breezSdk.connect({
			config,
			mnemonic
		});

		console.log('Wallet initialized successfully');
		// Return void instead of the SDK instance
	} catch (error) {
		console.error('Failed to initialize wallet:', error);
		throw error;
	}
};

/**
 * Initialize wallet with custom multisig signer
 * This is the new method for multisig wallets
 */
export const initWalletWithMultisig = async (
	mnemonic: string,
	cosignerPublicKeys: string[], // Public keys of other signers
	threshold: number, // Minimum signatures required (e.g., 2 for 2-of-3)
	signerIndex: number // This signer's position (0, 1, 2, etc.)
): Promise<MultiSigSigner> => {
	try {
		// Create the SDK config
		const config = breezSdk.defaultConfig('testnet');
		config.workingDir = './breez_data';

		// Get the API key from environment variables
		const breezApiKey = import.meta.env.VITE_BREEZ_API_KEY;

		if (!breezApiKey) {
			throw new Error('Breez API key not found in environment variables');
		}

		config.breezApiKey = breezApiKey;

		// Create the custom multisig signer
		const customSigner = await createMultiSigSigner(
			mnemonic,
			cosignerPublicKeys,
			threshold,
			signerIndex
		);

		// Store the signer instance so we can access its custom methods
		multiSigSigner = customSigner;
		coordinationService.setSigner(multiSigSigner);

		// Connect using the custom signer instead of mnemonic
		sdk = await breezSdk.connectWithSigner({ config }, customSigner);

		console.log('Multisig wallet initialized successfully');
		console.log(`Configuration: ${threshold}-of-${cosignerPublicKeys.length + 1} multisig`);
		console.log(`Your signer index: ${signerIndex}`);
		return customSigner;
	} catch (error) {
		console.error('Failed to initialize multisig wallet:', error);
		throw error;
	}
};

/**
 * Check if current wallet is using multisig
 * This helps UI components know what features to show
 */
// DEPRECATED: Use storageService instead
// export const isMultisigWallet = (): boolean => {
// 	// You could store this flag when initializing the wallet
// 	// For now, we'll check if there's a custom signer instance
// 	return localStorage.getItem('walletType') === 'multisig';
// };

/**
 * Save multisig configuration to localStorage
 * This helps restore the wallet on app restart
 */
// DEPRECATED: Use storageService instead
// export const saveMultisigConfig = (config: {
// 	threshold: number;
// 	cosignerPublicKeys: string[];
// 	signerIndex: number;
// }): void => {
// 	localStorage.setItem('walletType', 'multisig');
// 	localStorage.setItem('multisigConfig', JSON.stringify(config));
// };

/**
 * Get saved multisig configuration
 */
// DEPRECATED: Use storageService instead
// export const getMultisigConfig = (): {
// 	threshold: number;
// 	cosignerPublicKeys: string[];
// 	signerIndex: number;
// } | null => {
// 	const configStr = localStorage.getItem('multisigConfig');
// 	if (!configStr) return null;

// 	try {
// 		return JSON.parse(configStr);
// 	} catch {
// 		return null;
// 	}
// };

/**
 * Clear multisig configuration
 */
// DEPRECATED: Use storageService instead
// export const clearMultisigConfig = (): void => {
// 	localStorage.removeItem('walletType');
// 	localStorage.removeItem('multisigConfig');
// };

// Add specific methods for actions components need to perform
// Payment Operations
export const parseInput = async (input: string): Promise<breezSdk.InputType> => {
	if (!sdk) throw new Error('SDK not initialized');
	return await sdk.parse(input);
};

export const prepareSendPayment = async (
	params: breezSdk.PrepareSendRequest
): Promise<breezSdk.PrepareSendResponse> => {
	if (!sdk) throw new Error('SDK not initialized');
	return await sdk.prepareSendPayment(params);
};

export const sendPayment = async (
	params: breezSdk.SendPaymentRequest
): Promise<breezSdk.SendPaymentResponse> => {
	if (!sdk) throw new Error('SDK not initialized');
	return await sdk.sendPayment(params);
};

// On-chain payment operations (for Bitcoin addresses)
export const preparePayOnchain = async (
	params: breezSdk.PreparePayOnchainRequest
): Promise<breezSdk.PreparePayOnchainResponse> => {
	if (!sdk) throw new Error('SDK not initialized');
	return await sdk.preparePayOnchain(params);
};

export const payOnchain = async (
	params: breezSdk.PayOnchainRequest
): Promise<breezSdk.SendPaymentResponse> => {
	if (!sdk) throw new Error('SDK not initialized');
	return await sdk.payOnchain(params);
};

/**
 * Initiates a multisig on-chain Liquid payment by creating a PSBT.
 */
export const createMultisigTx = async (
	pubkeys: Buffer[],
	threshold: number,
	outputs: { address: string; value: number }[]
): Promise<string> => {
	if (!sdk) throw new Error('SDK not initialized');

	// The coordination service now handles PSBT creation
	const psbtBase64 = await coordinationService.createPsbt({ pubkeys, threshold, outputs });
	return psbtBase64;
};

/**
 * Extracts human-readable details from a PSBT string.
 */
export const getPsbtDetails = (psbtBase64: string) => {
	if (!sdk) throw new Error('SDK not initialized');
	return coordinationService.extractPsbtDetails(psbtBase64);
};

/**
 * Signs a PSBT.
 */
export const signPsbt = (psbtBase64: string): string => {
	if (!sdk) throw new Error('SDK not initialized');
	return coordinationService.signPsbt(psbtBase64);
};

/**
 * Finalizes a PSBT and returns the transaction hex.
 */
export const finalizePsbt = (psbtBase64: string): string => {
	if (!sdk) throw new Error('SDK not initialized');
	return coordinationService.finalizePsbt(psbtBase64);
};

/**
 * Broadcasts a finalized, signed transaction to the network.
 */
export const broadcastTransaction = async (txHex: string): Promise<string> => {
	if (!sdk) throw new Error('SDK not initialized');
	// This is a placeholder for the actual broadcast logic.
	// In a real application, you would use an API like Blockstream's.
	console.log('--- SIMULATING BROADCAST ---');
	console.log('Transaction Hex:', txHex);
	console.log('--- WOULD BROADCAST TO LIQUID NETWORK ---');

	// For the POC, we'll return a dummy transaction ID.
	const dummyTxId = 'poc_broadcast_tx_' + Date.now();
	return Promise.resolve(dummyTxId);
};

// The methods below are now obsolete with the new PSBT-based flow.
/*
export const signMessage = async (message: number[]): Promise<number[]> => {
	if (!sdk) throw new Error('SDK not initialized');
	// The Breez SDK's `signMessage` method will delegate to our custom signer
	const result = await sdk.signMessage({ message: Buffer.from(message).toString('hex') });
	const signatureBytes = Buffer.from(result.signature, 'hex');
	return Array.from(signatureBytes);
};


export const encryptForCosigner = async (message: number[]): Promise<number[]> => {
	if (!sdk) throw new Error('SDK not initialized');
	if (!multiSigSigner) {
		throw new Error('Multisig signer not initialized. Cannot encrypt.');
	}
	// Directly call the eciesEncrypt method on our signer instance
	return multiSigSigner.eciesEncrypt(message);
};
*/

// Invoice and Receiving Operations
export const fetchLightningLimits = async (): Promise<breezSdk.LightningPaymentLimitsResponse> => {
	if (!sdk) throw new Error('SDK not initialized');
	return await sdk.fetchLightningLimits();
};

// Fetch On-chain (Liquid) limits
export const fetchOnchainLimits = async (): Promise<breezSdk.OnchainPaymentLimitsResponse> => {
	if (!sdk) throw new Error('SDK not initialized');
	return await sdk.fetchOnchainLimits();
};

export const prepareReceivePayment = async (
	params: breezSdk.PrepareReceiveRequest
): Promise<breezSdk.PrepareReceiveResponse> => {
	if (!sdk) throw new Error('SDK not initialized');
	return await sdk.prepareReceivePayment(params);
};

export const receivePayment = async (params: {
	prepareResponse: breezSdk.PrepareReceiveResponse;
	description: string;
}): Promise<breezSdk.ReceivePaymentResponse> => {
	if (!sdk) throw new Error('SDK not initialized');
	return await sdk.receivePayment(params);
};

// Fiat rate operations
export const fetchFiatRates = async (): Promise<breezSdk.Rate[]> => {
	if (!sdk) throw new Error('SDK not initialized');
	return await sdk.fetchFiatRates();
};

// Event handling
export const addEventListener = async (
	callback: (event: breezSdk.SdkEvent) => void
): Promise<string> => {
	if (!sdk) {
		throw new Error('SDK not initialized');
	}

	try {
		// Create event listener
		const listener: breezSdk.EventListener = {
			onEvent: callback
		};

		// Add event listener to SDK and return its ID
		const listenerId = await sdk.addEventListener(listener);
		console.log('Event listener added with ID:', listenerId);
		return listenerId;
	} catch (error) {
		console.error('Failed to add event listener:', error);
		throw error;
	}
};

// Remove event listener directly from the SDK
export const removeEventListener = async (listenerId: string): Promise<void> => {
	if (!sdk || !listenerId) {
		return;
	}

	try {
		await sdk.removeEventListener(listenerId);
		console.log('Event listener removed:', listenerId);
	} catch (error) {
		console.error(`Failed to remove event listener ${listenerId}:`, error);
		throw error;
	}
};

export const getWalletInfo = async (): Promise<breezSdk.GetInfoResponse | null> => {
	if (!sdk) {
		return null;
	}

	try {
		const info = await sdk.getInfo();
		console.log('Wallet Info:', JSON.stringify(info, null, 2));
		return info;
	} catch (error) {
		console.error('Failed to get wallet info:', error);
		throw error;
	}
};

export const getWalletAddress = async (): Promise<string | null> => {
	if (!sdk) {
		return null;
	}
	try {
		// Assuming the address is available in getInfo() response.
		// This might need correction based on actual SDK output.
		const info = await sdk.getInfo();
		// Common patterns for address field are 'address', 'receiveAddress', 'onchainAddress'.
		// I'm using a plausible assumption here.
		return (info as any).address || null;
	} catch (error) {
		console.error('Failed to get wallet address:', error);
		throw error;
	}
};

export const getTransactions = async (): Promise<breezSdk.Payment[]> => {
	if (!sdk) throw new Error('SDK not initialized');
	return await sdk.listPayments({
		sortAscending: false // Most recent first
	});
};

export const disconnect = async (): Promise<void> => {
	if (sdk) {
		try {
			// Disconnect SDK (this will clean up all listeners registered with it)
			await sdk.disconnect();
			sdk = null;
			// Remove reference to window.sdk
		} catch (error) {
			console.error('Failed to disconnect wallet:', error);
			throw error;
		}
	}
};

// Helper to save mnemonic to localStorage
export const saveMnemonic = (mnemonic: string): void => {
	localStorage.setItem('walletMnemonic', mnemonic);
};

// Helper to retrieve mnemonic from localStorage
export const getSavedMnemonic = (): string | null => {
	return localStorage.getItem('walletMnemonic');
};

// Helper to clear mnemonic from localStorage
export const clearMnemonic = (): void => {
	localStorage.removeItem('walletMnemonic');
};
