import {createHash} from "crypto";
import {asciiToHex, generateRandomNumberString, getProxy, randomString, sleep, tokenData} from "../utils/common"
import axios from "axios";
import {log} from "../utils/logger";
import {fetchFees} from "./fee";
import {configRunes, projectConfig} from "../data/project.config";
import {IProxy} from "../utils/wallet";

export function signConverter(endpoint: string, body: any, session: string | null = null) {
    const ts = Math.floor(Date.now() / 1e3);

    const query = `${endpoint}\n${body}\n${ts}@#?.#@deda5ddd2b3d84988b2cb0a207c4674e`;

    const sign = createHash('md5').update(query).digest('hex');

    const token = (
        randomString(6, 6) + sign.substring(12, 14) +
        randomString(8, 8) + 'u' +
        randomString(8, 8)
    );

    let headers: Record<string, string | number> = {
        "x-sign": sign,
        "x-ts": ts,
        "cf-token": token,
        "x-appid": "1adcd7969603261753f1812c9461cd36"
    }

    if (session) {
        headers["unisat-session"] = session
    }

    return headers

}

export async function getAuthData(address: string, proxy: IProxy | boolean, net: string | null = null, attempts: number = 0): Promise<any> {
    const network = net === null ? projectConfig.network : net;
    const url = network === "mainnet" ? "https://api.unisat.space" : "https://fractal-api.unisat.io";
    const endpoint = `/basic-v4/base/preload?address=${address}`;

    const axiosConfig: any = {
        headers: signConverter(endpoint, ''),
        httpsAgent: getProxy(proxy),
        httpAgent: getProxy(proxy),
    };

    try {
        const response = await axios.get(`${url}${endpoint}`, axiosConfig);
        return response.data.data.signMsg;
    } catch (error) {
        if (attempts < projectConfig.retryCount) {
            log("error", `Attempt [${attempts + 1}/${projectConfig.retryCount}] failed: ${(error as Error).message}. Retrying...`);
            return getAuthData(address, proxy, net, attempts + 1);
        } else {
            log("error", `Failed to fetch auth data after [${attempts + 1}/${projectConfig.retryCount}] attempts.`);
        }
    }
}

export async function makeAuth(address: string, publicKey: string, proxy: IProxy | boolean, signMsg: string, net: string | null = null, attempts: number = 0) {
    const network = net === null ? projectConfig.network : net;
    const url = network === "mainnet" ? "https://api.unisat.space" : "https://fractal-api.unisat.io"
    const endpoint = "/basic-v4/base/login"

    const body = {
        "address": address,
        "pubkey": publicKey,
        "sign": signMsg,
        "walletType": "unisat"
    }

    log("info", `Try authorize wallet on Unisat | ${address}`)

    const axiosConfig: any = {
        headers: signConverter(endpoint, JSON.stringify(body)),
        httpsAgent: getProxy(proxy),
        httpAgent: getProxy(proxy),
    };

    try {
        const response = await axios.post(
            `${url}${endpoint}`,
            body,
            axiosConfig
        );
        return response.data
    } catch (error) {
        if (attempts < projectConfig.retryCount) {
            log("error", `Attempt [${attempts + 1}/${projectConfig.retryCount}] failed: ${(error as Error).message}. Retrying...`);
            return makeAuth(address, publicKey, proxy, signMsg, net, attempts + 1);
        } else {
            log("error", `Failed to fetch auth data after [${attempts + 1}/${projectConfig.retryCount}] attempts.`);
        }
    }
}

