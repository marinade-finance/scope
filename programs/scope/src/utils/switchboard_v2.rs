use crate::{DatedPrice, Price, Result, ScopeError};
use anchor_lang::prelude::*;
use std::cell::Ref;
use std::cmp::min;

use switchboard_v2::decimal::SwitchboardDecimal;
use switchboard_v2::AggregatorAccountData;

const MIN_NUM_SUCCESS: u32 = 3u32;
const MIN_CONFIDENCE_PERCENTAGE: u128 = 2u128;

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
    let price: u64 = price_switchboard_desc
        .mantissa
        .try_into()
        .map_err(|_| ScopeError::MathOverflow)?;
    let exp: u32 = price_switchboard_desc.scale;
    let slot = feed.latest_confirmed_round.round_open_slot;
    let stdev_mantissa = feed.latest_confirmed_round.std_deviation.mantissa;
    let stdev_scale = feed.latest_confirmed_round.std_deviation.scale;
    validate_valid_price(
        price,
        exp,
        slot,
        feed.min_oracle_results,
        feed.latest_confirmed_round.num_success,
        stdev_mantissa,
        stdev_scale,
    )
}

pub fn validate_valid_price(
    price: u64,
    exp: u32,
    slot: u64,
    min_oracle_results: u32,
    num_success: u32,
    stdev_mantissa: i128,
    stdev_scale: u32,
) -> Result<DatedPrice> {
    let dated_price = DatedPrice {
        price: Price {
            value: price,
            exp: exp.into(),
        },
        last_updated_slot: slot,
        ..Default::default()
    };
    if cfg!(feature = "skip_price_validation") {
        return Ok(dated_price);
    };
    validate_min_success(min_oracle_results, num_success)?;
    validate_confidence(price, exp, stdev_mantissa, stdev_scale)?;

    Ok(dated_price)
}

fn validate_min_success(min_oracle_results: u32, num_success: u32) -> Result<()> {
    let min_num_success_for_oracle = min(min_oracle_results, MIN_NUM_SUCCESS);
    if num_success < min_num_success_for_oracle {
        return Err(ScopeError::PriceNotValid.into());
    };
    Ok(())
}

fn validate_confidence(price: u64, exp: u32, stdev_mantissa: i128, stdev_scale: u32) -> Result<()> {
    let stdev_mantissa: u128 = stdev_mantissa
        .try_into()
        .map_err(|_| ScopeError::MathOverflow)?;
    let min_scale = min(exp, stdev_scale);
    let price_scaling_factor = 10u128
        .checked_pow(exp.checked_sub(min_scale).ok_or(ScopeError::MathOverflow)?)
        .ok_or(ScopeError::MathOverflow)?;
    let stdev_scaling_factor = 10u128
        .checked_pow(
            stdev_scale
                .checked_sub(min_scale)
                .ok_or(ScopeError::MathOverflow)?,
        )
        .ok_or(ScopeError::MathOverflow)?;
    let price_u128: u128 = price.into();
    let price_scaled = price_u128
        .checked_mul(price_scaling_factor)
        .ok_or(ScopeError::MathOverflow)?;
    let stdev_scaled = stdev_mantissa
        .checked_mul(stdev_scaling_factor)
        .ok_or(ScopeError::MathOverflow)?;
    if price_scaled > stdev_scaled {
        let abs_diff_x100 = price_scaled
            .checked_sub(stdev_scaled)
            .ok_or(ScopeError::MathOverflow)?
            .checked_mul(100)
            .ok_or(ScopeError::MathOverflow)?;
        let diff_round_percentage = abs_diff_x100
            .checked_div(price_scaled)
            .ok_or(ScopeError::MathOverflow)?;
        if diff_round_percentage < (100 - MIN_CONFIDENCE_PERCENTAGE) {
            return Err(ScopeError::PriceNotValid.into());
        };
    } else {
        return Err(ScopeError::PriceNotValid.into());
    };
    Ok(())
}

fn validate_confidence_percentage(price_scaled: u128, abs_diff_x100: u128) -> Result<()> {
    let diff_round_percentage = abs_diff_x100
        .checked_div(price_scaled)
        .ok_or(ScopeError::MathOverflow)?;
    if diff_round_percentage < (100 - MIN_CONFIDENCE_PERCENTAGE) {
        msg!(
            "\n\n\n\n\n\nprice scaled {}, abs_diff_x100 {}, diff round percentage {}",
            price_scaled,
            abs_diff_x100,
            diff_round_percentage
        );
        return Err(ScopeError::PriceNotValid.into());
    };
    Ok(())
}
