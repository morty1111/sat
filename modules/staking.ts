import {IProxy, Wallet} from "../utils/wallet";

import {sleep} from '../utils/common';
import {configVoting, projectConfig} from "../data/project.config";
import {log} from "../utils/logger";
import {getAuthData, getVotePower, makeAuth, makePsbtStake, makeSignVote, makeStake, makeVote} from "./unisat";
import {Psbt} from "bitcoinjs-lib";

export async function stakeModule(walletProxyMap: { [wallet: string]: IProxy | boolean }): Promise<void> {
    for (const walletData in walletProxyMap) {
        const wallet = new Wallet({seed: walletData, proxy: walletProxyMap[walletData]});

        if (wallet.session === null) {
            const signMsg = await getAuthData(wallet.address, wallet.proxy, projectConfig.network)
            const sign = wallet.signMessage(signMsg)

            const status = await makeAuth(wallet.address, wallet.publicKey, wallet.proxy, sign)

            wallet.session = status.data.session
        }

        if (wallet.session != null) {
            const randomValue = Math.random() * (configVoting.amount[1] - configVoting.amount[0]) + configVoting.amount[0];

            const decimalPlaces = Math.floor(Math.random() * (configVoting.decimals[1] - configVoting.decimals[0] + 1)) + configVoting.decimals[0];

            const roundedValue = Number(randomValue.toFixed(decimalPlaces));

            log("info", `Make stake ${roundedValue} $FB | ${wallet.address}`);

            const stakeData = await makeStake(wallet.address, wallet.publicKey, Math.round(roundedValue * 100_000_000), wallet.proxy, wallet.session)

            if (stakeData?.data) {
                const psbt = Psbt.fromHex(stakeData.data.psbtHex);
                psbt.signAllInputs(wallet.tweakedSigner)

                const psbtHex = psbt.toHex()

                psbt.finalizeAllInputs();

                await wallet.pushTx(psbt.extractTransaction().toHex())

                await sleep([5, 10])

                const stakePsbtData = await makePsbtStake(wallet.address, wallet.publicKey, Math.round(roundedValue * 100_000_000), psbtHex, wallet.proxy, wallet.session)

                if (stakePsbtData.code != 0) {
                    log("error", `Make stake error: ${stakeData.msg} | ${wallet.address}`)
                }
            } else {
                log("error", `Make stake error: ${stakeData.msg} | ${wallet.address}`)
            }
        }
        await sleep(projectConfig.sleep);
    }
}

export async function voteModule(walletProxyMap: { [wallet: string]: IProxy | boolean }): Promise<void> {
    for (const walletData in walletProxyMap) {
        const wallet = new Wallet({seed: walletData, proxy: walletProxyMap[walletData]});

        if (wallet.session === null) {
            const signMsg = await getAuthData(wallet.address, wallet.proxy, projectConfig.network)
            const sign = wallet.signMessage(signMsg)

            const status = await makeAuth(wallet.address, wallet.publicKey, wallet.proxy, sign)

            wallet.session = status.data.session
        }

        if (wallet.session != null) {
            log("info", `Make vote on Fractal | ${wallet.address}`);

            const votePowerData = await getVotePower(wallet.address, configVoting.voteId, wallet.proxy, wallet.session)

            if (votePowerData.code != 0) {
                log("error", `Make vote error: ${votePowerData.msg} | ${wallet.address}`)
                continue
            }

            if (votePowerData.data.availableAmount == 0) {
                log("error", `Not enough power: ${votePowerData.data.availableAmount} | ${wallet.address}`)
                continue
            }

            const voteOptionRandom = Math.floor(Math.random() * (configVoting.optionId[1] - configVoting.optionId[0] + 1)) + configVoting.optionId[0]

            const vote = await makeVote(wallet.address, wallet.publicKey, votePowerData.data.availableAmount, voteOptionRandom, configVoting.voteId, wallet.proxy, wallet.session)

            const signMessage = wallet.signMessage(vote.data.message)

            const voteData = await makeSignVote(wallet.address, wallet.publicKey, votePowerData.data.availableAmount, voteOptionRandom, configVoting.voteId, vote.data.nonce, signMessage, wallet.proxy, wallet.session)

            if (voteData != 0) {
                log("error", `Error: ${voteData.msg} | ${wallet.address}`)
                continue
            }

        }
        await sleep(projectConfig.sleep);
    }
}
