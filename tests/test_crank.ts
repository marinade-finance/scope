require('dotenv').config();
import { Keypair, PublicKey, SystemProgram, SYSVAR_CLOCK_PUBKEY, Connection, ConnectionConfig, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { Provider, Program, setProvider, BN } from "@project-serum/anchor"
import { sleep } from '@project-serum/common';
import NodeWallet from '@project-serum/anchor/dist/cjs/nodewallet';
import * as pythUtils from './pyth_utils';
import { Decimal } from 'decimal.js';
import * as chai from 'chai';
import { expect } from 'chai';
import chaiDecimalJs from 'chai-decimaljs';
import * as global from './global';
import * as bot from './bot_utils';

chai.use(chaiDecimalJs(Decimal));


enum Tokens {
    SOL = 0,
    ETH,
    BTC,
    SRM,
    RAY,
    FTT,
    MSOL
}

let tokenList = [
    {
        price: new Decimal('228.41550900'),
        ticker: Buffer.from('SOL'),
        decimals: 8
    },
    {
        price: new Decimal('4726.59830000'),
        ticker: Buffer.from('ETH'),
        decimals: 8
    },
    {
        price: new Decimal('64622.36900000'),
        ticker: Buffer.from('BTC'),
        decimals: 8
    },
    {
        price: new Decimal('7.06975570'),
        ticker: Buffer.from('SRM'),
        decimals: 8
    },
    {
        price: new Decimal('11.10038050'),
        ticker: Buffer.from('RAY'),
        decimals: 8
    },
    {
        price: new Decimal('59.17104600'),
        ticker: Buffer.from('FTT'),
        decimals: 8
    },
    {
        price: new Decimal('253.41550900'),
        ticker: Buffer.from('MSOL'),
        decimals: 8
    }
]

const PRICE_FEED = "crank_test_feed"

function getRevisedIndex(token: number): number {
    // Create a bit of spread in the mapping to make bot's life harder
    if (token < (tokenList.length / 2)) {
        return token;
    } else {
        // Put last tokens at the end
        return global.MAX_NB_TOKENS - token - 1;
    }
}

function checkAllOraclePrices(oraclePrices: any) {
    console.log(`Check all prices`)
    tokenList.map((tokenData, idx) => {
        let price = oraclePrices.prices[getRevisedIndex(idx)].price;
        let value = price.value.toNumber();
        let expo = price.exp.toNumber();
        let in_decimal = new Decimal(value).mul((new Decimal(10)).pow(new Decimal(-expo)))
        expect(in_decimal).decimal.eq(tokenData.price);
    });
}

describe("Scope crank bot tests", () => {
    // TODO: have a different keypair for the crank to check that other people can actually crank
    const keypair_path = `./keys/${global.getCluster()}/owner.json`;
    const keypair_acc = Uint8Array.from(Buffer.from(JSON.parse(require('fs').readFileSync(keypair_path))));
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

    let programDataAddress: PublicKey;
    let confAccount: PublicKey;
    let oracleAccount: PublicKey;
    let oracleMappingAccount: PublicKey;

    const setAllPythPrices = async () => {
        await Promise.all(tokenList.map(async (asset, idx): Promise<any> => {
            const oracleAddress = await pythUtils.setFeedPrice(
                fakePythProgram,
                asset.price,
                fakePythAccounts[idx]
            )
        }));
    }

    // NOTE: this only works when the test cases within this describe are
    // executed sequentially
    let scopeBot: bot.ScopeBot;
    function killBot() {
        if (scopeBot) {
            console.log('killing scopeBot process PID =', scopeBot.pid());
            scopeBot.stop();
        }
    }
    afterEach(() => {
        killBot();
    });

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

        fakePythAccounts = await Promise.all(tokenList.map(async (asset): Promise<any> => {
            console.log(`Adding ${asset.ticker.toString()}`)

            const oracleAddress = await pythUtils.createPriceFeed({
                oracleProgram: fakePythProgram,
                initPrice: asset.price,
                expo: -asset.decimals
            })

            return oracleAddress;
        }));

        await Promise.all(fakePythAccounts.map(async (fakePythAccount, idx): Promise<any> => {
            console.log(`Set mapping of ${tokenList[idx].ticker}`)

            await program.rpc.updateMapping(
                new BN(getRevisedIndex(idx)),
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

    // TODO: error cases + check outputs:
    // - start with the wrong program id
    // - start without enough funds to pay
    // - bad accounts (after PDAs removal)

    it('test_one_price_change', async () => {
        scopeBot = new bot.ScopeBot(program.programId, keypair_path, PRICE_FEED);
        await scopeBot.crank();

        await scopeBot.nextLogMatches((c) => c.includes('Prices refreshed successfully'), 10000);
        await sleep(500);// One block await

        {
            let oracle = await program.account.oraclePrices.fetch(oracleAccount);
            checkAllOraclePrices(oracle);
        }
    });

    it('test_5_loop_price_changes', async () => {
        scopeBot = new bot.ScopeBot(program.programId, keypair_path, PRICE_FEED);
        await scopeBot.crank();
        for (let i = 0; i < 5; i++) {
            // increase all prices at each loop
            for (var asset of tokenList) {
                asset.price = asset.price.add(new Decimal('0.500'));
            }
            await setAllPythPrices();

            await scopeBot.nextLogMatches((c) => c.includes('Prices refreshed successfully'), 10000);
            await sleep(500);// One block await

            let oracle = await program.account.oraclePrices.fetch(oracleAccount);
            checkAllOraclePrices(oracle);
        }
    });

});