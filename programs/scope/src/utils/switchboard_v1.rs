//use core::num::dec2flt::float::RawFloat;
use crate::{DatedPrice, Price, Result, ScopeError};
use anchor_lang::prelude::*;


use switchboard_program::{
    get_aggregator, get_aggregator_result, AggregatorState, RoundResult, SwitchboardAccountType,
};



pub fn get_price(switchboard_feed_info: &AccountInfo) -> Result<DatedPrice> {
    //const STALE_AFTER_SLOTS_ELAPSED: u64 = 240;

    let account_buf = switchboard_feed_info.try_borrow_data()?;
    // first byte type discriminator
    if account_buf[0] != SwitchboardAccountType::TYPE_AGGREGATOR as u8 {
        msg!("switchboard address not of type aggregator");
        return Err(ScopeError::UnexpectedAccount.into());
    }

    let aggregator: AggregatorState = get_aggregator(switchboard_feed_info)?;
    // if aggregator.version.unwrap() != 1 {
    //     msg!("switchboard version incorrect");
    //     return Err(ScopeError::UnexpectedAccount.into());
    // }
    let round_result: RoundResult = get_aggregator_result(&aggregator)?;

    let price_float = round_result.result.unwrap_or(0.0);
    //let (mantissa, exponent, sign) = price_float.integer_decode();

    let exp = 8u32;
    let price_quotient: f64 = 10u64.pow(exp) as f64;
    let price: u64 = (price_quotient * price_float) as u64;


    Ok(DatedPrice {
        price: Price {
            value: price,
            exp: exp.into(),
        },
        last_updated_slot: round_result.round_open_slot.unwrap(),
        ..Default::default()
    })
}
