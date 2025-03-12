import {IProxy, Wallet} from "../utils/wallet";

import {
    gasChecker,
    generateRandomWord,
    getRandomElements,
    getRandomFilesInBase64AndDelete,
    sleep
} from '../utils/common';
import {configFiles, configInscription, projectConfig} from "../data/project.config";
import {log} from "../utils/logger";
import {createOrderInscription, getAuthData, getInscriptionFractalInfo, getInscriptionInfo, makeAuth} from "./unisat";

export async function mintInscriptionModule(walletProxyMap: { [wallet: string]: IProxy | boolean }): Promise<void> {
    for (const walletData in walletProxyMap) {
        const wallet = new Wallet({seed: walletData, proxy: walletProxyMap[walletData]});

        if (wallet.session === null) {
            const signMsg = await getAuthData(wallet.address, wallet.proxy, projectConfig.network)
            const sign = wallet.signMessage(signMsg)

            const status = await makeAuth(wallet.address, wallet.publicKey, wallet.proxy, sign)

            wallet.session = status.data.session
        }

        if (wallet.session != null) {
            const inscriptionForMint = getRandomElements(configInscription.inscriptionMint, configInscription.quantityMint[0], configInscription.quantityMint[1]);

            for (const inscription of inscriptionForMint) {
                const inscriptionInfo = projectConfig.network === "mainnet" ? await getInscriptionInfo(inscription.name, wallet.proxy, wallet.session) : await getInscriptionFractalInfo(inscription.name, wallet.proxy, wallet.session)

                if (inscriptionInfo?.data) {
                    log("info", `Make mint ${inscription.amount} inscription "${inscriptionInfo["data"]["ticker"]}" | ${wallet.address}`);

                    const code = `{"p":"brc-20","op":"mint","tick":"${inscription.name}","amt":"${inscription.amount}"}`;

                    const files = []

                    for (let i = 0; i < inscription.count; i++) {
                        files.push({
                            dataURL: `data:text/plain;charset=utf-8;base64,${btoa(code)}`,
                            filename: code
                        });
                    }

                    let result = await createOrderInscription(files, inscription.price, wallet.address, wallet.proxy, wallet.session);

                    if (result?.data?.payAddress) {
                        await gasChecker(wallet.proxy);
                        await wallet.makeTransaction(result["data"]["payAddress"], result["data"]["amount"], result["data"]["feeRate"]);
                    } else {
                        log("error", `Mint error: ${result?.msg} | ${wallet.address}`);
                    }
                } else {
                    log("error", `Inscription ${inscription.name} not found | ${wallet.address}`);
                }
                await sleep(configInscription.sleep);
            }
            await sleep(projectConfig.sleep);
        }
    }
}

export async function deployInscriptionModule(walletProxyMap: { [wallet: string]: IProxy | boolean }): Promise<void> {
    for (const walletData in walletProxyMap) {
        const wallet = new Wallet({seed: walletData, proxy: walletProxyMap[walletData]});

        const inscriptionName = projectConfig.network === "mainnet" ? await generateRandomWord(configInscription.inscriptionDeployBytes, configInscription.inscriptionDeployBytes) : await generateRandomWord(7, 11);

        if (wallet.session === null) {
            const signMsg = await getAuthData(wallet.address, wallet.proxy, projectConfig.network)
            const sign = wallet.signMessage(signMsg)

            const status = await makeAuth(wallet.address, wallet.publicKey, wallet.proxy, sign)

            wallet.session = status.data.session
        }

        if (wallet.session != null) {
            const inscriptionInfo = projectConfig.network === "mainnet" ? await getInscriptionInfo(inscriptionName, wallet.proxy, wallet.session) : await getInscriptionFractalInfo(inscriptionName, wallet.proxy, wallet.session)

            if (inscriptionInfo?.data === null) {
                log("info", `Make deploy inscription "${inscriptionName}" | ${wallet.address}`);

                let code = ""

                if (projectConfig.network === "mainnet") {
                    code = configInscription.inscriptionDeployBytes === 5 ?
                        `{"p":"brc-20","op":"deploy","tick":"${inscriptionName}","lim":"1000","max":"21000000","self_mint":"true"}`
                        :
                        `{"p":"brc-20","op":"deploy","tick":"${inscriptionName}","lim":"1000","max":"21000000"}`;
                } else {
                    code = `{"p":"brc-20","op":"deploy","tick":"${inscriptionName}","lim":"1000","max":"21000000"}`;
                }

                const files = [
                    {
                        "dataURL": `data:text/plain;charset=utf-8;base64,${btoa(code)}`,
                        "filename": code
                    }
                ]

                let result = await createOrderInscription(files, configInscription.inscriptionDeployPrice, wallet.address, wallet.proxy, wallet.session);

                if (result?.data?.payAddress) {
                    await gasChecker(wallet.proxy);
                    await wallet.makeTransaction(result["data"]["payAddress"], result["data"]["amount"], result["data"]["feeRate"]);
                } else {
                    log("error", `Deploy error: ${result?.msg} | ${wallet.address}`);
                }
            } else {
                log("error", `The inscription ${inscriptionName} already exists | ${wallet.address}`);

                await deployInscriptionModule(walletProxyMap);
            }
            await sleep(configInscription.sleep);
        }
    }
}


export async function deployImageModule(walletProxyMap: { [wallet: string]: IProxy | boolean }): Promise<void> {
    for (const walletData in walletProxyMap) {
        const wallet = new Wallet({seed: walletData, proxy: walletProxyMap[walletData]});

        if (wallet.session === null) {
            const signMsg = await getAuthData(wallet.address, wallet.proxy, projectConfig.network)
            const sign = wallet.signMessage(signMsg)

            const status = await makeAuth(wallet.address, wallet.publicKey, wallet.proxy, sign)

            wallet.session = status.data.session
        }

        if (wallet.session != null) {
            log("info", `Make deploy NFT" | ${wallet.address}`);

            const allFiles = await getRandomFilesInBase64AndDelete(configFiles.quantityFilesForMint[0], configFiles.quantityFilesForMint[1])

            let files = [];

            for (const file of allFiles) {
                files.push({
                    dataURL: file.code,
                    filename: file.name
                });
            }

            let result = await createOrderInscription(files, configInscription.inscriptionDeployPrice, wallet.address, wallet.proxy, wallet.session);

            if (result?.data?.payAddress) {
                await gasChecker(wallet.proxy);
                await wallet.makeTransaction(result["data"]["payAddress"], result["data"]["amount"], result["data"]["feeRate"]);
            } else {
                log("error", `Deploy error: ${result?.msg} | ${wallet.address}`);
            }

            await sleep(configInscription.sleep);
        }
    }
}
