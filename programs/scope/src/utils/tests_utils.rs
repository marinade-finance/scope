#[cfg(test)]
mod tests {
    use crate::utils::{switchboard_v1, switchboard_v2};
    use crate::Pubkey;
    use spl_token::solana_program::hash::Hash;
    use switchboard_program::{mod_AggregatorState, AggregatorState, RoundResult};

    fn get_structs_from_min_confirmations_and_num_success(
        min_confirmations: i32,
        num_success: i32,
    ) -> (AggregatorState, RoundResult) {
        let configs = mod_AggregatorState::Configs {
            min_confirmations: Some(min_confirmations),
            ..mod_AggregatorState::Configs::default()
        };
        let aggregator = AggregatorState {
            configs: Some(configs),
            ..AggregatorState::default()
        };
        let round_result = RoundResult {
            num_success: Some(num_success),
            ..RoundResult::default()
        };
        (aggregator, round_result)
    }

    //V1 Tests
    #[test]
    fn test_valid_switchboard_v1_price() {
        let (aggregator, round_result) = get_structs_from_min_confirmations_and_num_success(1, 1);
        assert!(switchboard_v1::validate_valid_price(1, 1, aggregator, round_result).is_ok());
    }

    #[test]
    fn test_valid_switchboard_v1_price_min_1_success_2() {
        let (aggregator, round_result) = get_structs_from_min_confirmations_and_num_success(1, 2);
        assert!(switchboard_v1::validate_valid_price(1, 1, aggregator, round_result).is_ok());
    }

    #[test]
    fn test_valid_switchboard_v1_price_default_min_success() {
        let (aggregator, round_result) = get_structs_from_min_confirmations_and_num_success(4, 3);
        assert!(switchboard_v1::validate_valid_price(1, 1, aggregator, round_result).is_ok());
    }

    #[test]
    fn test_invalid_switchboard_v1_price_1() {
        let (aggregator, round_result) = get_structs_from_min_confirmations_and_num_success(2, 1);
        assert!(switchboard_v1::validate_valid_price(1, 1, aggregator, round_result).is_err());
    }

    #[test]
    fn test_invalid_switchboard_v1_price_2() {
        let (aggregator, round_result) = get_structs_from_min_confirmations_and_num_success(4, 2);
        assert!(switchboard_v1::validate_valid_price(1, 1, aggregator, round_result).is_err());
    }

    //V2 num success tests
    #[test]
    fn test_valid_switchboard_v2_price() {
        assert!(switchboard_v2::validate_valid_price(1, 1, 1, 1, 1, 0, 1).is_ok());
    }

    #[test]
    fn test_valid_switchboard_v2_price_min_1_success_2() {
        assert!(switchboard_v2::validate_valid_price(1, 1, 1, 1, 2, 0, 1).is_ok());
    }

    #[test]
    fn test_valid_switchboard_v2_price_default_min_success() {
        assert!(switchboard_v2::validate_valid_price(1, 1, 1, 4, 3, 0, 1).is_ok());
    }

    #[test]
    fn test_invalid_switchboard_v2_price_1() {
        assert!(switchboard_v2::validate_valid_price(1, 1, 1, 2, 1, 0, 1).is_err());
    }

    #[test]
    fn test_invalid_switchboard_v2_price_2() {
        assert!(switchboard_v2::validate_valid_price(1, 1, 1, 4, 2, 0, 1).is_err());
    }

    //V2 Standard Deviation Confidence Tests
    #[test]
    fn test_valid_switchboard_v2_price_stdev_2percent() {
        assert!(switchboard_v2::validate_valid_price(100, 3, 1, 1, 1, 20, 2).is_ok());
    }

    #[test]
    fn test_valid_switchboard_v2_price_stdev_1_point_99_percent() {
        assert!(switchboard_v2::validate_valid_price(100, 3, 1, 1, 1, 1999, 0).is_ok());
    }

    #[test]
    fn test_valid_switchboard_v2_price_stdev_zero() {
        assert!(switchboard_v2::validate_valid_price(100, 3, 1, 1, 1, 0, 30).is_ok());
    }

    #[test]
    fn test_invalid_switchboard_v2_price_stdev_above_2percent() {
        assert!(switchboard_v2::validate_valid_price(100, 3, 1, 1, 1, 2001, 0).is_err());
    }

    #[test]
    fn test_invalid_switchboard_v2_price_stdev_above_2percent_2() {
        assert!(switchboard_v2::validate_valid_price(100, 3, 1, 1, 1, 201, 1).is_err());
    }

    #[test]
    fn test_invalid_switchboard_v2_price_stdev_higher_than_price() {
        assert!(switchboard_v2::validate_valid_price(100, 3, 1, 1, 1, 100001, 0).is_err());
    }
}
