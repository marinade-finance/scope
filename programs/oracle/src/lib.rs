use anchor_lang::prelude::*;

declare_id!("6jnS9rvUGxu4TpwwuCeF12Ar9Cqk2vKbufqc6Hnharnz");

#[program]
mod oracle {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>, data: u64) -> ProgramResult {
        let oracle = &mut ctx.accounts.oracle;
        oracle.sol_price = data;
        Ok(())
    }

    pub fn update(ctx: Context<Update>, price: u64) -> ProgramResult {
        let oracle = &mut ctx.accounts.oracle;
        msg!("Setting the price to {}", price);
        oracle.sol_price = price;
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
}

#[account]
#[derive(Default)]
pub struct Oracle {
    pub sol_price: u64,
    pub sol_decimals: u8,
    pub sol_last_updated_slot: u64,
}