export async function createOrderInscription(files: any, amount: number, recipient: string, proxy: IProxy | boolean, sesssion: string, attempts: number = 0) {
    const url = projectConfig.network === "mainnet" ? "https://api.unisat.space" : "https://fractal-api.unisat.io"
    const endpoint = "/inscribe-v5/order/create"

    const currentFee = await fetchFees(proxy);
    const fee = projectConfig.useCustomGas && (currentFee > projectConfig.maxGas) ? projectConfig.customGas : currentFee

    const body = {
        "files": files,
        "receiver": recipient,
        "feeRate": fee,
        "outputValue": amount,
        "clientId": ""
    }

    const axiosConfig: any = {
        headers: signConverter(endpoint, JSON.stringify(body), sesssion),
        httpsAgent: getProxy(proxy),
        httpAgent: getProxy(proxy),
    };

    try {
        const response = await axios.post(
            `${url}${endpoint}`,
            body,
            axiosConfig
        );
        return response.data;
    } catch (error) {
        if (attempts < projectConfig.retryCount) {
            log("error", `Attempt [${attempts + 1}/${projectConfig.retryCount}] failed: ${(error as Error).message}. Retrying...`);
            return createOrderInscription(files, amount, recipient, proxy, sesssion, attempts + 1)
        } else {
            log("error", `Failed to fetch auth data after [${attempts + 1}/${projectConfig.retryCount}] attempts.`);
        }
    }
}

export async function createOrderRune(rune: any, recipient: string, proxy: IProxy | boolean, sesssion: string, attempts: number = 0) {
    const url = projectConfig.network === "mainnet" ? "https://api.unisat.space" : "https://fractal-api.unisat.io"
    const endpoint = "/inscribe-v5/order/create/runes-mint"

    const currentFee = await fetchFees(proxy);
    const fee = projectConfig.useCustomGas && (currentFee > projectConfig.maxGas) ? projectConfig.customGas : currentFee

    const body = {
        "receiver": recipient,
        "feeRate": fee,
        "outputValue": rune.price,
        "runeId": rune.runeID,
        "count": rune.count,
        "clientId": "",
    }

    const axiosConfig: any = {
        headers: signConverter(endpoint, JSON.stringify(body), sesssion),
        httpsAgent: getProxy(proxy),
        httpAgent: getProxy(proxy),
    };
    try {
        const response = await axios.post(
            `${url}${endpoint}`,
            body,
            axiosConfig
        );

        return response.data;
    } catch (error) {
        if (attempts < projectConfig.retryCount) {
            log("error", `Attempt [${attempts + 1}/${projectConfig.retryCount}]} failed: ${(error as Error).message}. Retrying...`);
            return createOrderRune(rune, recipient, proxy, sesssion, attempts + 1)
        } else {
            log("error", `Failed to fetch auth data after [${attempts + 1}/${projectConfig.retryCount}] attempts.`);
        }
    }
}

export async function deployOrderRune(rune: string, recipient: string, proxy: IProxy | boolean, sesssion: string, attempts: number = 0): Promise<any> {
    const url = projectConfig.network === "mainnet" ? "https://api.unisat.space" : "https://fractal-api.unisat.io"
    const endpoint = "/inscribe-v5/order/create/runes-etch"

    const currentFee = await fetchFees(proxy);
    const fee = projectConfig.useCustomGas && (currentFee > projectConfig.maxGas) ? projectConfig.customGas : currentFee

    const body = {
        "receiver": recipient,
        "feeRate": fee,
        "outputValue": configRunes.runeDeployPrice,
        "files": [
            {
                "runes_etch": {
                    "etching": {
                        "spacedRune": rune,
                        "premine": "",
                        "symbol": "",
                        "terms": {
                            "amount": "1",
                            "cap": await generateRandomNumberString(8, 13),
                            "height": [
                                null,
                                null,
                            ],
                            "offset": [
                                null,
                                null,
                            ]
                        }
                    }
                }
            }
        ],
        "clientId": "",
    }

    const axiosConfig: any = {
        headers: signConverter(endpoint, JSON.stringify(body), sesssion),
        httpsAgent: getProxy(proxy),
        httpAgent: getProxy(proxy),
    };
    try {
        const response = await axios.post(
            `${url}${endpoint}`,
            body,
            axiosConfig
        );

        return response.data;
    } catch (error) {
        if (attempts < projectConfig.retryCount) {
            log("error", `Attempt [${attempts + 1}/${projectConfig.retryCount}] failed: ${(error as Error).message}. Retrying...`);
            return deployOrderRune(rune, recipient, proxy, sesssion, attempts + 1)
        } else {
            log("error", `Failed to fetch auth data after [${attempts + 1}/${projectConfig.retryCount}] attempts.`);
        }
    }
}

