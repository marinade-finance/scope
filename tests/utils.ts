import {Decimal} from "decimal.js";
import {BN, Program} from "@project-serum/anchor";
import * as pythUtils from "./pyth_utils";

export enum Tokens {
    SOL = 0,
    ETH,
    BTC,
    SRM,
    RAY,
    FTT,
    MSOL,
    UST,
    BNB,
    AVAX,
    STSOLUST,
    SABERMSOLSOL,
    USDHUSD,
    STSOLUSD

}

export enum PriceType {
    Pyth = 0,
    SwitchboardV1 = 1,
    YiToken = 2,
    SwitchboardV2 = 3,
}

export const initialTokens = [
    {
        price: new Decimal('228.41550900'),
        ticker: Buffer.from('SOL'),
        decimals: 8,
        priceType: PriceType.Pyth,
        mantissa: new BN(0),
        expo: 0
    },
    {
        price: new Decimal('4726.59830000'),
        ticker: Buffer.from('ETH'),
        decimals: 8,
        priceType: PriceType.Pyth,
        mantissa: new BN(0),
        expo: 0
    },
    {
        price: new Decimal('64622.36900000'),
        ticker: Buffer.from('BTC'),
        decimals: 8,
        priceType: PriceType.Pyth,
        mantissa: new BN(0),
        expo: 0
    },
    {
        price: new Decimal('7.06975570'),
        ticker: Buffer.from('SRM'),
        decimals: 8,
        priceType: PriceType.Pyth,
        mantissa: new BN(0),
        expo: 0
    },
    {
        price: new Decimal('11.10038050'),
        ticker: Buffer.from('RAY'),
        decimals: 8,
        priceType: PriceType.Pyth,
        mantissa: new BN(0),
        expo: 0
    },
    {
        price: new Decimal('59.17104600'),
        ticker: Buffer.from('FTT'),
        decimals: 8,
        priceType: PriceType.Pyth,
        mantissa: new BN(0),
        expo: 0
    },
    {
        price: new Decimal('253.41550900'),
        ticker: Buffer.from('MSOL'),
        decimals: 8,
        priceType: PriceType.Pyth,
        mantissa: new BN(0),
        expo: 0
    },
    {
        price: new Decimal('228.415509'),
        ticker: Buffer.from('UST'),
        decimals: 8,
        priceType: PriceType.Pyth,
        mantissa: new BN(0),
        expo: 0
    },
    {
        price: new Decimal('11.10038050'),
        ticker: Buffer.from('BNB'),
        decimals: 8,
        priceType: PriceType.Pyth,
        mantissa: new BN(0),
        expo: 0
    },
    {
        price: new Decimal('59.17104600'),
        ticker: Buffer.from('AVAX'),
        decimals: 8,
        priceType: PriceType.Pyth,
        mantissa: new BN(0),
        expo: 0
    },
    {
        price: new Decimal('0.90987600'),
        ticker: Buffer.from('STSOLUST'),
        decimals: 8,
        priceType: PriceType.YiToken,
        mantissa: new BN(0),
        expo: 0
    },
    {
        price: new Decimal('343.92109348'),
        ticker: Buffer.from('SABERMSOLSOL'),
        decimals: 8,
        priceType: PriceType.SwitchboardV1,
        mantissa: new BN('34392109348'),
        expo: 8
    },
    {
        price: new Decimal('999.20334456'),
        ticker: Buffer.from('USDHUSD'),
        decimals: 8,
        priceType: PriceType.SwitchboardV1,
        mantissa: new BN('99920334456'),
        expo: 8
    },
    {
        mantissa: new BN('474003240021234567'),
        expo: 15,
        ticker: Buffer.from('STSOLUSD'),
        price: new Decimal('474.003240021234567'),
        decimals: 8,
        priceType: PriceType.SwitchboardV2
    },
]

export async function createFakeAccounts(fakePythProgram: Program<any>, initialTokens: any[]) {
    return await Promise.all(initialTokens.map(async (asset): Promise<any> => {
        console.log(`Adding ${asset.ticker.toString()}`)

        if (asset.priceType == PriceType.Pyth || asset.priceType == PriceType.YiToken) {
            return await pythUtils.createPriceFeed({
                oracleProgram: fakePythProgram,
                initPrice: asset.price,
                expo: -asset.decimals
            })
        } else if (asset.priceType == PriceType.SwitchboardV1) {
            return await pythUtils.createPriceFeedSwitchboardV1({
                oracleProgram: fakePythProgram,
                mantissa: asset.mantissa,
                scale: asset.expo
            })
        } else if (asset.priceType == PriceType.SwitchboardV2) {
            return await pythUtils.createPriceFeedSwitchboardV2({
                oracleProgram: fakePythProgram,
                mantissa: asset.mantissa,
                scale: asset.expo,
            })
        }
    }));
}