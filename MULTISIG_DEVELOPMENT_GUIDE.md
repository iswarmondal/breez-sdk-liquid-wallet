# Multisig Wallet Development Guide

## 🎯 Overview

This guide walks you through implementing multisig (multi-signature) wallet functionality using the Breez SDK with a custom signer. The foundation has been laid, but several components need to be completed for production use.

## 📁 Files Created/Modified

1. **`src/lib/services/customSigner.ts`** - Custom signer implementation
2. **`src/lib/services/walletService.ts`** - Updated to support multisig
3. **`src/lib/components/MultisigSetup.svelte`** - UI for multisig setup
4. **`MULTISIG_DEVELOPMENT_GUIDE.md`** - This guide

## 🏗️ Current Implementation Status

### ✅ Completed

- Basic custom signer structure implementing the Breez SDK `Signer` interface
- Wallet service methods for multisig initialization
- Configuration storage/retrieval
- UI component for multisig setup
- Integration with existing Breez SDK workflow

### ⚠️ TODO (Critical for Production)

#### 1. Cryptographic Functions (HIGH PRIORITY)

The current implementation has placeholder functions that need proper cryptographic implementations:

```typescript
// In customSigner.ts - these need real implementations:

xpub(); // Derive extended public key from master key
deriveXpub(path); // BIP32 key derivation
signEcdsa(msg, path); // ECDSA signing with private key
signEcdsaRecoverable(msg); // Recoverable ECDSA signing
slip77MasterBlindingKey(); // SLIP-77 blinding key derivation
hmacSha256(msg, path); // HMAC-SHA256 computation
eciesEncrypt(msg); // ECIES encryption
eciesDecrypt(msg); // ECIES decryption
```

**Recommended Libraries:**

- `bitcoinjs-lib` - Bitcoin cryptographic functions
- `@noble/secp256k1` - Elliptic curve operations
- `@noble/hashes` - Hash functions
- `bip39` - Mnemonic handling
- `bip32` - HD key derivation

#### 2. Multisig Coordination (HIGH PRIORITY)

Currently, signature collection is simulated. You need to implement:

- **Communication Protocol**: How signers coordinate
- **Signature Collection**: Gather signatures from other parties
- **Transaction Broadcasting**: Combine signatures and broadcast

**Options for Implementation:**

1. **API-based**: Each signer runs a server with signing endpoints
2. **File-based**: Share partial signatures via files/QR codes
3. **Hardware Wallet**: Integration with hardware signers
4. **GUI-based**: Manual signature input interface

#### 3. Key Management Security

**Current Issues:**

- Master keys stored in memory (not secure)
- No encryption at rest
- Basic mnemonic-to-key conversion

**Improvements Needed:**

- Secure key storage (encrypted localStorage/IndexedDB)
- Key derivation using proper BIP39/BIP32
- Optional hardware wallet integration

## 🚀 Getting Started - Next Steps

### Step 1: Install Cryptographic Dependencies

```bash
bun add bitcoinjs-lib @noble/secp256k1 @noble/hashes bip39 bip32
bun add -d @types/bitcoin
```

### Step 2: Implement Key Derivation

Replace the placeholder functions in `customSigner.ts`:

```typescript
import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import * as bip32 from 'bip32';

export class MultiSigSigner implements breezSdk.Signer {
	private hdNode: bip32.BIP32Interface;

	constructor(mnemonic: string /* other params */) {
		// Convert mnemonic to seed
		const seed = bip39.mnemonicToSeedSync(mnemonic);

		// Create HD node
		this.hdNode = bip32.fromSeed(seed);
	}

	xpub = (): number[] => {
		return Array.from(this.hdNode.publicKey);
	};

	deriveXpub = (derivationPath: string): number[] => {
		const derived = this.hdNode.derivePath(derivationPath);
		return Array.from(derived.publicKey);
	};

	// Implement other methods...
}
```

### Step 3: Design Multisig Coordination

Choose your coordination method:

#### Option A: API-Based Coordination

```typescript
// Example structure for API-based signing
class ApiMultisigCoordinator {
	async requestSignature(signerUrl: string, transaction: any): Promise<string> {
		const response = await fetch(`${signerUrl}/sign`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ transaction })
		});

		const { signature } = await response.json();
		return signature;
	}
}
```

