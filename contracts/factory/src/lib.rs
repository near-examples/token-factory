// Find all our documentation at https://docs.near.org
use near_contract_standards::{
    fungible_token::metadata::FungibleTokenMetadata, non_fungible_token::TokenId,
};
use near_sdk::{
    env, json_types::U128, near, serde_json, store::{IterableMap, LookupMap}, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise
};

const FT_WASM_CODE: &[u8] = include_bytes!("../../token/res/fungible_token.wasm");
const EXTRA_BYTES: usize = 10000;

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    pub tokens: IterableMap<TokenId, TokenArgs>,
    pub storage_deposits: LookupMap<AccountId, NearToken>,
    pub storage_balance_cost: NearToken,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct TokenArgs {
    owner_id: AccountId,
    total_supply: U128,
    metadata: FungibleTokenMetadata,
}

#[derive(BorshStorageKey)]
#[near]
enum StorageKey {
    Tokens,
    StorageDeposits,
}

#[near]
impl Contract {
    #[init]
    pub fn new() -> Self {
        let mut storage_deposits = LookupMap::new(StorageKey::StorageDeposits);

        let initial_storage_usage = env::storage_usage();
        let tmp_account_id: AccountId = "a".repeat(64).parse().unwrap();

        storage_deposits.insert(tmp_account_id.to_owned(), NearToken::from_near(0));

        let storage_balance_cost = env::storage_byte_cost()
            .saturating_mul(u128::from(env::storage_usage() - initial_storage_usage));

        storage_deposits.remove(&tmp_account_id);

        Self {
            tokens: IterableMap::new(StorageKey::Tokens),
            storage_deposits,
            storage_balance_cost,
        }
    }

    fn get_min_attached_balance(&self, args: &TokenArgs) -> NearToken {
        env::storage_byte_cost()
            .saturating_mul((FT_WASM_CODE.len() + EXTRA_BYTES + vec![args].len() * 2) as u128)
    }

    pub fn get_required_deposit(&self, args: TokenArgs, account_id: AccountId) -> NearToken {
        let args_deposit = self.get_min_attached_balance(&args);

        if let Some(previous_balance) = self.storage_deposits.get(&account_id) {
            args_deposit.saturating_sub(previous_balance.clone()).into()
        } else {
            self.storage_balance_cost.saturating_add(args_deposit)
        }
    }

    pub fn get_number_of_tokens(&self) -> u32 {
        self.tokens.len()
    }

    #[payable]
    pub fn storage_deposit(&mut self) {
        let account_id = env::predecessor_account_id();
        let deposit = env::attached_deposit();
        if let Some(previous_balance) = self.storage_deposits.get(&account_id) {
            self.storage_deposits
                .insert(account_id, previous_balance.saturating_add(deposit));
        } else {
            assert!(deposit >= self.storage_balance_cost, "Deposit is too low");
            self.storage_deposits.insert(
                account_id,
                deposit.saturating_sub(self.storage_balance_cost),
            );
        }
    }

    #[payable]
    pub fn create_token(&mut self, args: TokenArgs) -> Promise {
        if env::attached_deposit() > NearToken::from_near(0) {
            self.storage_deposit();
        }

        args.metadata.assert_valid();

        let token_id = args.metadata.symbol.to_ascii_lowercase();
        assert!(is_valid_token_id(&token_id), "Invalid Symbol");

        let token_account_id: AccountId = format!("{}.{}", token_id, env::current_account_id())
            .parse()
            .unwrap();
        assert!(
            env::is_valid_account_id(token_account_id.as_bytes()),
            "Token Account ID is invalid"
        );

        let account_id = env::predecessor_account_id();

        let required_balance = self.get_min_attached_balance(&args);
        let user_balance = self.storage_deposits.get(&account_id).unwrap();

        assert!(
            user_balance >= &required_balance,
            "Not enough required balance"
        );
        self.storage_deposits
            .insert(account_id, user_balance.saturating_sub(required_balance));

        let initial_storage_usage = env::storage_usage();

        assert!(
            self.tokens.insert(token_id, args.clone()).is_none(),
            "Token ID is already taken"
        );

        let storage_balance_used = env::storage_byte_cost()
            .saturating_mul((env::storage_usage() - initial_storage_usage).into());

        Promise::new(token_account_id)
            .create_account()
            .transfer(required_balance.saturating_sub(storage_balance_used))
            .add_full_access_key(env::signer_account_pk())
            .deploy_contract(FT_WASM_CODE.to_vec())
            .function_call(
                "new".to_owned(),
                serde_json::to_vec(&args).unwrap(),
                NearToken::from_near(0),
                Gas::from_tgas(50),
            )
    }
}

pub fn is_valid_token_id(token_id: &TokenId) -> bool {
    for c in token_id.as_bytes() {
        match c {
            b'0'..=b'9' | b'a'..=b'z' => (),
            _ => return false,
        }
    }
    true
}

/*
 * The rest of this file holds the inline tests for the code above
 * Learn more about Rust tests: https://doc.rust-lang.org/book/ch11-01-writing-tests.html
 */
#[cfg(test)]
mod tests {
    // use super::*;

    // #[test]
    // fn get_default_greeting() {
    //     let contract = Contract::default();
    //     // this test did not call set_greeting so should return the default "Hello" greeting
    //     assert_eq!(contract.get_greeting(), "Hello");
    // }

    // #[test]
    // fn set_then_get_greeting() {
    //     let mut contract = Contract::default();
    //     contract.set_greeting("howdy".to_string());
    //     assert_eq!(contract.get_greeting(), "howdy");
    // }
}
