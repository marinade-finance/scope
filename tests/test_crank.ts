import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { AnchorProvider, BN, Program, setProvider } from '@project-serum/anchor';
import { sleep } from '@project-serum/common';
import NodeWallet from '@project-serum/anchor/dist/cjs/nodewallet';
import { Decimal } from 'decimal.js';
import { expect } from 'chai';
import * as global from './global';
import * as bot from './bot_utils';
import { initialTokens, getScopePriceDecimal } from './utils';
import { createFakeAccounts, ITokenEntry } from './oracle_utils/mock_oracles';

require('dotenv').config();

const date = Date.now();
const PRICE_FEED = 'crank_test_feed' + date;

function getRevisedIndex(token: number): number {
  // Create a bit of spread in the mapping to make bot's life harder
  if (token < initialTokens.length / 2) {
    return token;
  } else {
    // Put last tokens at the end
    return global.MAX_NB_TOKENS - token - 1;
  }
}

function checkAllOraclePrices(oraclePrices: any, tokenEntries: ITokenEntry[]) {
  console.log(`Check all prices`);
  tokenEntries.map((tokenEntry, idx) => {
    let in_decimal = getScopePriceDecimal(getRevisedIndex(idx), oraclePrices);
    expect(in_decimal).decimal.eq(tokenEntry.price);
  });
}

describe('Scope crank bot tests', () => {
  // TODO: have a different keypair for the crank to check that other people can actually crank
  const keypair_path = `./keys/${global.getCluster()}/owner.json`;
  const keypair_acc = Uint8Array.from(Buffer.from(JSON.parse(require('fs').readFileSync(keypair_path))));
  const admin = Keypair.fromSecretKey(keypair_acc);

  const url = 'http://127.0.0.1:8899';
  const options = AnchorProvider.defaultOptions();
  options.skipPreflight = true;
  options.commitment = 'processed';
  const connection = new Connection(url, options.commitment);

  const wallet = new NodeWallet(admin);
  const provider = new AnchorProvider(connection, wallet, options);
  setProvider(provider);

  const program = new Program(global.ScopeIdl, global.getScopeProgramId(), provider);

  const fakeOraclesProgram = new Program(global.FakeOraclesIdl, global.getFakeOraclesProgramId(), provider);
  let fakeAccounts: ITokenEntry[];

  let programDataAddress: PublicKey;
  let confAccount: PublicKey;
  let oracleAccount: PublicKey;
  let oracleMappingAccount: PublicKey;

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

  before('Initialize Scope and mock_oracles prices', async () => {
    programDataAddress = await global.getProgramDataAddress(program.programId);
    confAccount = (
      await PublicKey.findProgramAddress(
        [Buffer.from('conf', 'utf8'), Buffer.from(PRICE_FEED, 'utf8')],
        program.programId
      )
    )[0];

    let oracleAccount_kp = Keypair.generate();
    let oracleMappingAccount_kp = Keypair.generate();

    oracleAccount = oracleAccount_kp.publicKey;
    oracleMappingAccount = oracleMappingAccount_kp.publicKey;

    console.log(`program data address is ${programDataAddress.toBase58()}`);

    await program.rpc.initialize(PRICE_FEED, {
      accounts: {
        admin: admin.publicKey,
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

    console.log('Initialize Tokens mock_oracles prices and oracle mappings');

    fakeAccounts = await createFakeAccounts(fakeOraclesProgram, initialTokens);

    await Promise.all(
      fakeAccounts.map(async (fakeOracleAccount, idx): Promise<any> => {
        await program.rpc.updateMapping(new BN(getRevisedIndex(idx)), fakeOracleAccount.getType(), PRICE_FEED, {
          accounts: {
            admin: admin.publicKey,
            configuration: confAccount,
            oracleMappings: oracleMappingAccount,
            priceInfo: fakeOracleAccount.account,
          },
          signers: [admin],
        });
        // console.log(`Set mapping of ${fakeOracleAccount.ticker}`);
      })
    );
  });

  // TODO: error cases + check outputs:
  // - start with the wrong program id
  // - start without enough funds to pay
  // - bad accounts (after PDAs removal)

  it('test_one_price_change', async () => {
    scopeBot = new bot.ScopeBot(program.programId, keypair_path, PRICE_FEED);
    await scopeBot.crank();

    await scopeBot.nextLogMatches((c) => c.includes('Prices list refreshed successfully'), 10000);

    await sleep(1500); // One block await

    {
      let oracle = await program.account.oraclePrices.fetch(oracleAccount);
      checkAllOraclePrices(oracle, fakeAccounts);
    }
  });

  it('test_5_loop_price_changes', async () => {
    scopeBot = new bot.ScopeBot(program.programId, keypair_path, PRICE_FEED);
    await scopeBot.crank();
    for (let i = 0; i < 5; i++) {
      // increase all prices at each loop
      await Promise.all(
        fakeAccounts.map(async (asset) => {
          let new_price = asset.price.add(new Decimal('0.500'));
          await asset.updatePrice(new_price);
        })
      );

      await sleep(2000);

      scopeBot.flushLogs();

      await scopeBot.nextLogMatches((c) => c.includes('Prices list refreshed successfully'), 10000);
      await sleep(2000);

      let oracle = await program.account.oraclePrices.fetch(oracleAccount);
      checkAllOraclePrices(oracle, fakeAccounts);
    }
  });
});
