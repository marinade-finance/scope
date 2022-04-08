//use core::num::dec2flt::float::RawFloat;
use crate::{DatedPrice, Price, Result, ScopeError};
use anchor_lang::prelude::*;



use switchboard_v2::AggregatorAccountData;

pub fn get_price(
    switchboard_feed_info: &AccountInfo
) -> Result<DatedPrice> {
    let feed = AggregatorAccountData::new(switchboard_feed_info).map_err(|_| ScopeError::SwitchboardV2Error)?;

    let price_switchboard_desc = feed.get_result().map_err(|_| ScopeError::SwitchboardV2Error)?;
    if price_switchboard_desc.mantissa < 0 {
        msg!("Switchboard oracle price is negative which is not allowed");
        return Err(ScopeError::PriceNotValid.into());
    }
    let price: u64 = price_switchboard_desc.mantissa as u64;
    let exp: u64 = price_switchboard_desc.scale as u64;

    Ok(DatedPrice {
        price: Price {
            value: price,
            exp,
        },
        last_updated_slot: feed.latest_confirmed_round.round_open_slot,
        ..Default::default()
    })
}