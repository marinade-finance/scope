use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("6jnS9rvUGxu4TpwwuCeF12Ar9Cqk2vKbufqc6Hnharnz");

#[program]
mod oracle {
    use super::*;
    pub fn initialize(_ctx: Context<Initialize>) -> ProgramResult {
        Ok(())
    }

    pub fn update(ctx: Context<Update>, token: u8, price: u64) -> ProgramResult {
        let oracle = &mut ctx.accounts.oracle;
        let clock = &ctx.accounts.clock;
        let token = Token::from(token);
        let slot = clock.slot;
        let epoch = clock.epoch;
        let timestamp = clock.epoch;

        msg!(
            "Setting the price of {:?} to {} as of Slot:{} Epoch:{} TS:{}",
            token,
            price,
            slot,
            epoch,
            timestamp
        );

        match token {
            Token::SOL => oracle.sol.price = price,
            Token::ETH => oracle.eth.price = price,
            Token::BTC => oracle.btc.price = price,
            Token::SRM => oracle.srm.price = price,
            Token::RAY => oracle.ray.price = price,
            Token::FTT => oracle.ftt.price = price,
        };

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin)]
    pub oracle: Account<'info, Oracle>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Update<'info> {
    pub admin: Signer<'info>,
    #[account(mut)]
    pub oracle: Account<'info, Oracle>,
    pub clock: Sysvar<'info, Clock>,
}

#[zero_copy]
#[derive(Debug, Eq, PartialEq, BorshDeserialize, BorshSerialize, Default)]
pub struct Price {
    pub price: u64,
    pub decimals: u8,
    pub last_updated_slot: u64,
}

#[account]
#[derive(Default)]
pub struct Oracle {
    pub sol: Price,
    pub eth: Price,
    pub btc: Price,
    pub srm: Price,
    pub ftt: Price,
    pub ray: Price,
}

#[derive(Eq, PartialEq, Debug, Clone, Copy)]
pub enum Token {
    SOL = 0,
    ETH = 1,
    BTC = 2,
    SRM = 3,
    RAY = 4,
    FTT = 5,
}

impl Token {
    pub fn from(num: u8) -> Token {
        use Token::*;
        match num {
            0 => SOL,
            1 => ETH,
            2 => BTC,
            3 => SRM,
            4 => RAY,
            5 => FTT,
            _ => unimplemented!(),
        }
    }
}
