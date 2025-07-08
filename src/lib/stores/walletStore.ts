import { writable } from 'svelte/store';
import type { MultiSigSigner } from '$lib/services/customSigner';
import type { MultisigWalletConfig } from '$lib/services/storageService';
import {
	initWalletWithMultisig,
	getWalletInfo,
	getSavedMnemonic
} from '$lib/services/walletService';
import liquidjs from 'liquidjs-lib';
const { payments, networks } = liquidjs;

export interface WalletState {
	initialized: boolean;
	loading: boolean;
	error: string | null;
	config: MultisigWalletConfig | null;
	signer: MultiSigSigner | null;
	address: string | null;
	balance: number;
	transactions: any[]; // Replace 'any' with a proper transaction type later
}

function createWalletStore() {
	const { subscribe, set, update } = writable<WalletState>({
		initialized: false,
		loading: false,
		error: null,
		config: null,
		signer: null,
		address: null,
		balance: 0,
		transactions: []
	});

	async function initialize(walletConfig: MultisigWalletConfig) {
		update((state) => ({ ...state, loading: true, error: null, config: walletConfig }));

		try {
			const mnemonic = getSavedMnemonic();
			if (!mnemonic) {
				throw new Error('No mnemonic found. Please import your main wallet first.');
			}

			// Initialize the Breez SDK and get the signer instance
			const signer = await initWalletWithMultisig(
				mnemonic,
				walletConfig.cosignerPublicKeys,
				walletConfig.threshold,
				walletConfig.signerIndex ?? 0
			);

			// The wallet config now contains the definitive list of ALL public keys.
			const allPubkeys = walletConfig.allPublicKeys.map((pk) => Buffer.from(pk, 'hex'));

			// Sort pubkeys to ensure address is deterministic.
			allPubkeys.sort((a, b) => a.toString('hex').localeCompare(b.toString('hex')));

			// Compute the real multisig address
			const p2ms = payments.p2ms({
				m: walletConfig.threshold,
				pubkeys: allPubkeys,
				network: networks.testnet
			});
			const p2wsh = payments.p2wsh({ redeem: p2ms, network: networks.testnet });
			const address = p2wsh.address!;

			update((state) => ({ ...state, signer, address }));

			// Fetch initial wallet data using the correct address
			await fetchWalletDetails();
			await fetchTransactions(address);

			update((state) => ({ ...state, initialized: true, loading: false }));
		} catch (err: any) {
			update((state) => ({ ...state, error: err.message, loading: false }));
		}
	}

	async function fetchWalletDetails() {
		try {
			const info = await getWalletInfo();
			const balance = info?.liquidBalanceSat ?? 0;
			update((state) => ({ ...state, balance }));
		} catch (err: any) {
			update((state) => ({ ...state, error: `Failed to fetch balance: ${err.message}` }));
		}
	}

	async function fetchTransactions(walletAddress: string) {
		update((state) => ({ ...state, loading: true }));
		try {
			const url = `https://blockstream.info/liquidtestnet/api/address/${walletAddress}/txs`;
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`Failed to fetch transactions: ${response.statusText}`);
			}
			const txs = await response.json();
			update((state) => ({ ...state, transactions: txs, loading: false }));
		} catch (err: any) {
			update((state) => ({
				...state,
				error: `Failed to fetch transaction history: ${err.message}`,
				loading: false
			}));
		}
	}

	function reset() {
		set({
			initialized: false,
			loading: false,
			error: null,
			config: null,
			signer: null,
			address: null,
			balance: 0,
			transactions: []
		});
	}

	return {
		subscribe,
		initialize,
		fetchWalletDetails,
		fetchTransactions,
		reset,
		update
	};
}

export const walletStore = createWalletStore();
