import { Program } from '@project-serum/anchor';
import * as pythUtils from './mock_account_utils';
import * as global from './global';

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

/**
 * Get the custom program error code if there's any in the error message and return parsed error code hex to number string
 * @param errMessage string - error message that would contain the word "custom program error:" if it's a customer program error
 * @returns [boolean, string] - probably not a custom program error if false otherwise the second element will be the code number in string
 */
export const getCustomProgramErrorCode = (errMessage: string): [boolean, string] => {
  const index = errMessage.indexOf('Custom program error:');
  if (index == -1) {
    return [false, 'May not be a custom program error'];
  } else {
    return [true, `${parseInt(errMessage.substring(index + 22, index + 28).replace(' ', ''), 16)}`];
  }
};

/**
 *
 * Maps the private Anchor type ProgramError to a normal Error.
 * Pass ProgramErr.msg as the Error message so that it can be used with chai matchers
 *
 * @param fn - function which may throw an anchor ProgramError
 */
export async function mapAnchorError<T>(fn: Promise<T>): Promise<T> {
  try {
    return await fn;
  } catch (e: any) {
    let [isCustomProgramError, errorCode] = getCustomProgramErrorCode(JSON.stringify(e));
    if (isCustomProgramError) {
      let error: any;
      if (Number(errorCode) >= 6000 && Number(errorCode) <= 7000) {
        errorCode[errorCode.length - 2] === '0' ? (errorCode = errorCode.slice(-1)) : (errorCode = errorCode.slice(-2));
        error = global.ScopeIdl.errors[errorCode].msg;
        throw new Error(error);
      }
    }
    throw e;
  }
}
