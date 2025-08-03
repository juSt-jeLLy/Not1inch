# 1inch Fusion+ Extension On Sui

_Enabling secure, decentralized, and efficient asset swaps across blockchain networks, inspired by 1inch Fusion+._

## 1. Introduction & Problem Statement

This project extends the 1inch Fusion+ protocol on Sui. It includes competitive Dutch auctions, support for partial fills via Merkle Trees, and a sophisticated multi-stage timelock mechanism.

## 2. Key Features

Our Sui HTLC contract implements the following advanced functionalities:

- **Decentralized & Trustless Cross-Chain Swaps:** Secure asset exchange between a source chain (conceptualized as EVM) and Sui without intermediaries.
- **Hashed Timelock Contracts (HTLCs):** Core mechanism ensuring either both parties exchange assets or no exchange occurs.
- **Dutch Auction Mechanism:** Descending price auction allowing resolvers to compete for orders and secure best price for makers.
- **Support for Partial Fills:** Large swap orders can be executed in smaller segments to minimize price impact and improve liquidity.
- **Merkle Trees for Partial Fill Secrets:** Uses a single Merkle root to verify multiple secret hashes securely.
- **Multi-Stage Timelocks:** Provides distinct windows for:
  - **Finality Lock**
  - **Resolver Exclusive Unlock**
  - **Public Unlock**
  - **Resolver Cancellation**
  - **Public Cancellation Incentive**
  - **Maker's Final Cancellation**
- **Incentivized Safety Deposits:** Resolvers stake a safety deposit, which can be claimed by others to encourage transaction finality.

## 3. Core Concepts & How It Works

### Atomic Swap Fundamentals

The system relies on **Hashed Timelock Contracts (HTLCs)**. Funds are locked using a hash of a secret (`hashlock`). To unlock, the secret (`preimage`) must be revealed. A `timelock` ensures refundability if the swap isn’t completed.

### The Dutch Auction

- Price starts high and decreases linearly over `duration_ms` until reaching `reserve_price`.
- Resolvers monitor and fill when price is acceptable.

### Code 

Check here for SUI chain Transections 

