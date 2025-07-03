import * as breezSdk from '@breeztech/breez-sdk-liquid/web';
import { BIP32Factory, type BIP32Interface } from 'bip32';
import * as bip39 from 'bip39';
import * as ecc from 'tiny-secp256k1';

// Create bip32 instance with tiny-secp256k1
const bip32 = BIP32Factory(ecc);

/**
 * Custom Multi-Signature Signer for Breez SDK
 *
 * This signer implements the Breez SDK Signer interface to support
 * multi-signature wallets where multiple parties need to sign transactions.
 */
export class MultiSigSigner implements breezSdk.Signer {
	private hdNode: BIP32Interface;
	private cosignerKeys: Uint8Array[]; // Public keys of other signers
	private threshold: number; // Minimum signatures required (e.g., 2 of 3)
	private signerIndex: number; // This signer's position in the multisig setup

	constructor(
		hdNode: BIP32Interface,
		cosignerKeys: Uint8Array[],
		threshold: number,
		signerIndex: number
	) {
		this.hdNode = hdNode;
		this.cosignerKeys = cosignerKeys;
		this.threshold = threshold;
		this.signerIndex = signerIndex;
	}

	/**
	 * Get the extended public key (xpub) for the master key
	 * This is used to derive addresses
	 */
	xpub = (): number[] => {
		try {
			console.log('Deriving xpub from master key');
			return Array.from(this.hdNode.publicKey);
		} catch (error) {
			console.error('Error deriving xpub:', error);
			throw error;
		}
	};

	/**
	 * Derive an extended public key for a specific derivation path
	 * @param derivationPath - BIP32 derivation path (e.g., "m/44'/0'/0'/0/0")
	 */
	deriveXpub = (derivationPath: string): number[] => {
		try {
			console.log(`Deriving xpub for path: ${derivationPath}`);
			// TODO: Implement proper key derivation using BIP32
			// This would typically use libraries like bitcoinjs-lib or similar

			// Placeholder: return a derived key based on path
			// In a real implementation, you'd:
			// 1. Parse the derivation path
			// 2. Apply BIP32 key derivation
			// 3. Return the derived public key

			const derivedNode = this.hdNode.derivePath(derivationPath);
			return Array.from(derivedNode.publicKey);
		} catch (error) {
			console.error('Error deriving xpub for path:', derivationPath, error);
			throw error;
		}
	};

	/**
	 * Sign a message using ECDSA (Elliptic Curve Digital Signature Algorithm)
	 * This is where multisig coordination happens
	 */
	signEcdsa = (msg: number[], derivationPath: string): number[] => {
		try {
			console.log(`Signing message with ECDSA for path: ${derivationPath}`);
			console.log('Message to sign (first 10 bytes):', msg.slice(0, 10));

			// Step 1: Derive the specific private key for this path
			const childNode = this.hdNode.derivePath(derivationPath);

			// Ensure we have a private key (should always be true for HD nodes created from seed)
			if (!childNode.privateKey) {
				throw new Error(`No private key available for derivation path: ${derivationPath}`);
			}

			// Step 2: Convert the message from number[] to Uint8Array
			const messageBytes = new Uint8Array(msg);

			// Step 3: Sign the message using the elliptic curve cryptography library
			// The message should already be hashed (typically SHA256)
			const signature = ecc.sign(messageBytes, childNode.privateKey);

			// Step 4: Validate the signature was created successfully
			if (!signature) {
				throw new Error('Failed to create signature');
			}

			// Step 5: Verify our own signature (good practice)
			const isValid = ecc.verify(messageBytes, childNode.publicKey, signature);
			if (!isValid) {
				throw new Error('Created signature is invalid - this should not happen');
			}

			console.log(`✅ Successfully signed message with key at path: ${derivationPath}`);
			console.log(`📝 Signature length: ${signature.length} bytes`);
			console.log(
				`🔑 Public key: ${Array.from(childNode.publicKey)
					.map((b) => b.toString(16).padStart(2, '0'))
					.join('')}`
			);

			// Step 6: Return signature as number array (what Breez SDK expects)
			return Array.from(signature);
		} catch (error) {
			console.error('Error signing with ECDSA:', error);
			throw error;
		}
	};

	/**
	 * Sign a message using recoverable ECDSA
	 * Used for certain Bitcoin operations
	 */
	signEcdsaRecoverable = (msg: number[]): number[] => {
		try {
			console.log('Signing message with recoverable ECDSA');

			// TODO: Implement recoverable ECDSA signing for multisig
			// This includes a recovery ID to identify which key was used

			// Placeholder: return a dummy recoverable signature (signature + recovery id)
			return new Array(65).fill(0).map(() => Math.floor(Math.random() * 256));
		} catch (error) {
			console.error('Error signing with recoverable ECDSA:', error);
			throw error;
		}
	};

	/**
	 * Get the SLIP-77 master blinding key
	 * Used for Liquid confidential transactions
	 */
	slip77MasterBlindingKey = (): number[] => {
		try {
			console.log('Getting SLIP-77 master blinding key');

			// TODO: Implement proper SLIP-77 key derivation
			// SLIP-77 is used for blinding keys in confidential transactions

			// Placeholder: derive from master key
			return Array.from(this.hdNode.publicKey.slice(0, 32));
		} catch (error) {
			console.error('Error getting SLIP-77 master blinding key:', error);
			throw error;
		}
	};

