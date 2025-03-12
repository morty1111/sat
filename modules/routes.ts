import {IProxy} from "../utils/wallet";
import {deployInscriptionModule, mintInscriptionModule} from "./inscription";
import {deployRuneModule, mintRuneModule} from "./rune";
import {mintDomainModule} from "./domain";
import {shuffleArray, sleep} from "../utils/common";
import {customRoutes} from "../data/project.config";
import {log} from "../utils/logger";

function getRandomElement(arr: any[]): any {
    const shuffledArr = shuffleArray(arr);
    const randomElement = shuffledArr[Math.floor(Math.random() * shuffledArr.length)];

    if (Array.isArray(randomElement)) {
        return getRandomElement(randomElement);
    } else {
        return randomElement;
    }
}

function generateRandomizedList(inputList: any[]): string[] {
    const resultList: string[] = [];
    const shuffledList = shuffleArray(inputList);

    for (const element of shuffledList) {
        if (Array.isArray(element)) {
            resultList.push(getRandomElement(element));
        } else {
            resultList.push(element);
        }
    }

    return resultList;
}

export async function customRoutesModule(walletProxyMap: { [wallet: string]: IProxy | boolean }): Promise<void> {
    for (const _ in walletProxyMap) {
        const modules = generateRandomizedList(customRoutes.useModules)
        for (const module of modules) {
            switch (module) {
                case "mint_inscription":
                    await mintInscriptionModule({[_]: walletProxyMap[_]});
                    break;
                case "mint_rune":
                    await mintRuneModule({[_]: walletProxyMap[_]});
                    break;
                case "deploy_inscription":
                    await deployInscriptionModule({[_]: walletProxyMap[_]});
                    break;
                case "deploy_rune":
                    await deployRuneModule({[_]: walletProxyMap[_]});
                    break;
                case "mint_domain":
                    await mintDomainModule({[_]: walletProxyMap[_]});
                    break;
                case null:
                    break;
                default:
                    log("error", `Module "${module}" not found"`)
                    break;
            }
            await sleep(customRoutes.sleep)
        }
    }
}
