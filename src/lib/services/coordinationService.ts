import { networks, Psbt, address as liquidAddress, payments } from 'liquidjs-lib';
import type { MultiSigSigner } from './customSigner';
import { sha256 } from '@noble/hashes/sha2';

class CoordinationService {
	private signer: MultiSigSigner | null = null;
	private network = networks.testnet;

	setSigner(signer: MultiSigSigner) {
		this.signer = signer;
	}

	createPsbt = async (params: {
		pubkeys: Buffer[];
		threshold: number;
		outputs: { address: string; value: number }[];
	}): Promise<string> => {
		const { pubkeys, threshold, outputs } = params;

		const p2ms = payments.p2ms({ m: threshold, pubkeys, network: this.network });
		const p2wsh = payments.p2wsh({ redeem: p2ms, network: this.network });
		const address = p2wsh.address!;

		console.log(`Created ${threshold}-of-${pubkeys.length} multisig address: ${address}`);

		const utxos = await this.fetchUtxos(address);
		if (utxos.length === 0) {
			throw new Error(
				'No UTXOs found for the multisig address. Please send some funds to it first.'
			);
		}

		const psbt = new Psbt({ network: this.network });

		let totalInput = 0;
		utxos.forEach((utxo) => {
			psbt.addInput({
				hash: utxo.txid,
				index: utxo.vout,
				witnessUtxo: {
					script: p2wsh.output!,
					value: utxo.value,
					asset: this.network.assetHash,
					nonce: Buffer.from('00', 'hex')
				},
				witnessScript: p2wsh.redeem?.output!
			});
			totalInput += utxo.value;
		});

		let totalOutput = 0;
		outputs.forEach((output) => {
			psbt.addOutput({
				address: output.address,
				value: output.value,
				asset: this.network.assetHash,
				nonce: Buffer.from('00', 'hex')
			});
			totalOutput += output.value;
		});

		const fee = totalInput - totalOutput;
		if (fee < 0) {
			throw new Error('Insufficient funds for transaction.');
		}

		psbt.addOutput({
			script: Buffer.alloc(0),
			value: fee,
			asset: this.network.assetHash,
			nonce: Buffer.from('00', 'hex')
		});

		return psbt.toBase64();
	};

	private fetchUtxos = async (
		address: string
	): Promise<{ txid: string; vout: number; value: number }[]> => {
		try {
			const url = `https://blockstream.info/liquidtestnet/api/address/${address}/utxo`;
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`Failed to fetch UTXOs: ${response.statusText}`);
			}
			const utxos = await response.json();
			return utxos.map((utxo: any) => ({
				txid: utxo.txid,
				vout: utxo.vout,
				value: utxo.value
			}));
		} catch (error) {
			console.error('Error fetching UTXOs:', error);
			return [];
		}
	};

	extractPsbtDetails = (
		psbtBase64: string
	): { inputs: any[]; outputs: any[]; signedBy: string[] } => {
		const psbt = Psbt.fromBase64(psbtBase64, { network: this.network });

		const inputs = psbt.txInputs.map((input) => ({
			txid: Buffer.from(input.hash).reverse().toString('hex'),
			vout: input.index
		}));

		const outputs = psbt.txOutputs.map((output) => ({
			address: liquidAddress.fromOutputScript(output.script, this.network),
			value: output.value
		}));

		const signedBy = psbt.data.inputs.reduce((acc, input, i) => {
			if (input.partialSig && input.partialSig.length > 0) {
				acc.push(`Signer of input ${i + 1}`);
			}
			return acc;
		}, [] as string[]);

		return { inputs, outputs, signedBy };
	};

	signPsbt = (psbtBase64: string): string => {
		if (!this.signer) {
			throw new Error('Signer not set. Cannot sign transaction.');
		}

		const psbt = Psbt.fromBase64(psbtBase64, { network: this.network });

		// @ts-ignore
		const hdNode = this.signer.hdNode;

		psbt.signAllInputs(hdNode);

		return psbt.toBase64();
	};

	finalizePsbt = (psbtBase64: string): string => {
		const psbt = Psbt.fromBase64(psbtBase64, { network: this.network });

		psbt.finalizeAllInputs();

		const txHex = psbt.extractTransaction().toHex();
		return txHex;
	};

	isPsbtReady(psbtBase64: string, threshold: number): boolean {
		const psbt = Psbt.fromBase64(psbtBase64, { network: this.network });
		const signatureCount = psbt.data.inputs.reduce((count, input) => {
			return count + (input.partialSig?.length || 0);
		}, 0);

		return signatureCount >= threshold;
	}
}

export const coordinationService = new CoordinationService();
