use anchor_lang::prelude::*;
use anchor_spl::token::{TokenAccount, Mint};
use num_traits::ToPrimitive;
use crate::{DatedPrice, Price, ScopeError};
use crate::ScopeError::MathOverflow;
use crate::utils::PriceType;

pub fn get_price(price_type: PriceType,
                 yi_underlying_tokens: &Account<TokenAccount>,
                 yi_mint: &Account<Mint>) -> Result<DatedPrice> {
    match price_type {
        PriceType::Pyth => return Err(ScopeError::BadTokenType.into()),
        PriceType::Switchboard => todo!(),
        PriceType::YiToken => (),
    }
    let yi_underlying_tokens_amount = yi_underlying_tokens.amount;
    let yi_mint_supply = yi_mint.supply;
    msg!("\n\n\n\n\n\nyi underlying {}", yi_underlying_tokens_amount);
    msg!("\n\n\n\n\nyi supply {}", yi_mint_supply);
    let price_amount = 100_000_000u128
        .checked_mul(yi_mint_supply.into()).ok_or(MathOverflow)?
        .checked_div(yi_underlying_tokens_amount.into()).ok_or(MathOverflow)?.to_u64().ok_or(MathOverflow)?;
    msg!("\n\n\n\n\n\nmakPrice amount {}", price_amount);
    let dated_price = DatedPrice {
        price: Price {
            value: price_amount,
            exp: 8,
        },
        last_updated_slot: 0u64, //todo: fix this!!!
        ..Default::default()
    };
    Ok(dated_price)
}