export async function getRuneInfo(runeID: string, proxy: IProxy | boolean, sesssion: string, attempts: number = 0) {
    try {
        const url = projectConfig.network === "mainnet" ? "https://api.unisat.space" : "https://fractal-api.unisat.io"
        const endpoint = `/query-v4/runes/${runeID}/info`

        const axiosConfig: any = {
            headers: signConverter(endpoint, '', sesssion),
            httpsAgent: getProxy(proxy),
            httpAgent: getProxy(proxy),
        };

        const response = await axios.get(
            `${url}${endpoint}`,
            axiosConfig
        );

        return response.data;
    } catch (error) {
        if (attempts < projectConfig.retryCount) {
            log("error", `Attempt [${attempts + 1}/${projectConfig.retryCount}] failed: ${(error as Error).message}. Retrying...`);
            return getRuneInfo(runeID, proxy, sesssion, attempts + 1)
        } else {
            log("error", `Failed to fetch auth data after [${attempts + 1}/${projectConfig.retryCount}] attempts.`);
        }
    }
}

export async function getInscriptionInfo(name: string, proxy: IProxy | boolean, sesssion: string, attempts: number = 0) {
    try {
        const endpoint = `/query-v4/brc20/${asciiToHex(name)}/info`

        const axiosConfig: any = {
            headers: signConverter(endpoint, '', sesssion),
            httpsAgent: getProxy(proxy),
            httpAgent: getProxy(proxy),
        };

        const response = await axios.get(
            `https://api.unisat.space${endpoint}`,
            axiosConfig
        );

        return response.data;
    } catch (error) {
        if (attempts < projectConfig.retryCount) {
            log("error", `Attempt [${attempts + 1}/${projectConfig.retryCount}] failed: ${(error as Error).message}. Retrying...`);
            return getInscriptionInfo(name, proxy, sesssion, attempts + 1)
        } else {
            log("error", `Failed to fetch auth data after [${attempts + 1}/${projectConfig.retryCount}] attempts.`);
        }
    }
}

export async function getInscriptionFractalInfo(name: string, proxy: IProxy | boolean, sesssion: string, attempts: number = 0) {
    try {
        const endpoint = `/query-v4/brc20/${name}/info`

        const axiosConfig: any = {
            headers: signConverter(endpoint, '', sesssion),
            httpsAgent: getProxy(proxy),
            httpAgent: getProxy(proxy),
        };

        const response = await axios.get(
            `https://fractal-api.unisat.io${endpoint}`,
            axiosConfig
        );

        return response.data;
    } catch (error) {
        if (attempts < projectConfig.retryCount) {
            log("error", `Attempt [${attempts + 1}/${projectConfig.retryCount}] failed: ${(error as Error).message}. Retrying...`);
            return getInscriptionFractalInfo(name, proxy, sesssion, attempts + 1)
        } else {
            log("error", `Failed to fetch auth data after [${attempts + 1}/${projectConfig.retryCount}] attempts.`);
        }
    }
}


export async function getUserInscriptionInfo(address: string, name: string, proxy: IProxy | boolean, sesssion: string, attempts: number = 0) {
    try {
        const endpoint = `/query-v4/address/${address}/brc20/${name}/info`

        const axiosConfig: any = {
            headers: signConverter(endpoint, '', sesssion),
            httpsAgent: getProxy(proxy),
            httpAgent: getProxy(proxy),
        };

        const response = await axios.get(
            `https://fractal-api.unisat.io${endpoint}`,
            axiosConfig
        );

        return response.data.data;
    } catch (error) {
        if (attempts < projectConfig.retryCount) {
            log("error", `Attempt [${attempts + 1}/${projectConfig.retryCount}] failed: ${(error as Error).message}. Retrying...`);
            return getUserInscriptionInfo(address, name, proxy, sesssion, attempts + 1)
        } else {
            log("error", `Failed to fetch user inscription data after [${attempts + 1}/${projectConfig.retryCount}] attempts.`);
        }
    }
}

