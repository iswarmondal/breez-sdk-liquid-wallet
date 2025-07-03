import * as breezSdk from '@breeztech/breez-sdk-liquid/web';
import { BIP32Factory, type BIP32Interface } from 'bip32';
import * as bip39 from 'bip39';
import type { RecoveryIdType } from 'tiny-secp256k1';
import * as ecc from 'tiny-secp256k1';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha2';

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
	 * Used for certain Bitcoin operations and message signing
	 * Returns signature + recovery ID (65 bytes total)
	 */
	signEcdsaRecoverable = (msg: number[]): number[] => {
		try {
			console.log('Signing message with recoverable ECDSA');
			console.log('Message to sign (first 10 bytes):', msg.slice(0, 10));

			// For recoverable ECDSA, we typically use the master key directly
			// (not a derived key) as it's often used for general message signing
			if (!this.hdNode.privateKey) {
				throw new Error('No private key available for recoverable ECDSA signing');
			}

			// Step 1: Convert message from number[] to Uint8Array
			const messageBytes = new Uint8Array(msg);

			// Step 2: Use tiny-secp256k1's signRecoverable function
			// This directly gives us both the signature and recovery ID
			const result = ecc.signRecoverable(messageBytes, this.hdNode.privateKey);

			if (!result) {
				throw new Error('Failed to create recoverable signature');
			}

			const { signature, recoveryId } = result;

			// Step 3: Validate the signature was created successfully
			if (!signature || recoveryId === undefined) {
				throw new Error('Invalid signature or recovery ID returned');
			}

			// Step 4: Verify our recoverable signature works by testing recovery
			const recoveredPublicKey = this.recoverPublicKey(messageBytes, signature, recoveryId);
			if (!recoveredPublicKey || !this.arraysEqual(recoveredPublicKey, this.hdNode.publicKey)) {
				throw new Error('Created recoverable signature is invalid - recovery test failed');
			}

			// Step 5: Combine signature (64 bytes) + recovery ID (1 byte) = 65 bytes
			const recoverableSignature = new Uint8Array(65);
			recoverableSignature.set(signature, 0); // First 64 bytes: signature
			recoverableSignature[64] = recoveryId; // Last byte: recovery ID

			console.log(`✅ Successfully created recoverable signature`);
			console.log(`📝 Signature length: ${signature.length} bytes`);
			console.log(`🔄 Recovery ID: ${recoveryId}`);
			console.log(`🔑 Public key recovered successfully`);

			// Step 6: Return as number array (what Breez SDK expects)
			return Array.from(recoverableSignature);
		} catch (error) {
			console.error('Error signing with recoverable ECDSA:', error);
			throw error;
		}
	};

	/**
	 * Helper function to recover public key from signature
	 * This is used internally to validate recoverable signatures
	 */
	private recoverPublicKey = (
		messageHash: Uint8Array,
		signature: Uint8Array,
		recoveryId: RecoveryIdType
	): Uint8Array | null => {
		try {
			console.log(`🔍 Attempting to recover public key with recovery ID: ${recoveryId}`);

			// Use tiny-secp256k1's recover function to get the public key
			// The recover function signature is: recover(hash, signature, recoveryId, compressed = false)
			const recoveredKey = ecc.recover(messageHash, signature, recoveryId, true); // compressed = true

			if (!recoveredKey) {
				console.log(`❌ Recovery failed for recovery ID: ${recoveryId}`);
				return null;
			}

			console.log(`✅ Successfully recovered public key using recovery ID: ${recoveryId}`);
			console.log(`📏 Recovered key length: ${recoveredKey.length} bytes`);

			// Convert Buffer to Uint8Array if needed
			return new Uint8Array(recoveredKey);
		} catch (error) {
			console.error('Error recovering public key:', error);
			return null;
		}
	};

	/**
	 * Helper function to compare two Uint8Arrays
	 */
	private arraysEqual = (a: Uint8Array, b: Uint8Array): boolean => {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (a[i] !== b[i]) return false;
		}
		return true;
	};

	/**
	 * Get the SLIP-77 master blinding key
	 * Used for Liquid confidential transactions
	 * TODO: Implement when privacy features are needed
	 */
	slip77MasterBlindingKey = (): number[] => {
		try {
			console.log('Getting SLIP-77 master blinding key (placeholder)');

			// TODO: Implement proper SLIP-77 key derivation when privacy features are needed
			// For now, return a deterministic placeholder based on the master key
			return Array.from(this.hdNode.publicKey.slice(0, 32));
		} catch (error) {
			console.error('Error getting SLIP-77 master blinding key:', error);
			throw error;
		}
	};

	/**
	 * Compute HMAC-SHA256 (Hash-based Message Authentication Code)
	 * Used for various cryptographic operations including key derivation and message authentication
	 */
	hmacSha256 = (msg: number[], derivationPath: string): number[] => {
		try {
			console.log(`Computing HMAC-SHA256 for path: ${derivationPath}`);
			console.log('Message to authenticate (first 10 bytes):', msg.slice(0, 10));

			// Step 1: Derive the specific private key for this derivation path
			// This key will be used as the HMAC secret key
			const childNode = this.hdNode.derivePath(derivationPath);

			if (!childNode.privateKey) {
				throw new Error(`No private key available for derivation path: ${derivationPath}`);
			}

			// Step 2: Convert message from number[] to Uint8Array
			const messageBytes = new Uint8Array(msg);

			// Step 3: Use the derived private key as the HMAC secret key
			// The private key provides the secret that authenticates the message
			const hmacKey = childNode.privateKey;

			console.log(`🔑 Using derived key from path: ${derivationPath}`);
			console.log(`📝 Message length: ${messageBytes.length} bytes`);
			console.log(`🗝️ HMAC key length: ${hmacKey.length} bytes`);

			// Step 4: Compute HMAC-SHA256
			// HMAC(key, message) = SHA256(key ⊕ opad || SHA256(key ⊕ ipad || message))
			// ⊕ is the XOR operation and || is the concatenation operation
			// But we use the @noble/hashes library which handles this complex process
			const hmacResult = hmac(sha256, hmacKey, messageBytes);

			// Step 5: Validate the result
			if (!hmacResult || hmacResult.length !== 32) {
				throw new Error('HMAC computation failed or returned invalid length');
			}

			// Step 6: Cross-check HMAC result by recomputing and verifying consistency
			console.log(`🔍 Cross-checking HMAC computation...`);

			// Recompute HMAC with the same inputs to verify consistency
			const hmacVerification = hmac(sha256, hmacKey, messageBytes);

			// Verify that both computations produce the same result
			if (!this.arraysEqual(hmacResult, hmacVerification)) {
				throw new Error('HMAC verification failed - inconsistent results detected');
			}

			// Additional validation: Check that HMAC changes when input changes
			// This helps detect if our HMAC implementation is working correctly
			const testMessage = new Uint8Array([...messageBytes]);
			if (testMessage.length > 0) {
				testMessage[0] = testMessage[0] ^ 0x01; // Flip one bit
				const differentHmac = hmac(sha256, hmacKey, testMessage);

				if (this.arraysEqual(hmacResult, differentHmac)) {
					throw new Error('HMAC validation failed - result should change when input changes');
				}
			}

			console.log(`✅ Successfully computed and verified HMAC-SHA256`);
			console.log(`📏 HMAC result length: ${hmacResult.length} bytes`);
			console.log(
				`🔍 HMAC (first 8 bytes): ${Array.from(hmacResult.slice(0, 8))
					.map((b) => b.toString(16).padStart(2, '0'))
					.join('')}`
			);
			console.log(`🔐 HMAC verification: PASSED`);

			// Step 7: Return as number array (what Breez SDK expects)
			return Array.from(hmacResult);
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
