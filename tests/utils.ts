import { Program } from '@project-serum/anchor';
import * as pythUtils from './pyth_utils';

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
  STSOLUSD,
}

export enum PriceType {
  Pyth = 0,
  SwitchboardV1 = 1,
  YiToken = 2,
  SwitchboardV2 = 3,
}

export async function createFakeAccounts(fakePythProgram: Program<any>, initialTokens: any[]) {
  return await Promise.all(
    initialTokens.map(async (asset): Promise<any> => {
      console.log(`Adding ${asset.ticker.toString()}`);

      if (asset.priceType == PriceType.Pyth || asset.priceType == PriceType.YiToken) {
        return await pythUtils.createPriceFeed({
          oracleProgram: fakePythProgram,
          initPrice: asset.price,
          expo: -asset.decimals,
        });
      } else if (asset.priceType == PriceType.SwitchboardV1) {
        return await pythUtils.createPriceFeedSwitchboardV1({
          oracleProgram: fakePythProgram,
          mantissa: asset.mantissa,
          scale: asset.expo,
        });
      } else if (asset.priceType == PriceType.SwitchboardV2) {
        return await pythUtils.createPriceFeedSwitchboardV2({
          oracleProgram: fakePythProgram,
          mantissa: asset.mantissa,
          scale: asset.expo,
        });
      }
    })
  );
}
