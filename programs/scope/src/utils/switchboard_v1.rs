use crate::{DatedPrice, Price, Result, ScopeError};
use anchor_lang::prelude::*;
use std::cmp::min;

use switchboard_program::{
    get_aggregator, get_aggregator_result, mod_AggregatorState, AggregatorState, RoundResult,
    SwitchboardAccountType,
};

const SWITCHBOARD_V1_PRICE_DECIMALS: u32 = 8u32;
const PRICE_MULTIPLIER: f64 = 10u64.pow(SWITCHBOARD_V1_PRICE_DECIMALS) as f64;
const MAX_PRICE_FLOAT: f64 = 10_000_000_000f64; //we choose an arbitrarily high number to do a sanity check and avoid overflow in the multiplication below
const MIN_NUM_SUCCESS: i32 = 3i32;

pub fn get_price(switchboard_feed_info: &AccountInfo) -> Result<DatedPrice> {
    let account_buf = switchboard_feed_info.try_borrow_data()?;
    // first byte type discriminator
    if account_buf[0] != SwitchboardAccountType::TYPE_AGGREGATOR as u8 {
        msg!("switchboard address not of type aggregator");
        return Err(ScopeError::UnexpectedAccount.into());
    }

    let aggregator: AggregatorState = get_aggregator(switchboard_feed_info)?;
    let round_result: RoundResult = get_aggregator_result(&aggregator)?;

    let price_float = round_result.result.ok_or(ScopeError::PriceNotValid)?;

    if price_float >= MAX_PRICE_FLOAT {
        return Err(ScopeError::MathOverflow.into());
    }
    let price: u64 = (price_float * PRICE_MULTIPLIER) as u64;
    let slot: u64 = round_result.round_open_slot.unwrap();
    validate_valid_price(price, slot, aggregator, round_result)
}

pub fn validate_valid_price(
    price: u64,
    slot: u64,
    aggregator: AggregatorState,
    round_result: RoundResult,
) -> Result<DatedPrice> {
    let dated_price = DatedPrice {
        price: Price {
            value: price,
            exp: SWITCHBOARD_V1_PRICE_DECIMALS.into(),
        },
        last_updated_slot: slot,
        ..Default::default()
    };
    if cfg!(feature = "skip_price_validation") {
        return Ok(dated_price);
    };

    let aggregator_min_confirmations = aggregator
        .configs
        .ok_or(ScopeError::PriceNotValid)?
        .min_confirmations
        .ok_or(ScopeError::PriceNotValid)?;

    let min_num_success_for_oracle = min(aggregator_min_confirmations, MIN_NUM_SUCCESS);
    let num_success = round_result.num_success.ok_or(ScopeError::PriceNotValid)?;
    if num_success < min_num_success_for_oracle {
        return Err(ScopeError::PriceNotValid.into());
    };

    Ok(dated_price)
}
