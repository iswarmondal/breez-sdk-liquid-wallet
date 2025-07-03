import * as breezSdk from '@breeztech/breez-sdk-liquid/web';
import { MultiSigSigner, createMultiSigSigner } from './customSigner';

// Private SDK instance - not exposed outside this module
let sdk: breezSdk.BindingLiquidSdk | null = null;

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
): Promise<void> => {
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

		// Connect using the custom signer instead of mnemonic
		sdk = await breezSdk.connectWithSigner({ config }, customSigner);

		console.log('Multisig wallet initialized successfully');
		console.log(`Configuration: ${threshold}-of-${cosignerPublicKeys.length + 1} multisig`);
		console.log(`Your signer index: ${signerIndex}`);
	} catch (error) {
		console.error('Failed to initialize multisig wallet:', error);
		throw error;
	}
};

/**
 * Check if current wallet is using multisig
 * This helps UI components know what features to show
 */
export const isMultisigWallet = (): boolean => {
	// You could store this flag when initializing the wallet
	// For now, we'll check if there's a custom signer instance
	return localStorage.getItem('walletType') === 'multisig';
};

/**
 * Save multisig configuration to localStorage
 * This helps restore the wallet on app restart
 */
export const saveMultisigConfig = (config: {
	threshold: number;
	cosignerPublicKeys: string[];
	signerIndex: number;
}): void => {
	localStorage.setItem('walletType', 'multisig');
	localStorage.setItem('multisigConfig', JSON.stringify(config));
};

/**
 * Get saved multisig configuration
 */
export const getMultisigConfig = (): {
	threshold: number;
	cosignerPublicKeys: string[];
	signerIndex: number;
} | null => {
	const configStr = localStorage.getItem('multisigConfig');
	if (!configStr) return null;

	try {
		return JSON.parse(configStr);
	} catch {
		return null;
	}
};

/**
 * Clear multisig configuration
 */
export const clearMultisigConfig = (): void => {
	localStorage.removeItem('walletType');
	localStorage.removeItem('multisigConfig');
};

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
		return await sdk.getInfo();
	} catch (error) {
		console.error('Failed to get wallet info:', error);
		throw error;
	}
};

export const getTransactions = async (): Promise<breezSdk.Payment[]> => {
	if (!sdk) {
		return [];
	}

	try {
		return await sdk.listPayments({
			sortAscending: false // Most recent first
		});
	} catch (error) {
		console.error('Failed to get transactions:', error);
		throw error;
	}
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
