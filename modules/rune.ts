import {IProxy, Wallet} from "../utils/wallet";

import {
    gasChecker,
    generateRandomWord,
    getRandomElements,
    sleep,
} from '../utils/common';
import {configRunes, projectConfig} from "../data/project.config";
import {log} from "../utils/logger";
import {createOrderRune, deployOrderRune, getAuthData, getRuneInfo, makeAuth} from "./unisat";

export async function mintRuneModule(walletProxyMap: { [wallet: string]: IProxy | boolean }): Promise<void> {
    for (const walletData in walletProxyMap) {
        const wallet = new Wallet({seed: walletData, proxy: walletProxyMap[walletData]});

        if (wallet.session === null) {
            const signMsg = await getAuthData(wallet.address, wallet.proxy, projectConfig.network)
            const sign = wallet.signMessage(signMsg)

            const status = await makeAuth(wallet.address, wallet.publicKey, wallet.proxy, sign)

            wallet.session = status.data.session
        }

        if (wallet.session != null) {
            const runesForMint = getRandomElements(configRunes.runesMint, configRunes.quantityRunesMint[0], configRunes.quantityRunesMint[1]);

            for (const rune of runesForMint) {
                const runeInfo = await getRuneInfo(rune.runeID, wallet.proxy, wallet.session);

                if (runeInfo?.data) {
                    const runeName = runeInfo["data"]["rune"];

                    log("info", `Make mint ${rune.count} rune "${runeName}" | ${wallet.address}`);

                    let result = await createOrderRune(rune, wallet.address, wallet.proxy, wallet.session);

                    if (result?.data?.payAddress) {
                        await gasChecker(wallet.proxy);
                        await wallet.makeTransaction(result["data"]["payAddress"], result["data"]["amount"], result["data"]["feeRate"]);
                    } else {
                        log("error", `Mint error: ${result?.msg} | ${wallet.address}`);
                    }
                } else {
                    log("error", `Rune ${rune.runeID} not found | ${wallet.address}`);
                }
                await sleep(configRunes.sleep);
            }
            await sleep(projectConfig.sleep);
        }
    }
}

export async function deployRuneModule(walletProxyMap: { [wallet: string]: IProxy | boolean }): Promise<void> {
    for (const walletData in walletProxyMap) {
        const wallet = new Wallet({seed: walletData, proxy: walletProxyMap[walletData]});

        const runeName = await generateRandomWord(12, 20);

        if (wallet.session === null) {
            const signMsg = await getAuthData(wallet.address, wallet.proxy, projectConfig.network)
            const sign = wallet.signMessage(signMsg)

            const status = await makeAuth(wallet.address, wallet.publicKey, wallet.proxy, sign)

            wallet.session = status.data.session
        }

        if (wallet.session != null) {
            const runeInfo = await getRuneInfo(runeName, wallet.proxy, wallet.session);

            if (runeInfo?.data == null) {
                log("info", `Make deploy rune "${runeName}" | ${wallet.address}`);

                let result = await deployOrderRune(runeName, wallet.address, wallet.proxy, wallet.session);

                if (result?.data?.payAddress) {
                    await gasChecker(wallet.proxy);
                    await wallet.makeTransaction(result["data"]["payAddress"], result["data"]["amount"], result["data"]["feeRate"]);
                } else {
                    log("error", `Deploy error: ${result?.msg} | ${wallet.address}`);
                }
            } else {
                log("error", `The rune ${runeName} already exists | ${wallet.address}`);

                await deployRuneModule(walletProxyMap);
            }
            await sleep(configRunes.sleep);
        }
    }
}
