# 1inch Fusion+ Extension On Sui

*Enabling secure, decentralized, and efficient asset swaps across blockchain networks, inspired by 1inch Fusion+.*

---

## 1. About Not1uinch

This project extends the **1inch Fusion+** protocol on **Sui**, featuring:

- Competitive Dutch auctions
- Partial fills via Merkle Trees
- Multi-stage timelocks for secure swap execution

---

## 2. Key Features

### ✅ Sui HTLC Contract Includes:

- **Decentralized & Trustless Cross-Chain Swaps**\
  Secure asset exchange between EVM and Sui without intermediaries.

- **Hashed Timelock Contracts (HTLCs)**\
  Guarantee atomicity—both parties swap, or no one does.

- **Dutch Auction Mechanism**\
  Resolvers compete as prices descend over time.

- **Partial Fills Support**\
  Large orders can be segmented and filled incrementally.

- **Merkle Trees for Secrets**\
  Use Merkle root to validate multiple secret hashes securely.

- **Multi-Stage Timelocks**\
  Enforces claim/cancel logic with:

  - Finality Lock
  - Resolver Exclusive Unlock
  - Public Unlock
  - Resolver Cancellation
  - Public Cancellation Incentive
  - Maker’s Final Cancellation

- **Incentivized Safety Deposits**\
  Ensures resolver accountability via staked collateral.

---

## 3. Core Concepts & How It Works

### 🔐 Atomic Swap Fundamentals

Funds are locked using a `hashlock` (secret hash). Swap completion requires the `preimage` (secret). Refunds are time-based (`timelock`).

---

### 📉 Dutch Auction Logic

- Starts at `start_price`, descends linearly to `reserve_price`
- Duration is defined by `duration_ms`
- Resolvers fill when price becomes acceptable

---

### 🔗 Code & Examples

- [SUI Chain Transactions](https://suiscan.xyz/testnet/object/0x14e9f86c5e966674e6dbb28545bbff2052e916d93daba5729dbc475b1b336bb4/tx-blocks)
- [SUI Contract](https://github.com/juSt-jeLLy/Not1inch/blob/main/source/sources/source.move)
- [SUI Interaction Functions](https://github.com/juSt-jeLLy/Not1inch/blob/main/sui/clientpartial.ts)
- [EVM → SUI Swap](https://github.com/juSt-jeLLy/Not1inch/blob/main/tests/main.spec.ts)
- [SUI → EVM Swap](https://github.com/juSt-jeLLy/Not1inch/blob/main/tests/suitoevm.spec.ts)
- [EVM → SUI Partial Fills](https://github.com/juSt-jeLLy/Not1inch/blob/main/tests/evmtosuipartialfills.spec.ts)
- [SUI → EVM Partial Fills](https://github.com/juSt-jeLLy/Not1inch/blob/main/tests/suitoevmpartialfills.spec.ts)

---

### 🔀 Cross-Chain Swap Flow

#### Case 1: SUI → EVM

Maker locks funds on Sui. Resolver commits on EVM.\


#### Case 2: EVM → SUI

Maker locks funds on EVM. Resolver commits on Sui.\


---

### 🧹 Partial Fill Mechanism

Resolves large orders in parts using Merkle-proven secrets.\


---

### ⏱️ Multi-Stage Timelocks

Each `HashedTimelockEscrow` enforces these stages:\


---

## 4. Smart Contract Details

Core module: `sui_htlc_contract::htlc`

---

### 📜 Function Descriptions

| Function                            | Description                                         |
| ----------------------------------- | --------------------------------------------------- |
| `announce_order<T>`                 | Announces standard HTLC order                       |
| `auction_tick<T>`                   | Calculates price of standard order                  |
| `partial_auction_tick<T>`           | Calculates price of partial order                   |
| `fill_order<T>`                     | Fills standard order if bid ≥ auction price         |
| `add_safety_deposit<T>`             | Adds resolver’s safety deposit                      |
| `create_htlc_escrow_src<T>`         | Maker locks coins (Sui as source)                   |
| `create_htlc_escrow_dst<T>`         | Resolver locks coins + deposit (Sui as destination) |
| `internal_create_htlc_escrow<T>`    | Shared escrow logic for src/dst                     |
| `claim_htlc<T>`                     | Unlocks HTLC if correct secret is given             |
| `recover_htlc_escrow<T>`            | Refunds escrow depending on time conditions         |
| `partial_announce_order<T>`         | Announces partial-fill order                        |
| `fill_order_partial<T>`             | Partially fills order with Merkle index validation  |
| `create_htlc_escrow_src_partial<T>` | Maker locks source funds for partial fill           |
| `create_htlc_escrow_dst_partial<T>` | Resolver locks destination funds for partial fill   |
| `verify_merkle_proof`               | Internal proof check for partial orders             |

---

## 📦 Important Structs

### `Order<T>`

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

### `PartialOrder<T>`

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

### `PartialFill`

```move
struct PartialFill {
    resolver: address,
    amount: u64,
    fill_price: u64,
    hash_lock_index_used: u64,
}
```

### `HashedTimelockEscrow<T>`

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

---

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

> Update `.env` with the returned `SUI_PACKAGE_ID`

---

## 6. Testing

### SUI Functions

1. Configure `.env` as per [`example`](https://github.com/juSt-jeLLy/Not1inch/blob/main/.env.example)
2. Run:

```bash
node sui/client.js
```

---

### Cross-Chain Swaps

#### Set Up

```
User:    0x38c4...fedc → 0x3961...
Resolver: 0x1d02...e66 → 0x4207...
```

#### Commands

```bash
pnpm install
forge install
forge build
```

#### Run Tests

- EVM → SUI Standard

```bash
pnpm test main.spec.ts
```

- SUI → EVM Standard

```bash
pnpm test suitoevm.spec.ts
```

- SUI → EVM Partial Fills

```bash
pnpm test suitoevmpartialfills.spec.ts
```

- EVM → SUI Partial Fills

```bash
pnpm test evmtosuipartialfills.spec.ts
```

---

## 7. Frontend/UI

**Path:** `client/frontend`

### Stack:

- `@mysten/sui/transactions` for TX building
- `Ed25519Keypair` for key management
- `suiClient` for chain interactions
- `ethers.js` for `keccak256` hashing
- Local Merkle logic for secret indexing

---

## 8. Future Enhancements

- On-chain resolver registry (KYC/KYB support)
- More complex Dutch auction curves
- Sui-native cross-chain messaging

---

## 9. Contributing

PRs and issues welcome! Let’s build together.

---

## 10. License

**MIT License**

---

## 11. Acknowledgements

- Inspired by **1inch Fusion+**
- [1inch Fusion+ Whitepaper](https://1inch.io/assets/1inch-security-white-paper.pdf)
- Thanks to the **Sui** ecosystem for tooling and SDKs

---

