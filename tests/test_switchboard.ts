import {setFeedPriceSwitchboardV1, setFeedPriceSwitchboardV2} from "./pyth_utils";

require('dotenv').config();
import { Keypair, PublicKey, SystemProgram, SYSVAR_CLOCK_PUBKEY, Connection, ConnectionConfig, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { Provider, Program, setProvider, BN } from "@project-serum/anchor"
import NodeWallet from '@project-serum/anchor/dist/cjs/nodewallet';
import * as pythUtils from './pyth_utils';
import { Decimal } from 'decimal.js';
import * as chai from 'chai';
import { expect } from 'chai';
import chaiDecimalJs from 'chai-decimaljs';
import * as global from './global';

chai.use(chaiDecimalJs(Decimal));


enum Tokens {
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

enum PriceType {
    Pyth = 0,
    SwitchboardV1 = 1,
    YiToken = 2,
    SwitchboardV2 = 3,
}

let initialTokens = [
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

const PRICE_FEED = "switchboard_test_feed"

function checkOraclePrice(token: number, oraclePrices: any) {
    console.log(`Check ${initialTokens[token].ticker} price`)
    let price = oraclePrices.prices[token].price;
    let value = price.value.toString();
    let expo = price.exp.toString();
    expect(value).eq(initialTokens[token].mantissa.toString());
    expect(expo).eq(initialTokens[token].expo.toString());

}

describe("Switchboard Scope tests", () => {
    const keypair_acc = Uint8Array.from(Buffer.from(JSON.parse(require('fs').readFileSync(`./keys/${global.getCluster()}/owner.json`))));
    const admin = Keypair.fromSecretKey(keypair_acc);

    let config: ConnectionConfig = {
        commitment: Provider.defaultOptions().commitment,
        confirmTransactionInitialTimeout: 220000,
    };

    const connection = new Connection('http://127.0.0.1:8899', config);
    const wallet = new NodeWallet(admin);
    const provider = new Provider(connection, wallet, Provider.defaultOptions());
    setProvider(provider);

    const program = new Program(global.ScopeIdl, global.getScopeProgramId(), provider);

    const fakePythProgram = new Program(global.FakePythIdl, global.getFakePythProgramId(), provider);
    let fakePythAccounts: Array<PublicKey>;
    // let fakePythAccounts2: Array<PublicKey>; // Used to overflow oracle capacity

    let programDataAddress: PublicKey;
    let confAccount: PublicKey;
    let oracleAccount: PublicKey;
    let oracleMappingAccount: PublicKey;

    before("Initialize Scope and pyth prices", async () => {

        programDataAddress = await global.getProgramDataAddress(program.programId);
        confAccount = (await PublicKey.findProgramAddress(
            [Buffer.from("conf", 'utf8'), Buffer.from(PRICE_FEED, 'utf8')],
            program.programId
        ))[0];

        let oracleAccount_kp = Keypair.generate();
        let oracleMappingAccount_kp = Keypair.generate();

        oracleAccount = oracleAccount_kp.publicKey;
        oracleMappingAccount = oracleMappingAccount_kp.publicKey;

        console.log(`program data address is ${programDataAddress.toBase58()}`);

        await program.rpc.initialize(
            PRICE_FEED,
            {
                accounts: {
                    admin: admin.publicKey,
                    program: program.programId,
                    programData: programDataAddress,
                    systemProgram: SystemProgram.programId,
                    configuration: confAccount,
                    oraclePrices: oracleAccount,
                    oracleMappings: oracleMappingAccount,
                    rent: SYSVAR_RENT_PUBKEY,
                },
                signers: [admin, oracleAccount_kp, oracleMappingAccount_kp],
                instructions: [
                    await program.account.oraclePrices.createInstruction(oracleAccount_kp),
                    await program.account.oracleMappings.createInstruction(oracleMappingAccount_kp),
                ],
            });

        console.log('Initialize Tokens pyth prices and oracle mappings');

        fakePythAccounts = await Promise.all(initialTokens.map(async (asset): Promise<any> => {
            console.log(`Adding ${asset.ticker.toString()}`)

            if(asset.priceType == PriceType.Pyth || asset.priceType == PriceType.YiToken) {
                return await pythUtils.createPriceFeed({
                    oracleProgram: fakePythProgram,
                    initPrice: asset.price,
                    expo: -asset.decimals
                })
            }
            else if(asset.priceType == PriceType.SwitchboardV1) {
                return await pythUtils.createPriceFeedSwitchboardV1({
                    oracleProgram: fakePythProgram,
                    mantissa: asset.mantissa,
                    scale: asset.expo
                })
            }
            else if(asset.priceType == PriceType.SwitchboardV2) {
                return await pythUtils.createPriceFeedSwitchboardV2({
                    oracleProgram: fakePythProgram,
                    mantissa: asset.mantissa,
                    scale: asset.expo,
                })
            }
            console.log('end init');
        }));
    });

    it('test_set_oracle_mappings', async () => {
        await Promise.all(fakePythAccounts.map(async (fakePythAccount, idx): Promise<any> => {
            console.log(`Set mapping of ${initialTokens[idx].ticker}`)

            await program.rpc.updateMapping(
                new BN(idx), initialTokens[idx].priceType,
                {
                    accounts: {
                        admin: admin.publicKey,
                        program: program.programId,
                        programData: programDataAddress,
                        oracleMappings: oracleMappingAccount,
                        pythPriceInfo: fakePythAccount,
                    },
                    signers: [admin]
                });
        }));
    });
    it('test_update_stsolusd_v2_price', async () => {
        await program.rpc.refreshOnePrice(
            new BN(Tokens.STSOLUSD),
            {
                accounts: {
                    oraclePrices: oracleAccount,
                    oracleMappings: oracleMappingAccount,
                    pythPriceInfo: fakePythAccounts[Tokens.STSOLUSD],
                    clock: SYSVAR_CLOCK_PUBKEY
                },
                signers: []
            });
        {
            let oracle = await program.account.oraclePrices.fetch(oracleAccount);
            checkOraclePrice(Tokens.STSOLUSD, oracle);
        }
    });
    it('test_update_sabermsolsol_v1_price', async () => {
        await program.rpc.refreshOnePrice(
            new BN(Tokens.SABERMSOLSOL),
            {
                accounts: {
                    oraclePrices: oracleAccount,
                    oracleMappings: oracleMappingAccount,
                    pythPriceInfo: fakePythAccounts[Tokens.SABERMSOLSOL],
                    clock: SYSVAR_CLOCK_PUBKEY
                },
                signers: []
            });
        {
            let oracle = await program.account.oraclePrices.fetch(oracleAccount);
            checkOraclePrice(Tokens.SABERMSOLSOL, oracle);
        }
    });
    it('test_update_usdh_usd_v1_price', async () => {
        await program.rpc.refreshOnePrice(
            new BN(Tokens.USDHUSD),
            {
                accounts: {
                    oraclePrices: oracleAccount,
                    oracleMappings: oracleMappingAccount,
                    pythPriceInfo: fakePythAccounts[Tokens.USDHUSD],
                    clock: SYSVAR_CLOCK_PUBKEY
                },
                signers: []
            });
        {
            let oracle = await program.account.oraclePrices.fetch(oracleAccount);
            checkOraclePrice(Tokens.USDHUSD, oracle);
        }
    });
    it('test_set_update_stsolusd_v2_price', async () => {
        let mantissa = new BN('123456789012345678');
        let scale = new BN('15');
        await setFeedPriceSwitchboardV2(
            fakePythProgram,
            mantissa,
            scale,
            fakePythAccounts[Tokens.STSOLUSD]
        );
        initialTokens[Tokens.STSOLUSD].mantissa = mantissa;
        initialTokens[Tokens.STSOLUSD].expo = scale.toNumber();
        await program.rpc.refreshOnePrice(
            new BN(Tokens.STSOLUSD),
            {
                accounts: {
                    oraclePrices: oracleAccount,
                    oracleMappings: oracleMappingAccount,
                    pythPriceInfo: fakePythAccounts[Tokens.STSOLUSD],
                    clock: SYSVAR_CLOCK_PUBKEY
                },
                signers: []
            });
        {
            let oracle = await program.account.oraclePrices.fetch(oracleAccount);
            checkOraclePrice(Tokens.STSOLUSD, oracle);
        }
    });
    it('test_set_update_saber_msol_sol_v1_price', async () => {
        let mantissa = new BN('44859120123');
        let scale = new BN('8');
        await setFeedPriceSwitchboardV1(
            fakePythProgram,
            mantissa,
            scale,
            fakePythAccounts[Tokens.SABERMSOLSOL]
        );
        initialTokens[Tokens.SABERMSOLSOL].mantissa = mantissa;
        initialTokens[Tokens.SABERMSOLSOL].expo = scale.toNumber();
        await program.rpc.refreshOnePrice(
            new BN(Tokens.SABERMSOLSOL),
            {
                accounts: {
                    oraclePrices: oracleAccount,
                    oracleMappings: oracleMappingAccount,
                    pythPriceInfo: fakePythAccounts[Tokens.SABERMSOLSOL],
                    clock: SYSVAR_CLOCK_PUBKEY
                },
                signers: []
            });
        {
            let oracle = await program.account.oraclePrices.fetch(oracleAccount);
            checkOraclePrice(Tokens.SABERMSOLSOL, oracle);
        }
    });
    it('test_set_update_usdh_usd_v1_price', async () => {
        let mantissa = new BN('88675558012');
        let scale = new BN('8');
        await setFeedPriceSwitchboardV1(
            fakePythProgram,
            mantissa,
            scale,
            fakePythAccounts[Tokens.USDHUSD]
        );
        initialTokens[Tokens.USDHUSD].mantissa = mantissa;
        initialTokens[Tokens.USDHUSD].expo = scale.toNumber();
        await program.rpc.refreshOnePrice(
            new BN(Tokens.USDHUSD),
            {
                accounts: {
                    oraclePrices: oracleAccount,
                    oracleMappings: oracleMappingAccount,
                    pythPriceInfo: fakePythAccounts[Tokens.USDHUSD],
                    clock: SYSVAR_CLOCK_PUBKEY
                },
                signers: []
            });
        {
            let oracle = await program.account.oraclePrices.fetch(oracleAccount);
            checkOraclePrice(Tokens.USDHUSD, oracle);
        }
    });
});