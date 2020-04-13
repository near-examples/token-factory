use borsh::{BorshDeserialize, BorshSerialize};
use serde::Serialize;

use near_sdk::collections::Map;
use near_sdk::{env, near_bindgen, Promise, Gas, Balance};

use utils::{TokenId, TokenDescription, is_valid_account_id};

#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

const MIN_TOKEN_BALANCE: Balance = 25_000_000_000_000_000_000_000_000;
const GAS: Gas =  100_000_000_000_000;

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize)]
pub struct TokenFactory {
    tokens: Map<TokenId, TokenDescription>,
}

impl Default for TokenFactory {
    fn default() -> Self {
        env::panic(b"Not initialized yet.");
    }
}

#[derive(Serialize)]
struct TokenNewArgs {
    token_description: TokenDescription,
}

#[near_bindgen]
impl TokenFactory {
    #[init]
    pub fn new() -> Self {
        assert!(env::state_read::<Self>().is_none(), "The contract is already initialized");
        Self {
            tokens: Map::new(b"t".to_vec()),
        }
    }

    pub fn create_new_token(&mut self, token_description: TokenDescription) -> Promise {
        assert!(env::attached_deposit() >= MIN_TOKEN_BALANCE, "Not enough attached deposit to complete token creation");

        let token_account_id = format!("{}.{}", token_description.token_id, env::current_account_id());
        assert!(is_valid_account_id(&token_account_id), "Token Account ID is invalid");

        assert!(self.tokens.insert(&token_description.token_id, &token_description).is_none(), "Token ID is already exists");

        Promise::new(token_account_id)
            .create_account()
            .transfer(env::attached_deposit())
            .deploy_contract(
                include_bytes!("../../token/res/fungible_token.wasm").to_vec(),
            )
            .function_call(b"new".to_vec(), serde_json::to_vec(&TokenNewArgs {
                token_description,
            }).unwrap(), 0, GAS)
    }

}


#[cfg(not(target_arch = "wasm32"))]
#[cfg(test)]
mod tests {
    use near_bindgen::MockedBlockchain;
    use near_bindgen::{testing_env, VMContext};

    use super::*;

    fn alice() -> AccountId {
        "alice.near".to_string()
    }

    fn bob() -> AccountId {
        "bob.near".to_string()
    }

    fn carol() -> AccountId {
        "carol.near".to_string()
    }

    fn catch_unwind_silent<F: FnOnce() -> R + std::panic::UnwindSafe, R>(
        f: F,
    ) -> std::thread::Result<R> {
        let prev_hook = std::panic::take_hook();
        std::panic::set_hook(Box::new(|_| {}));
        let result = std::panic::catch_unwind(f);
        std::panic::set_hook(prev_hook);
        result
    }

    fn get_context(predecessor_account_id: AccountId) -> VMContext {
        VMContext {
            current_account_id: alice(),
            signer_account_id: bob(),
            signer_account_pk: vec![0, 1, 2],
            predecessor_account_id,
            input: vec![],
            block_index: 0,
            block_timestamp: 0,
            account_balance: 0,
            account_locked_balance: 0,
            storage_usage: 10u64.pow(6),
            attached_deposit: 0,
            prepaid_gas: 10u64.pow(18),
            random_seed: vec![0, 1, 2],
            is_view: false,
            output_data_receivers: vec![],
        }
    }

}
