use anyhow::{format_err, Result};
use serum_common::client::rpc::{
    create_and_init_mint, create_token_account, mint_to_new_account, send_txn, simulate_transaction,
};
use solana_client::rpc_client::RpcClient;
use solana_client::rpc_config::RpcSendTransactionConfig;
use solana_sdk::signature::Keypair;

// fn read_keypair_file(s: &str) -> Result<Keypair> {
//     solana_sdk::signature::read_keypair_file(s)
//         .map_err(|_| format_err!("failed to read keypair from {}", s))
// }

#[cfg(test)]
mod tests {
    use std::{str::FromStr, sync::Arc};

    use serum_common::client::Cluster;
    use solana_sdk::{
        instruction::{AccountMeta, Instruction},
        pubkey::Pubkey,
        signer::Signer,
        transaction::Transaction,
    };

    use super::*;
    #[test]
    fn it_works() {
        let result = 2 + 2;
        assert_eq!(result, 4);
    }

    fn admin() -> Keypair {
        Keypair::from_bytes(&[
            241, 101, 13, 165, 53, 150, 114, 216, 162, 246, 157, 94, 156, 209, 145, 37, 186, 13,
            219, 120, 66, 196, 128, 253, 177, 46, 0, 70, 68, 211, 238, 83, 155, 17, 157, 105, 115,
            161, 0, 60, 146, 250, 19, 171, 63, 222, 211, 135, 37, 102, 222, 216, 142, 131, 67, 196,
            185, 182, 202, 219, 55, 24, 135, 90,
        ])
        .unwrap()
    }
    fn oracle() -> Keypair {
        Keypair::from_bytes(&[
            13, 85, 68, 250, 51, 221, 36, 18, 8, 81, 106, 50, 19, 239, 90, 182, 240, 204, 238, 25,
            77, 100, 71, 81, 60, 48, 61, 83, 136, 55, 225, 249, 202, 109, 210, 61, 31, 222, 15,
            159, 6, 111, 66, 97, 117, 35, 25, 16, 250, 53, 81, 214, 45, 189, 27, 22, 142, 77, 213,
            210, 106, 205, 8, 10,
        ])
        .unwrap()
    }

    #[test]
    fn send_transaction() {
        let cluster = Cluster::Localnet;
        let client = RpcClient::new(cluster.url().to_string());
        let client = Arc::new(client);

        let admin = admin();
        let oracle = oracle();

        let (recent_hash, _fee_calc) = client.get_recent_blockhash().unwrap();
        println!("Sending request ...");
        let mut account_metas = Vec::with_capacity(2);
        account_metas.push(AccountMeta::new(admin.pubkey(), true));
        account_metas.push(AccountMeta::new(oracle.pubkey(), false));

        let mut instruction_data = vec![];
        let update_instruction_sighash = [219, 200, 88, 176, 158, 63, 253, 127];
        let update_instruction_arg = borsh::to_vec(&(20 as u64)).unwrap();
        instruction_data.extend_from_slice(&update_instruction_sighash);
        instruction_data.extend_from_slice(&update_instruction_arg);

        let instruction = Instruction {
            program_id: Pubkey::from_str("6jnS9rvUGxu4TpwwuCeF12Ar9Cqk2vKbufqc6Hnharnz").unwrap(),
            accounts: account_metas,
            data: instruction_data,
        };

        let txn = Transaction::new_signed_with_payer(
            std::slice::from_ref(&instruction),
            Some(&admin.pubkey()),
            &[&admin],
            recent_hash,
        );

        let signature = send_txn(&client, &txn, false).unwrap();
        println!("Signature {}", signature);
    }
}
