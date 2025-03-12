import * as bitcoin from "bitcoinjs-lib";
import * as bitcoinMessage from "bitcoinjs-message";
import {crypto, initEccLib, networks, payments, Psbt} from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import * as bip39 from "bip39";
import BIP32Factory, {type BIP32Interface} from "bip32";
import ECPairFactory, {type ECPairInterface, Signer} from "ecpair";
import {Signer as BTCSigner} from "bitcoinjs-lib/src/psbt";
import {getProxy, mempoolChecker, sleep, toXOnly} from "./common";
import {getUTXO} from "../modules/utxo";
import {log} from "./logger";
import axios from "axios";
import {projectConfig} from "../data/project.config";

initEccLib(ecc);

const ECPair = ECPairFactory(ecc);
const bip32 = BIP32Factory(ecc);

export interface IProxy {
    ip: string;
    port: number;
    username: string;
    password: string;
}

interface IWallet {
    seed: string;
    proxy: IProxy | boolean;
}

export class Wallet {
    private path = "m/86'/0'/0'/0/0";
    public network: bitcoin.networks.Network = networks.bitcoin;
    public ecPair: ECPairInterface;
    public address: string;
    public output: Buffer;
    public publicKey: string;
    private bip32: BIP32Interface | undefined;
    public tweakedSigner: Signer;
    public proxy: IProxy | boolean;
    public session: string | null;

    constructor(walletParam: IWallet) {
        const connect = walletParam.seed;
        this.proxy = walletParam.proxy;

        if (bip39.validateMnemonic(connect)) {
            if (!bip39.validateMnemonic(connect)) {
                throw new Error("invalid mnemonic");
            }

            this.bip32 = bip32.fromSeed(
                bip39.mnemonicToSeedSync(connect),
                this.network
            );
            this.ecPair = ECPair.fromPrivateKey(
                this.bip32.derivePath(this.path).privateKey!,
                {network: this.network}
            );
        } else {
            this.ecPair = ECPair.fromWIF(connect, this.network);
        }
        const {address, output} = bitcoin.payments.p2tr({
            internalPubkey: this.ecPair.publicKey.subarray(1, 33),
            network: this.network,
        });
        this.address = address as string;
        this.output = output as Buffer;
        this.publicKey = this.ecPair.publicKey.toString("hex");
        this.tweakedSigner = this.tweakSigner(this.ecPair, this.network);
        this.session = null;

    }

    async makeTransaction(payAddress: string, amount: number, minerFee: number) {
        const network = this.network;

        const taprootAddress = payments.p2tr({
            pubkey: toXOnly(this.tweakedSigner.publicKey),
            network,
        });

        const utxos = await getUTXO(taprootAddress.address as string, this.proxy)
        const filteredUtxos = utxos.filter((utxo) => utxo.value > amount + (154 * minerFee));

        const balanceData = await mempoolChecker(taprootAddress.address as string, this.proxy);
        const balance = balanceData?.chain_stats?.funded_txo_sum - balanceData?.chain_stats?.spent_txo_sum;

        if (filteredUtxos.length > 0) {
            const psbt = new Psbt({network});

            psbt.addInput({
                hash: filteredUtxos[0].txid,
                index: filteredUtxos[0].vout,
                witnessUtxo: {value: filteredUtxos[0].value, script: taprootAddress.output!},
                tapInternalKey: toXOnly(this.ecPair.publicKey),
            });

            psbt.addOutput({
                address: payAddress,
                value: amount,
            });


            psbt.addOutput({
                address: taprootAddress.address as string,
                value: filteredUtxos[0].value - amount - (154 * minerFee),
            });

            return await this.signAndSend(this.tweakedSigner, psbt)
        } else {
            log("error", `Insufficient funds to complete the transaction | balance: ${balance}`);
            return;
        }
    }

    async signAndSend(keyPair: BTCSigner, psbt: Psbt): Promise<any> {
        psbt.signInput(0, keyPair);
        psbt.finalizeAllInputs();
        console.log(psbt.extractTransaction().toHex())

        await this.pushTx(psbt.extractTransaction().toHex())
    }

    async pushTx(tx: string) {
        try {
            const url = projectConfig.network === "mainnet" ? "https://mempool.space/" : "https://mempool.fractalbitcoin.io/"

            const response = await axios.post(
                `${url}api/tx`,
                tx,
                {
                    headers: {"Content-Type": "text/plain; charset=utf-8"},
                    httpsAgent: getProxy(this.proxy),
                    httpAgent: getProxy(this.proxy),
                }
            );

            log("info", `Transaction is successfully: ${url}tx/${response.data}`)
        } catch (error) {
            log("error", `Error push transaction: ${(error as Error).message}`);
            await sleep([5, 5])
            await this.pushTx(tx)
        }
    }

    tapTweakHash(pubKey: Buffer, h: Buffer | undefined): Buffer {
        return crypto.taggedHash(
            "TapTweak",
            Buffer.concat(h ? [pubKey, h] : [pubKey])
        );
    }

    tweakSigner(signer: BTCSigner, opts: any = {}): BTCSigner {
        let privateKey: Uint8Array | undefined = this.ecPair.privateKey!;
        if (!privateKey) {
            throw new Error("Private key is required for tweaking signer!");
        }
        if (signer.publicKey[0] === 3) {
            privateKey = ecc.privateNegate(privateKey);
        }

        const tweakedPrivateKey = ecc.privateAdd(
            privateKey,
            this.tapTweakHash(toXOnly(signer.publicKey), opts.tweakHash)
        );
        if (!tweakedPrivateKey) {
            throw new Error("Invalid tweaked private key!");
        }

        return ECPair.fromPrivateKey(Buffer.from(tweakedPrivateKey), {
            network: opts.network,
        });
    }

    signMessage(message: string) {
        const signature = bitcoinMessage.sign(message, this.ecPair.privateKey!, this.ecPair.compressed)
        return signature.toString('base64')
    }

}
