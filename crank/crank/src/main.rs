use anyhow::Result;
use pyth_client::{cast, Price};
use serum_common::client::rpc::send_txn;
use serum_common::client::Cluster;
use solana_client::rpc_client::RpcClient;
use solana_sdk::signature::Signer;
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    signature::Keypair,
    transaction::Transaction,
};
use solana_shadow::{BlockchainShadow, Network, Pubkey};
use std::{str::FromStr, sync::Arc, time::Duration};
use tracing_subscriber::EnvFilter;

fn configure_logging() {
    tracing_subscriber::fmt::Subscriber::builder()
        .with_writer(std::io::stdout)
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or(EnvFilter::new("info")))
        .init();
}

#[tokio::main]
async fn main() -> Result<()> {
    configure_logging();

    // https://pyth.network/developers/accounts/
    let ethusd: Pubkey = "JBu1AL4obBcCMqKBBxhpWCNUt136ijcuMZLFvTP7iWdB".parse()?;
    let btcusd: Pubkey = "GVXRSBjFk6e6J3NbVPXohDJetcTjaeeuykUpbQF8UoMU".parse()?;
    let solusd: Pubkey = "H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG".parse()?;
    let rayusd: Pubkey = "H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG".parse()?;
    let fttusd: Pubkey = "H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG".parse()?;
    let srmusd: Pubkey = "H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG".parse()?;

    let shadow =
        BlockchainShadow::new_for_accounts(&vec![ethusd, btcusd, solusd], Network::Mainnet).await?;

    let crank = HubbleClient::new(Cluster::Localnet);

    // iterate over the offline shadow of the account
    // everytime any account is accessed, then its contents
    // will reflect the latest version on-chain.
    for i in 0.. {
        // access the most recent snapshot of an account
        let ethacc = shadow.get_account(&ethusd).unwrap();
        let eth_price = cast::<Price>(&ethacc.data).agg.price as u64;

        let btcacc = shadow.get_account(&btcusd).unwrap();
        let btc_price = cast::<Price>(&btcacc.data).agg.price as u64;

        let solacc = shadow.get_account(&solusd).unwrap();
        let sol_price = cast::<Price>(&solacc.data).agg.price as u64;

        let rayacc = shadow.get_account(&rayusd).unwrap();
        let ray_price = cast::<Price>(&rayacc.data).agg.price as u64;

        let fttacc = shadow.get_account(&fttusd).unwrap();
        let ftt_price = cast::<Price>(&fttacc.data).agg.price as u64;

        let srmacc = shadow.get_account(&srmusd).unwrap();
        let srm_price = cast::<Price>(&srmacc.data).agg.price as u64;

        println!("ETH/USD: {}", eth_price);
        println!("BTC/USD: {}", btc_price);
        println!("SOL/USD: {}", sol_price);
        println!("RAY/USD: {}", ray_price);
        println!("FTT/USD: {}", ftt_price);
        println!("SRM/USD: {}", srm_price);

        crank.batch_update_oracle(
            sol_price, btc_price, eth_price, ray_price, ftt_price, srm_price,
        );

        tokio::time::sleep(Duration::from_secs(3)).await;
    }

    shadow.worker().await?;
    Ok(())
}

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

    #[test]
    fn crank_update_batch_price() {
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
        let sol_price: u64 = 21;
        let btc_price: u64 = 22;
        let eth_price: u64 = 23;
        let ray_price: u64 = 24;
        let ftt_price: u64 = 25;
        let srm_price: u64 = 26;

        let update_instruction_sighash = [57, 189, 226, 20, 239, 33, 98, 191];
        let update_instruction_sol_price = borsh::to_vec(&sol_price).unwrap();
        let update_instruction_btc_price = borsh::to_vec(&btc_price).unwrap();
        let update_instruction_eth_price = borsh::to_vec(&eth_price).unwrap();
        let update_instruction_ray_price = borsh::to_vec(&ray_price).unwrap();
        let update_instruction_ftt_price = borsh::to_vec(&ftt_price).unwrap();
        let update_instruction_srm_price = borsh::to_vec(&srm_price).unwrap();

        instruction_data.extend_from_slice(&update_instruction_sighash);
        instruction_data.extend_from_slice(&update_instruction_sol_price);
        instruction_data.extend_from_slice(&update_instruction_btc_price);
        instruction_data.extend_from_slice(&update_instruction_eth_price);
        instruction_data.extend_from_slice(&update_instruction_ray_price);
        instruction_data.extend_from_slice(&update_instruction_ftt_price);
        instruction_data.extend_from_slice(&update_instruction_srm_price);

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

// fn read_keypair_file(s: &str) -> Result<Keypair> {
//     solana_sdk::signature::read_keypair_file(s)
//         .map_err(|_| format_err!("failed to read keypair from {}", s))
// }

struct HubbleClient {
    admin: Keypair,
    account_metas: Vec<AccountMeta>,
    program_id: Pubkey,
    client: Arc<RpcClient>,
}

impl HubbleClient {
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

    pub fn new(cluster: Cluster) -> Self {
        let admin = HubbleClient::admin();
        let oracle = HubbleClient::oracle();
        let clock = Pubkey::from_str("SysvarC1ock11111111111111111111111111111111").unwrap();
        let hubble_program =
            Pubkey::from_str("6jnS9rvUGxu4TpwwuCeF12Ar9Cqk2vKbufqc6Hnharnz").unwrap();
        Self {
            admin: HubbleClient::admin(),
            account_metas: vec![
                AccountMeta::new(admin.pubkey(), true),
                AccountMeta::new(oracle.pubkey(), false),
                AccountMeta::new_readonly(clock, false),
            ],
            program_id: hubble_program,
            client: Arc::new(RpcClient::new(cluster.url().to_string())),
        }
    }

    pub fn batch_update_oracle(
        &self,
        sol_price: u64,
        btc_price: u64,
        eth_price: u64,
        ray_price: u64,
        ftt_price: u64,
        srm_price: u64,
    ) {
        let update_instruction_sighash = [57, 189, 226, 20, 239, 33, 98, 191];
        let update_instruction_sol_price = borsh::to_vec(&sol_price).unwrap();
        let update_instruction_btc_price = borsh::to_vec(&btc_price).unwrap();
        let update_instruction_eth_price = borsh::to_vec(&eth_price).unwrap();
        let update_instruction_ray_price = borsh::to_vec(&ray_price).unwrap();
        let update_instruction_ftt_price = borsh::to_vec(&ftt_price).unwrap();
        let update_instruction_srm_price = borsh::to_vec(&srm_price).unwrap();

        let mut instruction_data = vec![];
        instruction_data.extend_from_slice(&update_instruction_sighash);
        instruction_data.extend_from_slice(&update_instruction_sol_price);
        instruction_data.extend_from_slice(&update_instruction_btc_price);
        instruction_data.extend_from_slice(&update_instruction_eth_price);
        instruction_data.extend_from_slice(&update_instruction_ray_price);
        instruction_data.extend_from_slice(&update_instruction_ftt_price);
        instruction_data.extend_from_slice(&update_instruction_srm_price);

        let instruction = Instruction {
            program_id: self.program_id,
            accounts: self.account_metas.clone(),
            data: instruction_data,
        };

        let (recent_hash, _fee_calc) = self.client.get_recent_blockhash().unwrap();
        let txn = Transaction::new_signed_with_payer(
            std::slice::from_ref(&instruction),
            Some(&self.admin.pubkey()),
            &[&self.admin],
            recent_hash,
        );

        let signature = send_txn(&self.client, &txn, false).unwrap();
        println!(
            "[{:?}] Batch update signature {}",
            std::time::Instant::now(),
            signature
        );
    }
}
