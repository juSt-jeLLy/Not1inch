# 1inch Fusion+ Extension On Sui

*Enabling secure, decentralized, and efficient asset swaps across blockchain networks, inspired by 1inch Fusion+.*

---

## 1. About Not1inch

This project extends the **1inch Fusion+** protocol on **Sui**, featuring:

- Competitive Dutch auctions
- Partial fills 
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

## ⚙️ Partial Fills & Secret Indexing

Partial fill support is enabled via **Merkle-based secret indexing**. Each `PartialOrder` commits to a Merkle root of secret hashes, allowing the protocol to validate unique secrets per fill.

The field **expected_secret_index** of the function `fill_order_partial` is calculated using `calculateExpectedSecretIndex` in the [`clientpartial.ts`](https://github.com/juSt-jeLLy/Not1inch/blob/e44bb85d8110fa0ee8244d5ba79ab0fb84691179/sui/clientpartial.ts#L34) file based on the fill progress. This index is then submitted with each partial fill. The Move contract enforces that:

- 🔒 The same secret index cannot be used more than once  
- 📈 Index progression aligns with the `parts_count` and fill ratio  
- ✅ Secrets are bound to their claimed Merkle index (future-proof for proof validation)

> This ensures consistency with the protocol logic defined in the whitepaper and prevents secret reuse or double-fills.

Once Merkle proof integration is live, the resolver will also submit a cryptographic proof to confirm the secret hash belongs to the committed Merkle tree.

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

### ⚐️ Cross-Chain Swap Flow

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
SUI_PACKAGE_ID: 0x14e9f86c5e966674e6dbb28545bbff2052e916d93daba5729dbc475b1b336bb4


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


### Cross-Chain Swaps

#### Set Up

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
#### Then Run

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


---

## 7. Frontend/UI

**Path:** `client/frontend`

### Stack:
-`@mysten/dapp-kit`
- `@mysten/sui/transactions` for TX building
- `Ed25519Keypair` for key management
- `suiClient` for chain interactions
- `ethers.js` for `keccak256` hashing
- `merkletreejs`

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
