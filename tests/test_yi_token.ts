require('dotenv').config();
import {
  Connection,
  ConnectionConfig,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { BN, Program, Provider, setProvider } from '@project-serum/anchor';
import NodeWallet from '@project-serum/anchor/dist/cjs/nodewallet';
import { Decimal } from 'decimal.js';
import * as chai from 'chai';
import { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiDecimalJs from 'chai-decimaljs';
import * as global from './global';
import { PriceType, Tokens, createFakeAccounts, mapAnchorError } from './utils';

chai.use(chaiAsPromised);
chai.use(chaiDecimalJs(Decimal));

const initialTokens = [
  {
    price: new Decimal('228.41550900'),
    ticker: Buffer.from('SOL'),
    decimals: 8,
    priceType: PriceType.Pyth,
    mantissa: new BN(0),
    expo: 0,
  },
  {
    price: new Decimal('4726.59830000'),
    ticker: Buffer.from('ETH'),
    decimals: 8,
    priceType: PriceType.Pyth,
    mantissa: new BN(0),
    expo: 0,
  },
  {
    price: new Decimal('64622.36900000'),
    ticker: Buffer.from('BTC'),
    decimals: 8,
    priceType: PriceType.Pyth,
    mantissa: new BN(0),
    expo: 0,
  },
  {
    price: new Decimal('7.06975570'),
    ticker: Buffer.from('SRM'),
    decimals: 8,
    priceType: PriceType.Pyth,
    mantissa: new BN(0),
    expo: 0,
  },
  {
    price: new Decimal('11.10038050'),
    ticker: Buffer.from('RAY'),
    decimals: 8,
    priceType: PriceType.Pyth,
    mantissa: new BN(0),
    expo: 0,
  },
  {
    price: new Decimal('59.17104600'),
    ticker: Buffer.from('FTT'),
    decimals: 8,
    priceType: PriceType.Pyth,
    mantissa: new BN(0),
    expo: 0,
  },
  {
    price: new Decimal('253.41550900'),
    ticker: Buffer.from('MSOL'),
    decimals: 8,
    priceType: PriceType.Pyth,
    mantissa: new BN(0),
    expo: 0,
  },
  {
    price: new Decimal('228.415509'),
    ticker: Buffer.from('UST'),
    decimals: 8,
    priceType: PriceType.Pyth,
    mantissa: new BN(0),
    expo: 0,
  },
  {
    price: new Decimal('11.10038050'),
    ticker: Buffer.from('BNB'),
    decimals: 8,
    priceType: PriceType.Pyth,
    mantissa: new BN(0),
    expo: 0,
  },
  {
    price: new Decimal('59.17104600'),
    ticker: Buffer.from('AVAX'),
    decimals: 8,
    priceType: PriceType.Pyth,
    mantissa: new BN(0),
    expo: 0,
  },
  {
    price: new Decimal('0.90987600'),
    ticker: Buffer.from('STSOLUST'),
    decimals: 8,
    priceType: PriceType.YiToken,
    mantissa: new BN(0),
    expo: 0,
  },
  {
    price: new Decimal('343.92109348'),
    ticker: Buffer.from('SABERMSOLSOL'),
    decimals: 8,
    priceType: PriceType.SwitchboardV1,
    mantissa: new BN('34392109348'),
    expo: 8,
  },
  {
    price: new Decimal('999.20334456'),
    ticker: Buffer.from('USDHUSD'),
    decimals: 8,
    priceType: PriceType.SwitchboardV1,
    mantissa: new BN('99920334456'),
    expo: 8,
  },
  {
    mantissa: new BN('474003240021234567'),
    expo: 15,
    ticker: Buffer.from('STSOLUSD'),
    price: new Decimal('474.003240021234567'),
    decimals: 8,
    priceType: PriceType.SwitchboardV2,
  },
];

const PRICE_FEED = 'yi_test_feed';

const YI_UNDERLYING_TOKENS = new PublicKey('EDLcx5J9aBkA6a7V5aQLqb8nnBByNhhNn8Qr9QksHobc');
const YI_MINT = new PublicKey('CGczF9uYdSVXmSr9swMafhF1ktHsi6ygcgTHWL71XNZ9');

describe('Yi Scope tests', () => {
  const keypair_acc = Uint8Array.from(
    Buffer.from(JSON.parse(require('fs').readFileSync(`./keys/${global.getCluster()}/owner.json`)))
  );
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

  before('Initialize Scope and pyth prices', async () => {
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

    fakePythAccounts = await createFakeAccounts(fakePythProgram, initialTokens);
  });

  it('test_set_oracle_mappings', async () => {
    await Promise.all(
      fakePythAccounts.map(async (fakePythAccount, idx): Promise<any> => {
        console.log(`Set mapping of ${initialTokens[idx].ticker}`);

        await program.rpc.updateMapping(new BN(idx), initialTokens[idx].priceType, {
          accounts: {
            admin: admin.publicKey,
            program: program.programId,
            programData: programDataAddress,
            oracleMappings: oracleMappingAccount,
            priceInfo: fakePythAccount,
          },
          signers: [admin],
        });
      })
    );
  });

  it('test_update_Yi_price', async () => {
    let oracle = await program.account.oraclePrices.fetch(oracleAccount);
    let price = oracle.prices[10].price;
    let value = price.value.toNumber();
    let expo = price.exp.toNumber();
    let in_decimal_before = new Decimal(value).mul(new Decimal(10).pow(new Decimal(-expo)));
    console.log('Calling Refresh now.');
    await program.rpc.refreshYiToken(new BN(Tokens.STSOLUST), {
      accounts: {
        oraclePrices: oracleAccount,
        oracleMappings: oracleMappingAccount,
        yiUnderlyingTokens: YI_UNDERLYING_TOKENS,
        yiMint: YI_MINT,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
      signers: [],
    });
    oracle = await program.account.oraclePrices.fetch(oracleAccount);
    price = oracle.prices[10].price;
    value = price.value.toNumber();
    expo = price.exp.toNumber();
    let in_decimal_after = new Decimal(value).mul(new Decimal(10).pow(new Decimal(-expo)));
    expect(in_decimal_after.toNumber()).not.eq(in_decimal_before.toNumber());
  });
  it('test_update_Yi_price_fails_for_non_Yi_tokens', async () => {
    await Promise.all(
      initialTokens.map(async (tokenData, idx) => {
        let nonYiTokenUpdate = mapAnchorError(
          program.rpc.refreshYiToken(new BN(idx), {
            accounts: {
              oraclePrices: oracleAccount,
              oracleMappings: oracleMappingAccount,
              yiUnderlyingTokens: YI_UNDERLYING_TOKENS,
              yiMint: YI_MINT,
              clock: SYSVAR_CLOCK_PUBKEY,
            },
            signers: [],
          })
        );
        if (tokenData.priceType != PriceType.YiToken) {
          await expect(nonYiTokenUpdate).to.be.rejectedWith('6008: The token type received is invalid');
          console.log(`Failed as expected for non-Yi token: ${tokenData.ticker}`);
        }
      })
    );
  });
});
