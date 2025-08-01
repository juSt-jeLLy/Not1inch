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

### Cross-Chain Swap Flow (High-Level)

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

### Key Structs

- **`Order<T>`**: Represents a standard, full swap order.
- **`PartialOrder<T>`**: Allows partial fills. Tracks:
  - `merkle_root`
  - `filled_parts_bitmap`
- **`HashedTimelockEscrow<T>`**: Core HTLC struct. Fields include:
  - `finality_lock_expires_ms`
  - `resolver_exclusive_unlock_expires_ms`
  - `resolver_cancellation_expires_ms`
  - `maker_cancellation_expires_ms`
  - `public_cancellation_incentive_expires_ms`
- **`PartialFill`**: Tracks individual partial fill info (e.g. index used).

### Entry Functions

- `announce_order`
- `partial_announce_order`
- `fill_order`
- `fill_order_partial`
- `create_htlc_escrow_src` / `dst`
- `create_htlc_escrow_src_partial` / `dst_partial`
- `claim_htlc`
- `recover_htlc_escrow`
- `add_safety_deposit`
- `auction_tick`


## 5. Getting Started

### Prerequisites

- Node.js (LTS)
- npm
- Rust + Cargo
- Sui CLI:

```bash
cargo install --locked --git https://github.com/MystenLabs/sui.git --tag devnet sui


### Installation

```bash
git clone [your-repo-link]
cd sui-cross-chain-htlc
npm install
```

### Contract Deployment

```bash
cd sources
sui move build
sui client publish --gas-budget 300000000 --json
```

> Update `.env` with the returned `SUI_PACKAGE_ID`.

### Running Tests

1. Set `SUI_PRIVATE_KEY` and `SUI_PACKAGE_ID` in `.env`.
2. Run:

```bash
node sui/client.js
```

## 6. Client-Side Interaction

**File:** `sui/client.js`

### Features

- **Transaction Building:** via `@mysten/sui/transactions`
- **Key Management:** using `Ed25519Keypair`
- **Chain Communication:** using `SuiClient`
- **Hashing:** via `ethers.js` `keccak256`
- **Merkle Tree Support:** using `@openzeppelin/merkle-tree`
- **Secret Index Logic:** replicates Move-side logic via `calculateExpectedSecretIndex`

## 7. Challenges & Solutions

| Challenge                         | Solution                                                                 |
|----------------------------------|--------------------------------------------------------------------------|
| Multi-Stage Timelock Design      | Precise structuring of time fields and conditional validation            |
| Partial Fill State Management    | Efficient bitmap tracking and index validation                           |
| Cross-Chain Cryptographic Match  | Used `@openzeppelin/merkle-tree` and `sui_hash::keccak256` compatibility |

## 8. Future Enhancements

- On-chain resolver registry (for KYC/KYB compliance)
- Piecewise linear or non-linear Dutch auction curves
- Cross-chain messaging using Sui-native messaging
- Dedicated off-chain relayer for automation
- Frontend dApp for user-friendly interaction

## 9. Contributing

Contributions are welcome! Feel free to open issues or submit PRs.

## 10. License

This project is licensed under the **MIT License**.

## 11. Acknowledgements & References

- Inspired by the innovative **1inch Fusion+** protocol  
- [1inch Fusion+ Whitepaper](#) *(link to be updated)*  
- Thanks to the **Sui team** for SDKs and documentation