	/**
	 * Compute HMAC-SHA256
	 * Used for various cryptographic operations
	 */
	hmacSha256 = (msg: number[], derivationPath: string): number[] => {
		try {
			console.log(`Computing HMAC-SHA256 for path: ${derivationPath}`);

			// TODO: Implement proper HMAC-SHA256
			// This typically uses the derived key as the HMAC key

			// Placeholder: return dummy HMAC
			return new Array(32).fill(0).map(() => Math.floor(Math.random() * 256));
		} catch (error) {
			console.error('Error computing HMAC-SHA256:', error);
			throw error;
		}
	};

	/**
	 * Encrypt a message using ECIES
	 * Used for secure communication
	 */
	eciesEncrypt = (msg: number[]): number[] => {
		try {
			console.log('Encrypting message with ECIES');

			// TODO: Implement ECIES encryption
			// ECIES combines ECDH key agreement with symmetric encryption

			// Placeholder: return encrypted message (in reality, longer than input)
			return [...msg, ...new Array(16).fill(0).map(() => Math.floor(Math.random() * 256))];
		} catch (error) {
			console.error('Error encrypting with ECIES:', error);
			throw error;
		}
	};

	/**
	 * Decrypt a message using ECIES
	 * Used for secure communication
	 */
	eciesDecrypt = (msg: number[]): number[] => {
		try {
			console.log('Decrypting message with ECIES');

			// TODO: Implement ECIES decryption

			// Placeholder: return "decrypted" message (shorter than input)
			return msg.slice(0, -16);
		} catch (error) {
			console.error('Error decrypting with ECIES:', error);
			throw error;
		}
	};

	// Helper methods for multisig coordination

	/**
	 * Coordinate signature collection from other signers
	 * This is specific to multisig and not part of the Signer interface
	 */
	async collectSignatures(
		message: number[],
		derivationPath: string
	): Promise<{ signatures: number[][]; signerIndices: number[] }> {
		console.log('Starting signature collection for multisig transaction');

		// TODO: Implement signature collection mechanism
		// This could involve:
		// 1. HTTP requests to other signers' APIs
		// 2. Hardware wallet integration
		// 3. User interface for manual signature input
		// 4. Secure communication protocols

		const signatures: number[][] = [];
		const signerIndices: number[] = [];

		// Add our own signature
		const ourSignature = this.signEcdsa(message, derivationPath);
		signatures.push(ourSignature);
		signerIndices.push(this.signerIndex);

		// TODO: Collect signatures from other parties
		// For now, simulate collecting threshold-1 more signatures
		for (let i = 0; i < this.threshold - 1; i++) {
			// In reality, you'd request signatures from other cosigners
			const dummySignature = new Array(64).fill(0).map(() => Math.floor(Math.random() * 256));
			signatures.push(dummySignature);
			signerIndices.push(i + 1);
		}

		return { signatures, signerIndices };
	}

	/**
	 * Check if we have enough signatures to meet the threshold
	 */
	hasEnoughSignatures(signatures: number[][]): boolean {
		return signatures.length >= this.threshold;
	}
}

/**
 * Factory function to create a MultiSigSigner from a mnemonic
 * This makes it easier to set up the signer
 */
export async function createMultiSigSigner(
	mnemonic: string,
	cosignerPublicKeys: string[], // Hex-encoded public keys of other signers
	threshold: number,
	signerIndex: number
): Promise<MultiSigSigner> {
	try {
		// Convert mnemonic to seed using BIP39
		const seed = bip39.mnemonicToSeedSync(mnemonic);

		// Create hierarchical deterministic (HD) node from seed using the bip32 factory
		const hdNode = bip32.fromSeed(seed);

		// Convert cosigner public keys from hex to Uint8Array
		const cosignerKeys = cosignerPublicKeys.map((key) => {
			// Remove any "0x" prefix if present
			const cleanKey = key.startsWith('0x') ? key.slice(2) : key;

			// Validate hex string format
			if (!/^[0-9a-fA-F]+$/.test(cleanKey)) {
				throw new Error(`Invalid hex string format: ${key}`);
			}

			// Public keys should be 33 bytes (66 hex characters) for compressed format
			// or 65 bytes (130 hex characters) for uncompressed format
			const expectedLengths = [66, 130]; // 33 bytes * 2, 65 bytes * 2
			if (!expectedLengths.includes(cleanKey.length)) {
				throw new Error(
					`Invalid public key length: ${cleanKey.length}. Expected 66 or 130 hex characters`
				);
			}

			// Convert hex string to Uint8Array
			const bytes = new Uint8Array(cleanKey.length / 2);
			for (let i = 0; i < cleanKey.length; i += 2) {
				const hexByte = cleanKey.slice(i, i + 2);
				bytes[i / 2] = parseInt(hexByte, 16);
			}

			console.log(`Converted public key: ${key} -> ${bytes.length} bytes`);
			return bytes;
		});

		return new MultiSigSigner(hdNode, cosignerKeys, threshold, signerIndex);
	} catch (error) {
		console.error('Error creating MultisigSigner:', error);
		throw error;
	}
}
