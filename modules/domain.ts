import {IProxy, Wallet} from "../utils/wallet";

import {
    gasChecker,
    getRandomElements, shuffleArray,
    sleep,
} from '../utils/common';
import {configDomains, projectConfig} from "../data/project.config";
import {log} from "../utils/logger";
import {createOrderInscription, getAuthData, getDomainInfo, makeAuth} from "./unisat";

export async function mintDomainModule(walletProxyMap: { [wallet: string]: IProxy | boolean }): Promise<void> {
    for (const walletData in walletProxyMap) {
        const wallet = new Wallet({seed: walletData, proxy: walletProxyMap[walletData]});

        if (wallet.session === null) {
            const signMsg = await getAuthData(wallet.address, wallet.proxy, projectConfig.network)
            const sign = wallet.signMessage(signMsg)

            const status = await makeAuth(wallet.address, wallet.publicKey, wallet.proxy, sign)

            wallet.session = status.data.session
        }

        if (wallet.session != null) {
            const domainsForMint = configDomains.mintAll ?
                configDomains.useDomain :
                getRandomElements(
                    configDomains.useDomain,
                    configDomains.quantityDomainMint[0],
                    configDomains.quantityDomainMint[1]
                )

            const shuffledDomains = shuffleArray(domainsForMint)

            for (const domain of shuffledDomains) {
                const name = await getDomainInfo(domain, wallet.proxy, wallet.session);

                log("info", `Make mint "${name}" domain | ${wallet.address}`);

                const code = `{"p":"sns","op":"reg","name":"${name}"}`;

                const files = [
                    {
                        "dataURL": `data:text/plain;charset=utf-8;base64,${btoa(code)}`,
                        "filename": code
                    }
                ]

                let result = await createOrderInscription(files, configDomains.domainMintPrice, wallet.address, wallet.proxy, wallet.session);

                if (result?.data?.payAddress) {
                    await gasChecker(wallet.proxy);
                    await wallet.makeTransaction(result["data"]["payAddress"], result["data"]["amount"], result["data"]["feeRate"]);
                } else {
                    log("error", `Mint error: ${result?.msg} | ${wallet.address}`);
                }
                await sleep(configDomains.sleep);
            }
            await sleep(projectConfig.sleep);
        }
    }
}


