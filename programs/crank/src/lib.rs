// fn read_keypair_file(s: &str) -> Result<Keypair> {
//     solana_sdk::signature::read_keypair_file(s)
//         .map_err(|_| format_err!("failed to read keypair from {}", s))
// }

#[cfg(test)]
mod tests {
    use std::{str::FromStr, sync::Arc};

    use serum_common::client::{rpc::send_txn, Cluster};
    use solana_client::rpc_client::RpcClient;
    use solana_sdk::{
        instruction::{AccountMeta, Instruction},
        pubkey::Pubkey,
        signature::Keypair,
        signer::Signer,
        transaction::Transaction,
    };

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
            228, 145, 142, 148, 186, 81, 142, 99, 218, 213, 177, 170, 2, 88, 105, 73, 191, 249,
            131, 50, 136, 95, 195, 217, 106, 172, 49, 101, 67, 95, 184, 13, 211, 107, 228, 233,
            150, 139, 146, 59, 204, 32, 172, 1, 114, 196, 100, 148, 12, 59, 221, 40, 77, 201, 32,
            221, 178, 142, 27, 96, 239, 193, 170, 27,
        ])
        .unwrap()
    }

    #[test]
    fn crank_update_price() {
        let cluster = Cluster::Localnet;
        let client = RpcClient::new(cluster.url().to_string());
        let client = Arc::new(client);

        let admin = admin();
        let oracle = oracle();
        let clock = Pubkey::from_str("SysvarC1ock11111111111111111111111111111111").unwrap();

        let (recent_hash, _fee_calc) = client.get_recent_blockhash().unwrap();
        println!("Sending request ...");
        let mut account_metas = Vec::with_capacity(3);
        account_metas.push(AccountMeta::new(admin.pubkey(), true));
        account_metas.push(AccountMeta::new(oracle.pubkey(), false));
        account_metas.push(AccountMeta::new_readonly(clock, false));

        let mut instruction_data = vec![];
        let update_instruction_sighash = [219, 200, 88, 176, 158, 63, 253, 127];
        let update_instruction_token = borsh::to_vec(&(3 as u8)).unwrap();
        let update_instruction_price = borsh::to_vec(&(20 as u64)).unwrap();
        instruction_data.extend_from_slice(&update_instruction_sighash);
        instruction_data.extend_from_slice(&update_instruction_token);
        instruction_data.extend_from_slice(&update_instruction_price);

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
