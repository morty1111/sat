import axios from "axios";
import {log} from "../utils/logger";
import {getProxy} from "../utils/common";
import {IProxy} from "../utils/wallet";
import {projectConfig} from "../data/project.config";

interface IUTXO {
    txid: string;
    vout: number;
    value: number;
}

export async function getUTXO(address: string, proxy: IProxy | boolean): Promise<IUTXO[]> {
    log("info", `Waiting till UTXO is detected at this Address: ${address}`);

    return new Promise<IUTXO[]>((resolve) => {
        const checkForUtxo = async () => {
            try {
                const url = projectConfig.network === "mainnet"
                    ? 'https://mempool.space'
                    : "https://mempool.fractalbitcoin.io";

                const axiosConfig: any = {
                    httpsAgent: getProxy(proxy),
                    httpAgent: getProxy(proxy),
                };

                const response = await axios.get(`${url}/api/address/${address}/utxo`, axiosConfig);

                const utxos: IUTXO[] = response.data.map((utxoData: any) => ({
                    txid: utxoData.txid,
                    vout: utxoData.vout,
                    value: utxoData.value,
                }));

                if (utxos.length > 0) {
                    resolve(utxos);
                } else {
                    setTimeout(checkForUtxo, 5000);
                }
            } catch (error) {
                log("error", `Error fetching address UTXO: ${(error as Error).message}`);
                setTimeout(checkForUtxo, 5000);
            }
        };

        checkForUtxo();
    });
}

