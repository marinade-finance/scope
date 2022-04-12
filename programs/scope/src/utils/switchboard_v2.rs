use std::cell::Ref;
use crate::{DatedPrice, Price, Result, ScopeError};
use anchor_lang::prelude::*;

use switchboard_v2::AggregatorAccountData;

const MIN_NUM_SUCCESS: u32 = 1u32;

pub fn get_price(switchboard_feed_info: &AccountInfo) -> Result<DatedPrice> {
    let feed = AggregatorAccountData::new(switchboard_feed_info)
        .map_err(|_| ScopeError::SwitchboardV2Error)?;

    let price_switchboard_desc = feed
        .get_result()
        .map_err(|_| ScopeError::SwitchboardV2Error)?;
    if price_switchboard_desc.mantissa < 0 {
        msg!("Switchboard oracle price is negative which is not allowed");
        return Err(ScopeError::PriceNotValid.into());
    }
    let price: u64 = price_switchboard_desc.mantissa.try_into().map_err(|_| ScopeError::MathOverflow)?;
    let exp: u64 = price_switchboard_desc.scale.try_into().map_err(|_| ScopeError::MathOverflow)?;
    let slot = feed.latest_confirmed_round.round_open_slot;
    validate_valid_price(price, exp, slot, feed)
}

pub fn validate_valid_price(price: u64, exp: u64, slot: u64, feed: Ref<AggregatorAccountData>) -> Result<DatedPrice> {
        let dated_price = DatedPrice {
            price: Price { value: price, exp },
            last_updated_slot: slot,
            ..Default::default()
        };
        if cfg!(feature = "skip_price_validation") {
            return Ok(dated_price);
        };
    let num_success = feed.latest_confirmed_round.num_success;
    if num_success >= MIN_NUM_SUCCESS {
        Ok(dated_price)
    }
    else {
        Err(ScopeError::PriceNotValid.into())
    }
}
