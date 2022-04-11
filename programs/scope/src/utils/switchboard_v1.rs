use crate::{DatedPrice, Price, Result, ScopeError};
use anchor_lang::prelude::*;

use switchboard_program::{
    get_aggregator, get_aggregator_result, AggregatorState, RoundResult, SwitchboardAccountType,
};


const SWITCHBOARD_V1_PRICE_DECIMALS: u32 = 8u32;
const PRICE_MULTIPLIER: f64 = 10u64.pow(SWITCHBOARD_V1_PRICE_DECIMALS) as f64;
const MAX_PRICE_FLOAT: f64 = 10_000_000_000f64; //we choose an arbitrarily high number to do a sanity check and avoid overflow in the multiplication below

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


    Ok(DatedPrice {
        price: Price {
            value: price,
            exp: SWITCHBOARD_V1_PRICE_DECIMALS.into(),
        },
        last_updated_slot: round_result.round_open_slot.unwrap(),
        ..Default::default()
    })
}
