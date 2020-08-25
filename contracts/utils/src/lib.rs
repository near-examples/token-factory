use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, AccountId};
use near_sdk::json_types::U128;

pub type TokenId = String;

#[derive(Deserialize, Serialize, BorshDeserialize, BorshSerialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct TokenDescription {
    pub token_id: TokenId,
    pub owner_id: AccountId,
    pub total_supply: U128,
    pub precision: U128,
    pub name: Option<String>,
    pub description: Option<String>,
    pub icon_base64: Option<String>,
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

impl TokenDescription {
    pub fn assert_valid(&self) {
        assert!(is_valid_token_id(&self.token_id), "Invalid character in a given token id");
        assert!(env::is_valid_account_id(self.owner_id.as_bytes()), "Invalid character in a given token id");
        assert!(self.total_supply.0 > 0, "Total supply has to be positive");
        assert!(self.precision.0 > 0, "Precision has to be positive");
    }
}


#[cfg(not(target_arch = "wasm32"))]
#[cfg(test)]
mod tests {
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

}
