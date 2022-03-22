pub mod pyth;

use crate::{DatedPrice, ScopeError};
use anchor_lang::prelude::{error, AccountInfo, Context, Result};
use num_enum::{IntoPrimitive, TryFromPrimitive};
use serde::{Deserialize, Serialize};

pub fn check_context<T>(ctx: &Context<T>) -> Result<()> {
    //make sure there are no extra accounts
    if !ctx.remaining_accounts.is_empty() {
        return Err(error!(ScopeError::UnexpectedAccount));
    }

    Ok(())
}

#[derive(Serialize, Deserialize, IntoPrimitive, TryFromPrimitive)]
#[repr(u8)]
pub enum PriceType {
    Pyth,
    Switchboard,
    YiToken,
}

pub fn get_price(
    price_type: PriceType,
    price_acc: &AccountInfo,
    token: usize,
) -> crate::Result<DatedPrice> {
    match price_type {
        PriceType::Pyth => pyth::get_price(price_acc),
        PriceType::Switchboard => todo!(),
        PriceType::YiToken => todo!(),
    }
}
