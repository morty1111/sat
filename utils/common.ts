import * as fs from 'fs';
import {select} from "@inquirer/prompts";
import {fetchFees} from "../modules/fee";
import {projectConfig} from "../data/project.config";
import axios from "axios";
import {log} from "./logger";
import {IProxy} from "./wallet";
import {SocksProxyAgent} from "socks-proxy-agent";
import * as path from 'path';

export async function menu() {
    console.log("❤️ Subscribe to me – https://t.me/sybilwave\n");

    const answer = await select(
        {
            message: "💎 Select a method to get started",
            choices: [
                {
                    name: "1) Mint inscription on Unisat",
                    value: "mint_inscription_unisat",
                },
                {
                    name: "2) Deploy inscription on Unisat",
                    value: "deploy_inscription_unisat",
                },
                {
                    name: "3) Mint rune on Unisat",
                    value: "mint_rune_unisat",
                },
                {
                    name: "4) Deploy rune on Unisat",
                    value: "deploy_rune_unisat",
                },
                {
                    name: "5) Mint domains on Unisat",
                    value: "mint_domain_unisat",
                },
                {
                    name: "6) Deploy NFT",
                    value: "deploy_nft_unisat",
                },
                {
                    name: "7) Stake FB",
                    value: "stake_fb",
                },
                {
                    name: "8) Make Vote",
                    value: "make_vote",
                },
                {
                    name: "9) Custom routes",
                    value: "use_custom_routes",
                },
                {
                    name: "10) Exit",
                    value: "exit",
                },
            ],
        }
    );

    return answer;
}

export const tokenData = {
    "FB": "sFB___000",
    "bSATS": "bSATS_",
    "sSATS": "sSATS___000",
    "bBTC": "bBTC___",
}

export function readFile(filePath: string): string[] {
    try {
        const file = fs.readFileSync(filePath, 'utf-8');
        return file.split('\n').map(line => line.trim()).filter(line => line);
    } catch (error) {
        log("error", `Error reading the file: ${(error as Error).message}`);
        return [];
    }
}

export function matchWalletsAndProxies(wallets: string[], proxies: string[]) {
    const walletProxyMap: { [wallet: string]: IProxy | boolean } = {};

    if (projectConfig.useProxy) {
        for (let i = 0; i < wallets.length; i++) {
            const proxyParts = proxies[i].split(':');
            walletProxyMap[wallets[i]] = {
                ip: proxyParts[0],
                port: parseInt(proxyParts[1], 10),
                username: proxyParts[2],
                password: proxyParts[3]
            };
        }
    } else {
        wallets.forEach(wallet => {
            walletProxyMap[wallet] = false; // Если прокси не используется, ставим `false`
        });
    }

    return walletProxyMap
}

export function toXOnly(pubkey: Buffer): Buffer {
    return pubkey.subarray(1, 33);
}

export function getRandomElements(arr: any, min: number, max: number) {
    const count = Math.floor(Math.random() * (max - min + 1)) + min;

    const result = [];

    for (let i = 0; i < count; i++) {
        const randomIndex = Math.floor(Math.random() * arr.length);
        result.push(arr[randomIndex]);
    }

    return result;
}

export async function sleep(seconds: number[]): Promise<void> {
    const sleep_seconds = Math.floor(Math.random() * (seconds[1] - seconds[0] + 1)) + seconds[0];
    return new Promise(resolve => setTimeout(resolve, sleep_seconds * 1000));
}

