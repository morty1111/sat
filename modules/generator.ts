import * as bip39 from 'bip39';
import * as bitcoin from "bitcoinjs-lib";
import BIP32Factory from "bip32";
import * as ecc from "tiny-secp256k1";
import {initEccLib, networks} from "bitcoinjs-lib";
import ECPairFactory from "ecpair";
import * as fs from "fs";
import * as fastcsv from 'fast-csv';
import {walletsGenerator} from "../data/project.config";
import {log} from "../utils/logger";

initEccLib(ecc);

const network: bitcoin.networks.Network = networks.bitcoin;

const ECPair = ECPairFactory(ecc);
const bip32 = BIP32Factory(ecc);

interface Wallet {
    mnemonic: string;
    address: string;
}

async function generator(): Promise<void> {
    const wallets: Wallet[] = [];

    for (let i = 0; i < walletsGenerator.quantityWallets; i++) {
        const mnemonic = bip39.generateMnemonic();
        const seed = bip39.mnemonicToSeedSync(mnemonic);

        const root = bip32.fromSeed(seed);
        const ecPair = ECPair.fromPrivateKey(
            root.derivePath("m/86'/0'/0'/0/0").privateKey!,
            {network}
        );

        const {address} = bitcoin.payments.p2tr({
            internalPubkey: ecPair.publicKey.subarray(1, 33),
            network,
        });

        wallets.push({
            mnemonic,
            address: address!,
        });
    }

    const timestamp = Date.now();
    const filePath = `wallets_${timestamp}.csv`;

    const ws = fs.createWriteStream(`logs/${filePath}`);
    await new Promise((resolve, reject) => {
        fastcsv
            .write(wallets, {headers: true})
            .pipe(ws)
            .on('finish', () => resolve(true))
            .on('error', (error) => reject(error));
    });

    log("info", `CSV file with created wallets successfully created: ${filePath}\n`)
}

if (require.main === module) {
    generator().catch(err => {
        console.error("Error:", err);
        process.exit(1);
    });
}