#### Option B: File/QR Code Based

```typescript
// Generate partial signature file
class FileMultisigCoordinator {
	exportPartialSignature(signature: string, transactionId: string) {
		const data = {
			transactionId,
			signature,
			signerIndex: this.signerIndex,
			timestamp: Date.now()
		};

		// Export as JSON file or QR code
		return JSON.stringify(data);
	}

	importPartialSignature(data: string) {
		return JSON.parse(data);
	}
}
```

### Step 4: Test the Implementation

Create test cases:

```typescript
// tests/multisig.test.ts
import { MultiSigSigner } from '../src/lib/services/customSigner';

describe('MultiSig Signer', () => {
	test('should derive consistent public keys', () => {
		const mnemonic = 'abandon abandon abandon...';
		const signer = new MultiSigSigner(mnemonic, [], 2, 0);

		const xpub1 = signer.xpub();
		const xpub2 = signer.xpub();

		expect(xpub1).toEqual(xpub2);
	});

	test('should sign messages correctly', () => {
		// Test ECDSA signing
	});
});
```

## 🔐 Security Considerations

### Key Storage

- **Development**: Use encrypted localStorage
- **Production**: Consider hardware security modules (HSM)
- **Mobile**: Use device keychain/keystore

### Communication Security

- Use HTTPS for all API communications
- Implement message authentication (HMAC)
- Consider end-to-end encryption for sensitive data

### Audit Requirements

- Test all cryptographic functions thoroughly
- Consider professional security audit before mainnet use
- Implement comprehensive logging for debugging

## 📖 Understanding Multisig Concepts

### Key Terms

- **Threshold**: Minimum signatures required (e.g., 2 in "2-of-3")
- **Cosigners**: Other parties in the multisig setup
- **Derivation Path**: BIP32 path for key generation (e.g., "m/44'/0'/0'/0/0")
- **xpub**: Extended public key (can derive child public keys)

### Common Multisig Patterns

- **2-of-2**: Joint custody (both parties must sign)
- **2-of-3**: You + trusted party + recovery key
- **3-of-5**: Corporate treasury (3 executives out of 5)

### Transaction Flow

1. Create transaction proposal
2. Each required signer reviews and signs
3. Collect enough signatures (meet threshold)
4. Combine signatures and broadcast transaction

## 🛠️ Testing Your Implementation

### Unit Tests

```bash
bun test
```

### Integration Testing

1. Create multiple signer instances
2. Test key derivation consistency
3. Test signature collection
4. Test transaction creation/signing

### Manual Testing

1. Set up 2-of-3 multisig using the UI component
2. Create a test transaction
3. Collect signatures from multiple parties
4. Verify transaction broadcasts successfully

## 📚 Additional Resources

### Documentation

- [BIP32 - Hierarchical Deterministic Wallets](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)
- [BIP39 - Mnemonic Code](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki)
- [Breez SDK Documentation](https://sdk-doc-liquid.breez.technology/)

### Libraries Documentation

- [bitcoinjs-lib](https://github.com/bitcoinjs/bitcoinjs-lib)
- [Noble cryptography](https://github.com/paulmillr/noble-secp256k1)

## 🎯 Next Actions

1. **Install Dependencies** (30 min)
2. **Implement Key Derivation** (2-4 hours)
3. **Choose Coordination Method** (1-2 hours planning)
4. **Implement Signature Collection** (1-2 days)
5. **Add Security Measures** (1 day)
6. **Testing & Validation** (2-3 days)

## 💡 Pro Tips

1. **Start Simple**: Begin with 2-of-2 multisig before attempting complex setups
2. **Test on Testnet**: Always test thoroughly before using real funds
3. **Document Everything**: Keep detailed records of your multisig setup
4. **Backup Strategy**: Ensure you have recovery mechanisms for all keys
5. **Stay Updated**: Keep cryptographic libraries updated for security

## 🤝 Getting Help

If you get stuck on any cryptographic implementations:

1. Check the library documentation first
2. Look for examples in the bitcoinjs-lib test files
3. Consider reaching out to Bitcoin development communities
4. Test everything extensively on testnet

Remember: Multisig wallet development involves handling real money and security - take your time and test thoroughly!
