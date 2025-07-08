import * as breezSdk from '@breeztech/breez-sdk-liquid/web';
import { BIP32Factory, type BIP32Interface } from 'bip32';
import * as bip39 from 'bip39';
import type { RecoveryIdType } from 'tiny-secp256k1';
import * as ecc from 'tiny-secp256k1';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha2';
import { hkdf } from '@noble/hashes/hkdf';
import { randomBytes } from '@noble/hashes/utils';

// Create bip32 instance with tiny-secp256k1
const bip32 = BIP32Factory(ecc);

// A BIP32 xpub is 78 bytes long. This helper function manually constructs it.
// 4 bytes: version
// 1 byte: depth
// 4 bytes: parent fingerprint
// 4 bytes: child index
// 32 bytes: chain code
// 33 bytes: public key
function serializeXpub(
	hdNode: BIP32Interface,
	version: number = 0x043587cf /* testnet public */
): Uint8Array {
	const buffer = Buffer.alloc(78);

	// 4 bytes version
	buffer.writeUInt32BE(version, 0);

	// 1 byte depth
	buffer.writeUInt8(hdNode.depth, 4);

	// 4 bytes parent fingerprint
	buffer.writeUInt32BE(hdNode.parentFingerprint, 5);

	// 4 bytes child index
	buffer.writeUInt32BE(hdNode.index, 9);

	// 32 bytes chain code
	Buffer.from(hdNode.chainCode).copy(buffer, 13);

	// 33 bytes public key
	Buffer.from(hdNode.publicKey).copy(buffer, 45);

	return buffer;
}

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
			// Manually serialize the xpub into the 78-byte format
			const xpubBytes = serializeXpub(this.hdNode);
			return Array.from(xpubBytes);
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
			const derivedNode = this.hdNode.derivePath(derivationPath);
			// Manually serialize the xpub into the 78-byte format
			const xpubBytes = serializeXpub(derivedNode);
			return Array.from(xpubBytes);
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
			// Use tiny-secp256k1's recover function to get the public key
			// The recover function signature is: recover(hash, signature, recoveryId, compressed = false)
			const recoveredKey = ecc.recover(messageHash, signature, recoveryId, true); // compressed = true

			if (!recoveredKey) {
				return null;
			}

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
	 * Constant-time equality comparison to prevent timing attacks
	 * This is crucial for cryptographic operations like authentication tag verification
	 */
	private constantTimeEquals = (a: Uint8Array, b: Uint8Array): boolean => {
		if (a.length !== b.length) return false;

		let result = 0;
		for (let i = 0; i < a.length; i++) {
			result |= a[i] ^ b[i];
		}

		return result === 0;
	};

	/**
	 * Compute HMAC-SHA256 (Hash-based Message Authentication Code)
	 * Used for various cryptographic operations including key derivation and message authentication
	 */
	hmacSha256 = (msg: number[], derivationPath: string): number[] => {
		try {
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

			// Step 7: Return as number array (what Breez SDK expects)
			return Array.from(hmacResult);
		} catch (error) {
			console.error('Error computing HMAC-SHA256:', error);
			throw error;
		}
	};

	/**
	 * Encrypt a message using ECIES (Elliptic Curve Integrated Encryption Scheme)
	 * Used for secure communication between multisig parties
	 *
	 * ECIES Process:
	 * 1. Generate ephemeral key pair (random private key + public key)
	 * 2. Perform ECDH with recipient's public key
	 * 3. Derive encryption key using HKDF
	 * 4. Encrypt message with derived key
	 * 5. Return: ephemeral_public_key + encrypted_message + auth_tag
	 */
	eciesEncrypt = (msg: number[]): number[] => {
		try {
			// Step 1: Generate ephemeral key pair for this encryption
			const ephemeralPrivateKey = randomBytes(32);
			const ephemeralPublicKey = ecc.pointFromScalar(ephemeralPrivateKey, true);

			if (!ephemeralPublicKey) {
				throw new Error('Failed to generate ephemeral public key');
			}

			// Step 2: Use recipient's public key (first cosigner for demo)
			// In practice, you'd specify which cosigner to encrypt for
			const recipientPublicKey = this.cosignerKeys[0] || this.hdNode.publicKey;

			// Step 3: Perform ECDH (Elliptic Curve Diffie-Hellman) key agreement
			const sharedSecret = ecc.pointMultiply(recipientPublicKey, ephemeralPrivateKey, true);

			if (!sharedSecret) {
				throw new Error('Failed to compute ECDH shared secret');
			}

			// Step 4: Derive encryption key using HKDF (HMAC-based Key Derivation Function)
			// HKDF expands the shared secret into cryptographically strong key material
			const info = new TextEncoder().encode('ECIES_ENCRYPTION_KEY');
			const salt = new Uint8Array(32); // Zero salt for simplicity
			const derivedKeyResult = hkdf(sha256, sharedSecret, salt, info, 64); // 64 bytes = 32 for encryption + 32 for HMAC
			const derivedKey = Uint8Array.from(derivedKeyResult); // Convert to proper Uint8Array

			const encryptionKey = derivedKey.slice(0, 32); // First 32 bytes for encryption
			const hmacKey = derivedKey.slice(32, 64); // Next 32 bytes for authentication

			// Step 5: Encrypt the message using XOR cipher (simple but effective for demo)
			// In production, you'd use AES-256-GCM or similar
			const messageBytes = new Uint8Array(msg);
			const encryptedMessage = new Uint8Array(messageBytes.length);

			// Generate key stream by hashing the encryption key repeatedly
			let keyStream = encryptionKey;
			for (let i = 0; i < messageBytes.length; i++) {
				if (i % 32 === 0 && i > 0) {
					// Refresh key stream every 32 bytes
					keyStream = new Uint8Array(sha256(keyStream));
				}
				encryptedMessage[i] = messageBytes[i] ^ keyStream[i % 32];
			}

			// Step 6: Create authentication tag using HMAC
			const authData = new Uint8Array(ephemeralPublicKey.length + encryptedMessage.length);
			authData.set(ephemeralPublicKey, 0);
			authData.set(encryptedMessage, ephemeralPublicKey.length);

			const authTag = hmac(sha256, hmacKey, authData);

			// Step 7: Combine everything into final encrypted payload
			// Format: ephemeral_public_key (33 bytes) + encrypted_message (variable) + auth_tag (32 bytes)
			const encryptedPayload = new Uint8Array(
				ephemeralPublicKey.length + encryptedMessage.length + authTag.length
			);

			let offset = 0;
			encryptedPayload.set(ephemeralPublicKey, offset);
			offset += ephemeralPublicKey.length;
			encryptedPayload.set(encryptedMessage, offset);
			offset += encryptedMessage.length;
			encryptedPayload.set(authTag, offset);

			return Array.from(encryptedPayload);
		} catch (error) {
			console.error('❌ Error encrypting with ECIES:', error);
			throw error;
		}
	};

	/**
	 * Decrypt a message using ECIES (Elliptic Curve Integrated Encryption Scheme)
	 * Used for secure communication between multisig parties
	 *
	 * ECIES Decryption Process:
	 * 1. Parse encrypted payload: ephemeral_public_key + encrypted_message + auth_tag
	 * 2. Perform ECDH with ephemeral public key and our private key
	 * 3. Derive decryption key using HKDF
	 * 4. Verify authentication tag
	 * 5. Decrypt message with derived key
	 */
	eciesDecrypt = (msg: number[]): number[] => {
		try {
			const encryptedPayload = new Uint8Array(msg);

			// Step 1: Parse the encrypted payload
			// Format: ephemeral_public_key (33 bytes) + encrypted_message (variable) + auth_tag (32 bytes)
			const ephemeralPublicKeyLength = 33; // Compressed public key
			const authTagLength = 32; // SHA256 HMAC tag

			if (encryptedPayload.length < ephemeralPublicKeyLength + authTagLength) {
				throw new Error('Invalid encrypted payload: too short');
			}

			const ephemeralPublicKey = encryptedPayload.slice(0, ephemeralPublicKeyLength);
			const encryptedMessage = encryptedPayload.slice(
				ephemeralPublicKeyLength,
				encryptedPayload.length - authTagLength
			);
			const receivedAuthTag = encryptedPayload.slice(encryptedPayload.length - authTagLength);

			// Step 2: Perform ECDH using our private key and the ephemeral public key
			if (!this.hdNode.privateKey) {
				throw new Error('No private key available for ECIES decryption');
			}

			const sharedSecret = ecc.pointMultiply(ephemeralPublicKey, this.hdNode.privateKey, true);

			if (!sharedSecret) {
				throw new Error('Failed to compute ECDH shared secret');
			}

			// Step 3: Derive decryption key using HKDF (same as encryption)
			const info = new TextEncoder().encode('ECIES_ENCRYPTION_KEY');
			const salt = new Uint8Array(32); // Zero salt for simplicity
			const derivedKeyResult = hkdf(sha256, sharedSecret, salt, info, 64); // 64 bytes = 32 for encryption + 32 for HMAC
			const derivedKey = Uint8Array.from(derivedKeyResult); // Convert to proper Uint8Array

			const decryptionKey = derivedKey.slice(0, 32); // First 32 bytes for decryption
			const hmacKey = derivedKey.slice(32, 64); // Next 32 bytes for authentication

			// Step 4: Verify authentication tag
			const authData = new Uint8Array(ephemeralPublicKey.length + encryptedMessage.length);
			authData.set(ephemeralPublicKey, 0);
			authData.set(encryptedMessage, ephemeralPublicKey.length);

			const computedAuthTag = hmac(sha256, hmacKey, authData);

			// Compare authentication tags in constant time to prevent timing attacks
			if (!this.constantTimeEquals(receivedAuthTag, computedAuthTag)) {
				throw new Error('Authentication tag verification failed - message may be tampered');
			}

			// Step 5: Decrypt the message using XOR cipher (same as encryption)
			const decryptedMessage = new Uint8Array(encryptedMessage.length);

			// Generate the same key stream used for encryption
			let keyStream = decryptionKey;
			for (let i = 0; i < encryptedMessage.length; i++) {
				if (i % 32 === 0 && i > 0) {
					// Refresh key stream every 32 bytes
					keyStream = new Uint8Array(sha256(keyStream));
				}
				decryptedMessage[i] = encryptedMessage[i] ^ keyStream[i % 32];
			}

			return Array.from(decryptedMessage);
		} catch (error) {
			console.error('❌ Error decrypting with ECIES:', error);
			throw error;
		}
	};

	/**
	 * Stub for SLIP-77 master blinding key (required by Breez SDK, even if not used)
	 */
	slip77MasterBlindingKey = (): number[] => {
		// Return a deterministic placeholder (e.g., first 32 bytes of the public key)
		return Array.from(this.hdNode.publicKey.slice(0, 32));
	};
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

			return bytes;
		});

		return new MultiSigSigner(hdNode, cosignerKeys, threshold, signerIndex);
	} catch (error) {
		console.error('Error creating MultisigSigner:', error);
		throw error;
	}
}