[Transections of SUI Chain](https://suiscan.xyz/testnet/object/0x14e9f86c5e966674e6dbb28545bbff2052e916d93daba5729dbc475b1b336bb4/tx-blocks)

For detailed implementation of Cross Chain Swap is integrated , please refer :

[SUI Contract](https://github.com/juSt-jeLLy/Not1inch/blob/main/source/sources/source.move)

[Functions To Interact With SUI Contract](https://github.com/juSt-jeLLy/Not1inch/blob/main/sui/clientpartial.ts)

[EVM to SUI Swap File](https://github.com/juSt-jeLLy/Not1inch/blob/main/tests/main.spec.ts)

[SUI to EVM Swap File](https://github.com/juSt-jeLLy/Not1inch/blob/main/tests/suitoevm.spec.ts)

[EVM to SUI Partial Fills Swap File](https://github.com/juSt-jeLLy/Not1inch/blob/main/tests/evmtosuipartialfills.spec.ts)

[SUI to EVM Partial Fills Swap File](https://github.com/juSt-jeLLy/Not1inch/blob/main/tests/suitoevmpartialfills.spec.ts)


### Cross-Chain Swap Flow (High-Level)

## Check here for Examples

[Cross chain swap examples with screenshots](https://yagensh.gitbook.io/not1inch/documentation)


#### Case 1: Sui is the Source Chain (SUI → EVM)
Maker funds are on Sui. Resolver commits funds on EVM.

![SUI → EVM Cross-Chain Swap](https://github.com/user-attachments/assets/e76cb5a4-fbf0-498b-b619-572f0c2f8bb6)

#### Case 2: EVM is the Source Chain (EVM → SUI)
Maker funds are on EVM. Resolver commits funds on Sui.

![EVM → SUI Cross-Chain Swap](https://github.com/user-attachments/assets/22fb8415-aeb5-4ff0-ae42-bd73648a7a18)

### Partial Fill Mechanism

Large orders can be filled by multiple resolvers using a Merkle Tree of secret hashes.

![Partial Fill & Merkle Tree](https://github.com/user-attachments/assets/1b19442d-2615-45ff-9408-119fc5765eca)

### Multi-Stage Timelocks for HTLCs

Each `HashedTimelockEscrow` follows strict timelock rules for claiming/cancelling.

![Multi-Stage Timelocks](https://github.com/user-attachments/assets/fa102477-6d4e-4132-a97d-c428e847bbe9)

## 4. Smart Contract Details

Core module: `sui_htlc_contract::htlc`

## 📃 Function Descriptions

### 🟢 `announce_order<T>`

Creates a **standard HTLC order** (non-partial fill). Emits `OrderAnnouncedEvent`. Used by the **maker** to announce an order with a secret hash and auction details.

---

### 🟢 `auction_tick<T>`

Calculates and emits the **current price** of an active standard HTLC order. Emits `AuctionTickEvent`.

---

### 🟢 `partial_auction_tick<T>`

Same as `auction_tick`, but for **partial fill** orders. Emits `AuctionTickEvent`.

---

### 🟢 `fill_order<T>`

Allows a **resolver** to fill a **standard order**. Requires bid price ≥ current auction price. Updates order status and emits `OrderFilledEvent`.

---

### 🟢 `add_safety_deposit<T>`

Allows **resolver** to deposit **safety collateral** into the HTLC escrow. Only callable by the resolver.

---

### 🟢 `create_htlc_escrow_src<T>`

Used by **maker** to lock coins into an HTLC when **SUI is the source**. Validates order status and fund amount. Emits `HTLCSrcEscrowCreatedEvent`.

---

### 🟢 `create_htlc_escrow_dst<T>`

Used by **resolver** to lock coins + safety deposit into an HTLC when **SUI is the destination**. Emits `HTLCDstEscrowCreatedEvent`.

---

### ⚖️ `internal_create_htlc_escrow<T>`

**Internal function** for initializing both `src` and `dst` HTLC escrows. Handles balance merging, timestamp calculations, and event emission.

---

### 🟢 `claim_htlc<T>`

Allows a party to **claim HTLC funds** using the **correct secret** after finality period. If `isSrc` is true: resolver claims coins. If false: maker receives coins. Safety deposit always returned to resolver. Emits `HTLCClaimedEvent`.

---

### 🟢 `recover_htlc_escrow<T>`

Allows **refunds** of unclaimed HTLCs based on the current time and unlock conditions. Supports:

- Resolver's own cancellation window
- Public incentive window
- Maker's final fallback cancellation Emits `HTLCRefundedEvent`.

---

### 🟢 `partial_announce_order<T>`

Used by **maker** to create an **order with partial fill support**. Initializes Merkle root, secret index bitmap, and total fill amount.

---

### 🟢 `fill_order_partial<T>`

Used by **resolvers** to partially fill an order. Validates bid price, fill ratio, secret index, and (optionally) Merkle proof. Emits `PartialOrderFilledEvent`.

---

### 🟢 `create_htlc_escrow_src_partial<T>`

Used by **maker** to create a **source-side HTLC escrow** for a partial fill. Includes specific `hash_lock_index`.

---

### 🟢 `create_htlc_escrow_dst_partial<T>`

Used by **resolver** to create a **destination-side HTLC escrow** with safety deposit for a partial fill.

---

### ⚖️ `verify_merkle_proof`

Internal utility function to verify a **Merkle proof** for a secret hash. Used to validate the index of a secret in `PartialOrder`.

## 📆 Important Structs

### 🔹 `Order<T>`

Represents a **standard (non-partial fill)** HTLC-based auction order.

```move
struct Order<T> {
    id: UID,
    maker: address,
    resolver: address,
    secret_hash: vector<u8>,
    start_time: u64,
    duration_ms: u64,
    start_price: u64,
    reserve_price: u64,
    fill_price: u64,
    status: u8,
}
```

### 🔹 `PartialOrder<T>`

Represents a **partial fill order** allowing multiple takers and secret indexing.

```move
struct PartialOrder<T> {
    id: UID,
    maker: address,
    start_time: u64,
    duration_ms: u64,
    start_price: u64,
    reserve_price: u64,
    total_amount: u64,
    remaining: u64,
    parts_count: u64,
    merkle_root: vector<u8>,
    filled_parts_bitmap: vector<bool>,
    fills: vector<PartialFill>,
    status: u8,
}
```

### 🔹 `PartialFill`

Tracks a **single successful fill** in a `PartialOrder`.

```move
struct PartialFill {
    resolver: address,
    amount: u64,
    fill_price: u64,
    hash_lock_index_used: u64,
}
```

### 🔹 `HashedTimelockEscrow<T>`

Main escrow struct, used to **lock funds under time and secret conditions**.

```move
struct HashedTimelockEscrow<T> {
    id: UID,
    secret_hash: vector<u8>,
    finality_lock_expires_ms: u64,
    resolver_exclusive_unlock_expires_ms: u64,
    resolver_cancellation_expires_ms: u64,
    maker_cancellation_expires_ms: u64,
    public_cancellation_incentive_expires_ms: u64,
    maker_address: address,
    resolver_address: address,
    locked_balance: Balance<T>,
    claimed: bool,
    safety_deposit: Balance<0x2::sui::SUI>,
    isSrc: bool,
    order_id: ID,
    hash_lock_index: u64,
}
```


## 5. Getting Started

### Prerequisites

- Node.js (LTS)
- npm
- Rust + Cargo
- Sui CLI:

```bash
cargo install --locked --git https://github.com/MystenLabs/sui.git --tag testnet sui
```
### Installation

```bash
git clone https://github.com/juSt-jeLLy/Not1inch/ 
npm install
```

### Contract Deployment

```bash
cd source/sources
sui move build
sui client publish --gas-budget 300000000 --json
```

> Update `.env` with the returned `SUI_PACKAGE_ID`.

### Running Tests

## SUI Functions Test

1. Set `.env` according to [`.env.example`](https://github.com/juSt-jeLLy/Not1inch/blob/main/.env.example)
2. Run:

```bash
node sui/client.js
```

## Cross chain swap

#Set Up

```
(1) 0x38c4aadf07a344bd5f5baedc7b43f11a9b863cdd16242f3b94a53541ad19fedc: "0x39619C9fe2AF793f847D112123F62c01df0A0025" User
(2) 0x1d02f466767e86d82b6c647fc7be69dc1bc98931a99ac9666d8b591bb0cc1e66: "0x4207ebd97F999F142fFD3696dD76A61193b23e89" Resolver
```
```shell
pnpm install
```
```shell
forge install
```
```shell
forge build
```
# Then Run

For EVM to SUI standard order 

```shell
pnpm test main.spec.ts
```
For SUI to EVM standard order 

```shell
pnpm test suitoevm.spec.ts
```
For SUI to EVM Partial Fills

```shell
pnpm test suitoevmpartialfills.spec.ts
```
For EVM to SUI Partial Fills

```shell
pnpm test evmtosuipartialfills.spec.ts
```


## 6. Frontend/UI

**File:** `client/frontend`

### Features

- **Transaction Building:** via `@mysten/sui/transactions`
- **Key Management:** using `Ed25519Keypair`
- **Chain Communication:** using `suiClient`
- **Hashing:** via `ethers.js` `keccak256`
- **Secret Index Logic:** replicates Move-side logic via `calculateExpectedSecretIndex`












## 7. Future Enhancements

- On-chain resolver registry (for KYC/KYB compliance)
- Piecewise linear or non-linear Dutch auction curves
- Cross-chain messaging using Sui-native messaging


## 8. Contributing

Contributions are welcome! Feel free to open issues or submit PRs.

## 9. License

This project is licensed under the **MIT License**.

## 10. Acknowledgements & References

- Inspired by the innovative **1inch Fusion+** protocol  
- [1inch Fusion+ Whitepaper](https://1inch.io/assets/1inch-security-white-paper.pdf)   
- Thanks to the **Sui team** for SDKs and documentation
