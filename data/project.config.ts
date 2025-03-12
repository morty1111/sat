export const projectConfig = {
    network: "fractal", // mainnet / fractal
    useProxy: false,
    retryCount: 2,
    feesUsing: "fast", //slow|medium|fast
    maxGas: 300,
    customGas: 3200,
    useCustomGas: true, // If true - use custom gas even currentGas in feesUsing is higher than maxGas
    gasCheckerSleep: [1, 1],
    sleep: [1, 1],
    batchCount: 1, // Number of wallets in batch, example: 10 wallets, 3 batchCount = [5, 10, 1], [4, 3, 6], [7, 2, 9], [8]
    batchSleep: [1, 1], // Sleep before start new batch
}

export const configVoting = {
    amount: [0.1, 0.12], // min, max amount for stake
    decimals: [5, 5],
    voteId: "c6e5f8fc-76ee-4255-990a-304ffd641d00", //
    optionId: [1, 2],
}

export const walletsGenerator = {
    quantityWallets: 300
}

export const configDomains = {
    useDomain: ["sats", "unisat"], // Available domains: sats, unisat, btc, xbt, ord, gm, x, uniworlds
    mintAll: false, // If true - mint every domain in list, if false - mint any domain in list
    quantityDomainMint: [1, 1],
    domainMintPrice: 330,
    sleep: [10, 20]
}

export const configRunes = {
    runesMint: [
        {
            "runeID": "172922:137",
            "price": 546,
            "count": 50
        },
        {
            "runeID": "230815:128",
            "price": 546,
            "count": 50
        },
        {
            "runeID": "327274:1792",
            "price": 546,
            "count": 50
        },
       
    ],
    quantityRunesMint: [1, 1], //quantity rune mint per wallet: min,
    runeDeployPrice: 546,
    sleep: [10, 20]
}

export const configInscription = {
    inscriptionMint: [
        {
            "name": "sandwich",
            "price": 330,
            "amount": 5,
            "count": 1
        },
        {
            "name": "sandwich",
            "price": 330,
            "amount": 5,
            "count": 1
        },
        {
            "name": "sandwich",
            "price": 330,
            "amount": 5,
            "count": 1
        },
    ],
    quantityMint: [2, 2], //quantity rune mint per wallet: min,
    inscriptionDeployBytes: 4, // 4 or 5
    inscriptionDeployPrice: 330,
    sleep: [10, 20]
}

export const configFiles = {
    quantityFilesForMint: [5, 10],
    inscriptionDeployPrice: 330,
}

export const customRoutes = {
    useModules: [
        // Available modules: mint_inscription, deploy_inscription, mint_rune, deploy_rune, mint_domain
        // --------------------------------------------------------------------------------------------
        // "module_1",
        // ["module_2"],
        // "module_3",
        // [[[[[[[[[[[[["module_9"]]]]]]]]]]]]],
        // [
        //     "module_4", "module_5", "module_6",
        //     [
        //         "module_7", "module_8",
        //         [
        //             "test", "test2",
        //             [
        //                 "test3"
        //             ]
        //         ]
        //     ]
        // ]
        "mint_inscription", "mint_inscription"
    ],
    sleep: [1, 3],

}