export async function getDomainInfo(domain: string, proxy: IProxy | boolean, sesssion: string, attempts: number = 0) {
    try {
        const url = projectConfig.network === "mainnet" ? "https://api.unisat.space" : "https://fractal-api.unisat.io"

        const name = `${randomString(5, 9)}.${domain}`

        const endpoint = `/query-v4/name/category/${domain}/existence`

        const axiosConfig: any = {
            headers: signConverter(endpoint, JSON.stringify({"names": [name]}), sesssion),
            httpsAgent: getProxy(proxy),
            httpAgent: getProxy(proxy),
        };

        const response = await axios.post(
            `${url}${endpoint}`,
            {
                "names": [name]
            },
            axiosConfig
        );

        if (response.data?.msg === "ok" && response.data.data[name] === "available") {
            return name
        } else {
            log("error", `Domain ${name} already exists, try another`)
            return getDomainInfo(domain, proxy, sesssion, attempts + 1)
        }
    } catch (error) {
        if (attempts < projectConfig.retryCount) {
            log("error", `Attempt [${attempts + 1}/${projectConfig.retryCount}] failed: ${(error as Error).message}. Retrying...`);
            return getDomainInfo(domain, proxy, sesssion, attempts + 1)
        } else {
            log("error", `Failed to fetch auth data after [${attempts + 1}/${projectConfig.retryCount}] attempts.`);
        }
    }
}

export async function makeStake(address: string, pubKey: string, amount: number, proxy: IProxy | boolean, sesssion: string, attempts: number = 0) {
    try {
        const currentFee = await fetchFees(proxy);
        const fee = projectConfig.useCustomGas && (currentFee > projectConfig.maxGas) ? projectConfig.customGas : currentFee

        const body = {
            "address": address,
            "amount": amount,
            "feeRate": fee,
            "pubKey": pubKey,
        }

        const axiosConfig: any = {
            headers: signConverter("/api/v1/staking/stake", JSON.stringify(body), sesssion),
            httpsAgent: getProxy(proxy),
            httpAgent: getProxy(proxy),
        };

        const response = await axios.post(
            `https://vote.fractalbitcoin.io/api/v1/staking/stake`,
            body,
            axiosConfig
        );

        return response.data
    } catch (error) {
        if (attempts < projectConfig.retryCount) {
            log("error", `Attempt [${attempts + 1}/${projectConfig.retryCount}] failed: ${(error as Error).message}. Retrying...`);
            return makeStake(address, pubKey, amount, proxy, sesssion, attempts + 1)
        } else {
            log("error", `Failed to fetch staking data after [${attempts + 1}/${projectConfig.retryCount}] attempts.`);
        }
    }
}

export async function makePsbtStake(address: string, pubKey: string, amount: number, psbt: string, proxy: IProxy | boolean, sesssion: string, attempts: number = 0) {
    try {
        const body = {
            "actionType": "STAKE",
            "address": address,
            "amount": amount,
            "psbtHex": psbt,
            "pubKey": pubKey,
        }

        const axiosConfig: any = {
            headers: signConverter("/api/v1/staking/push-psbt", JSON.stringify(body), sesssion),
            httpsAgent: getProxy(proxy),
            httpAgent: getProxy(proxy),
        };

        const response = await axios.post(
            `https://vote.fractalbitcoin.io/api/v1/staking/push-psbt`,
            body,
            axiosConfig
        );

        return response.data
    } catch (error) {
        if (attempts < projectConfig.retryCount) {
            log("error", `Attempt [${attempts + 1}/${projectConfig.retryCount}] failed: ${(error as Error).message}. Retrying...`);
            return makePsbtStake(address, pubKey, amount, psbt, proxy, sesssion, attempts + 1)
        } else {
            log("error", `Failed to fetch staking data after [${attempts + 1}/${projectConfig.retryCount}] attempts.`);
        }
    }
}


