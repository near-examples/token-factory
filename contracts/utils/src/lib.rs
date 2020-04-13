use borsh::{BorshDeserialize, BorshSerialize};
use serde::{Deserialize, Deserializer, Serialize, Serializer};

pub type TokenId = String;
pub type AccountId = String;

#[derive(Deserialize, Serialize, BorshDeserialize, BorshSerialize)]
pub struct TokenDescription {
    pub token_id: TokenId,
    pub owner_id: AccountId,
    pub total_supply: U128,
    pub precision: U128,
    pub name: String,
    pub description: String,
    pub icon_png_base64: String,
}

// TODO: Replace with `U128` from `json_types::U128` once it's merged.
#[derive(Debug, Copy, Clone, PartialEq, BorshDeserialize, BorshSerialize)]
pub struct U128(u128);

impl From<u128> for U128 {
    fn from(v: u128) -> Self {
        Self(v)
    }
}

impl From<U128> for u128 {
    fn from(v: U128) -> u128 {
        v.0
    }
}

impl Serialize for U128 {
    fn serialize<S>(&self, serializer: S) -> Result<<S as Serializer>::Ok, <S as Serializer>::Error>
        where
            S: Serializer,
    {
        serializer.serialize_str(&self.0.to_string())
    }
}

impl<'de> Deserialize<'de> for U128 {
    fn deserialize<D>(deserializer: D) -> Result<Self, <D as Deserializer<'de>>::Error>
        where
            D: Deserializer<'de>,
    {
        let s: String = Deserialize::deserialize(deserializer)?;
        Ok(Self(
            u128::from_str_radix(&s, 10)
                .map_err(|err| serde::de::Error::custom(err.to_string()))?,
        ))
    }
}

// TODO: Replace with `env::is_valid_account_id` once it's merged.
pub fn is_valid_account_id(account_id: &AccountId) -> bool {
    if (account_id.len() as u64) < 2
        || (account_id.len() as u64) > 64
    {
        return false;
    }

    // NOTE: We don't want to use Regex here, because it requires extra time to compile it.
    // The valid account ID regex is /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/
    // Instead the implementation is based on the previous character checks.

    // We can safely assume that last char was a separator.
    let mut last_char_is_separator = true;

    for c in account_id.as_bytes() {
        let current_char_is_separator = match *c {
            b'a'..=b'z' | b'0'..=b'9' => false,
            b'-' | b'_' | b'.' => true,
            _ => return false,
        };
        if current_char_is_separator && last_char_is_separator {
            return false;
        }
        last_char_is_separator = current_char_is_separator;
    }
    // The account can't end as separator.
    !last_char_is_separator
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
        assert!(is_valid_account_id(&self.owner_id), "Invalid character in a given token id");
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
