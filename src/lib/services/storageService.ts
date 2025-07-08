export interface MultisigWalletConfig {
	id: string; // A unique identifier, e.g., the multisig address or a hash of the config
	label: string;
	threshold: number;
	cosignerPublicKeys: string[]; // Keys of OTHER signers
	allPublicKeys: string[]; // All keys including the user's
	creationDate: string; // ISO 8601 format
}

const STORAGE_KEY = 'multisigWallets';

class StorageService {
	/**
	 * Ensures a MultisigWalletConfig has all required properties, especially allPublicKeys.
	 * If allPublicKeys is missing, attempts to reconstruct it and logs a warning.
	 */
	private migrateConfig(config: any): MultisigWalletConfig {
		// If allPublicKeys is present and is an array, return as is
		if (Array.isArray(config.allPublicKeys)) {
			return config as MultisigWalletConfig;
		}
		// Attempt to reconstruct allPublicKeys
		// Assume the user's key is not in cosignerPublicKeys, so we need to guess or fallback
		// If cosignerPublicKeys exists, try to use initiatorPublicKey or fallback to just cosignerPublicKeys
		let allPublicKeys: string[] = [];
		if (Array.isArray(config.cosignerPublicKeys)) {
			// Try to find a unique key (initiatorPublicKey or similar)
			if (config.initiatorPublicKey && typeof config.initiatorPublicKey === 'string') {
				allPublicKeys = [config.initiatorPublicKey, ...config.cosignerPublicKeys];
			} else if (config.myPublicKey && typeof config.myPublicKey === 'string') {
				allPublicKeys = [config.myPublicKey, ...config.cosignerPublicKeys];
			} else {
				// Fallback: just use cosignerPublicKeys (may be incomplete)
				allPublicKeys = [...config.cosignerPublicKeys];
			}
		}
		console.warn('[storageService] Migrated wallet config missing allPublicKeys:', config.id);
		return {
			...config,
			allPublicKeys
		} as MultisigWalletConfig;
	}

	/**
	 * Retrieves all multisig wallet configurations from localStorage.
	 */
	getWallets(): MultisigWalletConfig[] {
		if (typeof window === 'undefined') return [];
		try {
			const walletsJson = localStorage.getItem(STORAGE_KEY);
			if (!walletsJson) {
				return [];
			}
			// Sort by creation date, descending (newest first)
			return JSON.parse(walletsJson)
				.map((w: any) => this.migrateConfig(w))
				.sort(
					(a: MultisigWalletConfig, b: MultisigWalletConfig) =>
						new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime()
				);
		} catch (error) {
			console.error('Error getting wallets from localStorage:', error);
			return [];
		}
	}

	/**
	 * Adds a new multisig wallet configuration to localStorage.
	 */
	addWallet(config: MultisigWalletConfig): void {
		if (typeof window === 'undefined') return;
		try {
			const wallets = this.getWallets();
			// Prevent duplicates
			if (wallets.some((w) => w.id === config.id)) {
				console.warn(`Wallet with ID ${config.id} already exists.`);
				return;
			}
			wallets.push(config);
			localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
		} catch (error) {
			console.error('Error adding wallet to localStorage:', error);
		}
	}

	/**
	 * Retrieves a single wallet by its ID.
	 */
	getWalletById(id: string): MultisigWalletConfig | undefined {
		if (typeof window === 'undefined') return undefined;
		const found = this.getWallets().find((w) => w.id === id);
		return found ? this.migrateConfig(found) : undefined;
	}

	/**
	 * Removes a wallet by its ID.
	 */
	removeWallet(id: string): void {
		if (typeof window === 'undefined') return;
		try {
			let wallets = this.getWallets();
			wallets = wallets.filter((w) => w.id !== id);

			localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
		} catch (error) {
			console.error('Error removing wallet from localStorage:', error);
		}
	}
}

export const storageService = new StorageService();