export async function getVotePower(address: string, proposalId: string, proxy: IProxy | boolean, sesssion: string, attempts: number = 0) {
    try {
        const endpoint = `/api/v1/voting/proposal-user-votes?proposalId=${proposalId}&address=${address}`

        const axiosConfig: any = {
            headers: signConverter(endpoint, '', sesssion),
            httpsAgent: getProxy(proxy),
            httpAgent: getProxy(proxy),
        };

        const response = await axios.get(
            `https://vote.fractalbitcoin.io${endpoint}`,
            axiosConfig
        );

        return response.data
    } catch (error) {
        if (attempts < projectConfig.retryCount) {
            log("error", `Attempt [${attempts + 1}/${projectConfig.retryCount}] failed: ${(error as Error).message}. Retrying...`);
            return getVotePower(address, proposalId, proxy, sesssion, attempts + 1)
        } else {
            log("error", `Failed to fetch vote power after [${attempts + 1}/${projectConfig.retryCount}] attempts.`);
        }
    }
}


export async function makeVote(address: string, pubKey: string, amount: number, optionId: number, proposalId: string, proxy: IProxy | boolean, sesssion: string, attempts: number = 0) {
    try {
        const body = {
            "address": address,
            "amount": amount,
            "optionId": optionId,
            "proposalId": proposalId,
            "pubKey": pubKey,
        }

        const axiosConfig: any = {
            headers: signConverter("/api/v1/voting/votes/prepare", JSON.stringify(body), sesssion),
            httpsAgent: getProxy(proxy),
            httpAgent: getProxy(proxy),
        };

        const response = await axios.post(
            `https://vote.fractalbitcoin.io/api/v1/voting/votes/prepare`,
            body,
            axiosConfig
        );

        return response.data
    } catch (error) {
        if (attempts < projectConfig.retryCount) {
            log("error", `Attempt [${attempts + 1}/${projectConfig.retryCount}] failed: ${(error as Error).message}. Retrying...`);
            return makeVote(address, pubKey, amount, optionId, proposalId, proxy, sesssion, attempts + 1)
        } else {
            log("error", `Failed to fetch vote data after [${attempts + 1}/${projectConfig.retryCount}] attempts.`);
        }
    }
}

export async function makeSignVote(address: string, pubKey: string, amount: number, optionId: number, proposalId: string, nonce: number, message: string, proxy: IProxy | boolean, sesssion: string, attempts: number = 0) {
    try {
        const body = {
            "address": address,
            "amount": amount,
            "nonce": nonce,
            "optionId": optionId,
            "proposalId": proposalId,
            "pubKey": pubKey,
            "signature": message,
        }

        const axiosConfig: any = {
            headers: signConverter("/api/v1/voting/votes", JSON.stringify(body), sesssion),
            httpsAgent: getProxy(proxy),
            httpAgent: getProxy(proxy),
        };

        const response = await axios.post(
            `https://vote.fractalbitcoin.io/api/v1/voting/votes`,
            body,
            axiosConfig
        );

        return response.data
    } catch (error) {
        if (attempts < projectConfig.retryCount) {
            log("error", `Attempt [${attempts + 1}/${projectConfig.retryCount}] failed: ${(error as Error).message}. Retrying...`);
            return makeSignVote(address, pubKey, amount, optionId, proposalId, nonce, message, proxy, sesssion, attempts + 1)
        } else {
            log("error", `Failed to fetch vote data after [${attempts + 1}/${projectConfig.retryCount}] attempts.`);
        }
    }
}
