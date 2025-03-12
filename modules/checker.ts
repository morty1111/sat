import Table from 'cli-table3';
import {getAuthData, makeAuth} from "./unisat";
import {getBalance, getBitcoinPrice, matchWalletsAndProxies, readFile, sleep} from "../utils/common";
import {IProxy, Wallet} from "../utils/wallet";
import fs from "fs";
import * as fastcsv from 'fast-csv';
import {projectConfig} from "../data/project.config";
import {log} from "../utils/logger";

const table = new Table({
    head: ['#', 'Address', 'Balance', 'Balance USD', 'Fractal Balance', 'Points'],
    colWidths: [5, 65, 20, 20, 20, 10],
});

function formatDate(date: Date): string {
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const hour = String(date.getHours());
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(2);
    return `${day}-${month}-${year} ${hour}_${minutes}`;
}

async function getPoints(wallet: Wallet, network: string, attempts: number = 0) {
    try {
        const signMsg = await getAuthData(wallet.address, wallet.proxy, network);
        const sign = wallet.signMessage(signMsg);

        return await makeAuth(wallet.address, wallet.publicKey, wallet.proxy, sign, network);
    } catch (error) {
        if (attempts < projectConfig.retryCount) {
            log("error", `Attempt [${attempts + 1}/${projectConfig.retryCount}] failed: ${(error as Error).message}. Retrying...`);
            return getPoints(wallet, network, attempts + 1)
        } else {
            log("error", `Failed to fetch auth data after [${attempts + 1}/${projectConfig.retryCount}] attempts.`);
        }
    }
}

async function pointsChecker(): Promise<void> {
    const wallets = readFile("wallets.txt");
    const proxies = readFile("proxy.txt")

    const walletProxyMap = matchWalletsAndProxies(wallets, proxies);
    const price = await getBitcoinPrice();

    const csvData: any[] = [];
    const batchSize = 10;
    const delayBetweenBatches = 1000;

    const batches = Object.entries(walletProxyMap).reduce((result, [seed, proxy], index) => {
        const batchIndex = Math.floor(index / batchSize);
        if (!result[batchIndex]) {
            result[batchIndex] = [];
        }
        result[batchIndex].push([seed, proxy]);
        return result;
    }, [] as [string, IProxy | boolean][][]);

    for (const [batchIndex, batch] of batches.entries()) {
        console.log(`Starting batch ${batchIndex + 1} / ${batches.length}`);

        const batchPromises = batch.map(async ([seed, proxy], index) => {
            const wallet = new Wallet({ seed, proxy });

            const mainnetPoints = await getPoints(wallet, "mainnet");
            const fractalPoints = await getPoints(wallet, "fractal");

            if (mainnetPoints?.msg === "ok") {
                const userMainnetBalance = await getBalance(wallet.address, wallet.proxy, "mainnet");
                const userFractalBalance = await getBalance(wallet.address, wallet.proxy, "fractal");
                const mainnetBalance = userMainnetBalance?.chain_stats?.funded_txo_sum - userMainnetBalance?.chain_stats?.spent_txo_sum;
                const fractalBalance = userFractalBalance?.chain_stats?.funded_txo_sum - userFractalBalance?.chain_stats?.spent_txo_sum;

                const row = [
                    index + 1 + batchIndex * batchSize,
                    wallet.address,
                    mainnetBalance / 100_000_000,
                    (mainnetBalance / 100_000_000) * price,
                    fractalBalance / 100_000_000,
                    `${mainnetPoints.data.inscribeCount} | ${fractalPoints.data.inscribeCount}`
                ];

                table.push(row);
                csvData.push(row);
            }
        });

        await Promise.all(batchPromises);

        if (batchIndex < batches.length - 1) {
            console.log(`Waiting ${delayBetweenBatches / 1000} seconds before starting next batch...`);
            await sleep([delayBetweenBatches / 1000, delayBetweenBatches / 1000]);
        }
    }

    csvData.sort((a, b) => a[0] - b[0]);

    console.log(table.toString());

    const formattedDate = formatDate(new Date());
    const csvFilename = `checker_${formattedDate}.csv`;
    const ws = fs.createWriteStream(`logs/${csvFilename}`);

    fastcsv.write(csvData, { headers: ['#', 'Address', 'Balance BTC', 'Balance USD', 'Fractal Balance', 'Points'] }).pipe(ws);

    console.log(`CSV file created at: ${csvFilename}`);
}


if (require.main === module) {
    pointsChecker().catch(err => {
        console.error("Error:", err);
        process.exit(1);
    });
}