export async function generateRandomWord(minLength: number, maxLength: number): Promise<string> {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const wordLength = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
    return new Promise((resolve) => {
        const randomWord = Array.from({length: wordLength}, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
        resolve(randomWord);
    });
}

export async function generateRandomNumberString(minLength: number, maxLength: number): Promise<string> {
    const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;

    return new Promise((resolve) => {
        const randomNumberString = Array.from({length}, () => Math.floor(Math.random() * 10).toString()).join('');
        resolve(randomNumberString);
    });
}

export async function gasChecker(proxy: IProxy | boolean): Promise<void> {
    const getDelay = () => {
        const seconds = projectConfig.gasCheckerSleep;

        return Math.floor(Math.random() * (seconds[1] - seconds[0] + 1)) + seconds[0];
    }

    const checkFee = async (delay: number): Promise<boolean> => {
        const currentFee = await fetchFees(proxy);

        if (currentFee === undefined) {
            log("error", "Failed to fetch current fee.");
            return false;
        }

        const isSuccess = !projectConfig.useCustomGas ? currentFee <= projectConfig.maxGas : projectConfig.useCustomGas && currentFee > projectConfig.maxGas ? projectConfig.customGas : currentFee

        log("info", `Current gas ${isSuccess ? `is normal | ${currentFee}` : `${currentFee} > ${projectConfig.maxGas} | Sleep ${delay} s.`}`);

        return isSuccess;
    };

    return new Promise((resolve) => {
        let delay = getDelay()

        const checkAndResolve = async () => {
            delay = getDelay()

            if (await checkFee(delay)) {
                resolve();
                clearInterval(intervalId);
            }
        };

        checkAndResolve();

        const intervalId = setInterval(checkAndResolve, delay * 1000); // Повтор через 30 секунд
    });
}

export async function getBalance(address: string, proxy: IProxy | boolean, network: string, attempts: number = 0): Promise<any> {
    log('info', `Check balance at this address: ${address}`);

    const url = network == "mainnet" ? "https://mempool.space/" : "https://mempool.fractalbitcoin.io/"
    const axiosConfig: any = {
        httpsAgent: getProxy(proxy),
        httpAgent: getProxy(proxy),
    };

    try {
        const response = await axios.get(`${url}api/address/${address}`, axiosConfig);
        return response.data;
    } catch (error) {
        if (attempts < projectConfig.retryCount) {
            log("error", `Attempt [${attempts + 1}/${projectConfig.retryCount}]} failed: ${(error as Error).message}. Retrying...`);
            return getBalance(address, proxy, network, attempts + 1);
        } else {
            log("error", `Failed to fetch auth data after [${attempts + 1}/${projectConfig.retryCount}] attempts.`);
        }
    }
}

export async function mempoolChecker(address: string, proxy: IProxy | boolean): Promise<any> {
    log('info', `Check mempool at this address: ${address}`);

    const checkBalance = async (): Promise<boolean> => {
        const userBalance = await getBalance(address, proxy, projectConfig.network);
        const isEmpty = userBalance?.mempool_stats?.funded_txo_count === 0;
        log('info', `User mempool ${isEmpty ? `is empty! | ${address}` : `is not empty! Sleep 300s. | ${address}`}`);
        return isEmpty;
    };

    return new Promise<any>((resolve) => {
        const checkAndResolve = async () => {
            if (await checkBalance()) {
                resolve(await getBalance(address, proxy, projectConfig.network));
                clearInterval(intervalId);
            }
        };

        checkAndResolve();

        const intervalId = setInterval(checkAndResolve, 300000); // Повтор через 300 секунд
    });
}

export function randomString(minLength: number, maxLength: number): string {
    const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;

    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}


export function asciiToHex(asciiString: string): string {
    let hexString = '';
    for (let i = 0; i < asciiString.length; i++) {
        const hex = asciiString.charCodeAt(i).toString(16);
        hexString += hex;
    }
    return hexString;
}

export function getProxy(proxy: IProxy | boolean) {
    if (proxy && typeof proxy !== 'boolean') {
        const proxyUrl = `socks5://${proxy.username}:${proxy.password}@${proxy.ip}:${proxy.port}`;
        return new SocksProxyAgent(proxyUrl)
    }
}

export function shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

export async function getBitcoinPrice() {
    try {
        const response = await axios.get('https://min-api.cryptocompare.com/data/price?fsym=BTC&tsyms=USDT');

        return response.data.USDT;
    } catch (error) {
        console.error('Error fetching BTC to USDT conversion rate:', error);
        throw new Error('Failed to fetch conversion rate');
    }
}

export function svgToBase64(filePath: string): string {
    const svgData = fs.readFileSync(filePath, 'utf8');
    const base64Data = Buffer.from(svgData).toString('base64');
    return `data:image/svg+xml;base64,${base64Data}`;
}

export async function getRandomFilesInBase64AndDelete(min: number, max: number): Promise<{ name: string, code: string }[]> {
    const directoryPath = 'img/';

    return new Promise((resolve, reject) => {
        fs.readdir(directoryPath, async (err, files) => {
            if (err) {
                return reject(`Error get files: ${err}`);
            }

            const svgFiles = files
                .filter(file => path.extname(file) === '.svg')
                .map(file => path.join(directoryPath, file));

            if (svgFiles.length < min) {
                return reject(`There are fewer than ${min} SVG files in the folder for processing.`);
            }

            const getRandomInt = (min: number, max: number): number => {
                return Math.floor(Math.random() * (max - min + 1)) + min;
            };

            const numberOfFilesToProcess = getRandomInt(min, Math.min(max, svgFiles.length));

            const shuffledFiles = svgFiles.sort(() => 0.5 - Math.random());

            const filesToProcess = shuffledFiles.slice(0, numberOfFilesToProcess);

            try {
                const base64Files = await Promise.all(
                    filesToProcess.map(async (file) => {
                        const base64 = svgToBase64(file);
                        const fileName = path.basename(file);

                        fs.unlink(file, (err) => {
                            if (err) {
                                console.error(`Error delete file ${file}: ${err}`);
                            }
                        });

                        return { name: fileName, code: base64 };
                    })
                );

                resolve(base64Files);
            } catch (error) {
                reject(`Error: ${error}`);
            }
        });
    });
}