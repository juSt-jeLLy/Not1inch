# 1inch Fusion+ Extension On Sui

_Enabling secure, decentralized, and efficient asset swaps across blockchain networks, inspired by 1inch Fusion+._

## 1. Introduction & Problem Statement
This project extends 1inch Fusion+ protocol on SUi. It includes competitive Dutch auctions, support for partial fills via Merkle Trees, and a sophisticated multi-stage timelock mechanism etc.

## 2. Key Features

Our Sui HTLC contract implements the following advanced functionalities:

* **Decentralized & Trustless Cross-Chain Swaps:** Facilitates secure asset exchange between a source chain (conceptualized as EVM) and Sui (destination chain) without intermediaries.
* **Hashed Timelock Contracts (HTLCs):** Core cryptographic mechanism ensuring either both parties successfully exchange assets, or no exchange takes place.
* **Dutch Auction Mechanism:** Integrates a descending price auction, allowing resolvers to compete for orders and ensuring optimal exchange rates for the maker.
* **Support for Partial Fills:** Enables large swap orders to be executed in smaller segments, minimizing price impact and enhancing liquidity.
* **Merkle Trees for Partial Fill Secrets:** Manages multiple secret hashes for partial fills securely on-chain, utilizing a single Merkle root for verification.
* **Multi-Stage Timelocks:** Implements a layered timelock system for each HTLC, providing distinct phases for:
    * **Finality Lock:** Ensures blockchain transaction finality before claims.
    * **Resolver Exclusive Unlock:** Gives the original resolver a priority window to claim funds.
    * **Public Unlock:** Allows any party with the secret to claim if the original resolver is unresponsive.
    * **Resolver Cancellation:** Enables the original resolver to recover funds if the swap fails.
    * **Public Cancellation Incentive:** Incentivizes any resolver to clean up stuck funds by claiming the original resolver's safety deposit.
    * **Maker's Final Cancellation:** Provides the maker a last resort to recover funds.
* **Incentivized Safety Deposits:** Resolvers provide a safety deposit that is claimed by the party executing a successful withdrawal or a critical cancellation, ensuring transactions are finalized.

## 3. Core Concepts & How It Works

### Atomic Swap Fundamentals
At its core, the system relies on **Hashed Timelock Contracts (HTLCs)**. Funds are locked using the hash of a secret value (`hashlock`). To unlock, the original secret (`hash preimage`) must be revealed. A `timelock` ensures funds aren't stuck indefinitely, allowing refunds if the swap isn't completed within a deadline.

### The Dutch Auction
Orders are placed into a Dutch auction. The price starts high and gradually decreases over a set `duration_ms` until it hits a `reserve_price`. Resolvers monitor these auctions and `fill_order` or `fill_order_partial` when the price becomes profitable for them.

### Cross-Chain Swap Flow (High-Level)

The protocol workflow is divided into several phases involving the **Maker** (initiates swap), **Resolver** (executes swap), **Sui Contract** (manages HTLCs), and **Relayer** (off-chain service coordinating secrets).

#### Case 1: Sui is the Source Chain (SUI -> EVM)
The Maker's initial order and funds are on Sui. The Resolver commits funds on EVM.
<img width="1240" height="650" alt="image" src="https://github.com/user-attachments/assets/e76cb5a4-fbf0-498b-b619-572f0c2f8bb6" />

_Flowchart 1: SUI -> EVM Cross-Chain Swap_

#### Case 2: EVM is the Source Chain (EVM -> SUI)
The Maker's initial order and funds are on EVM. The Resolver commits funds on Sui.
<img width="1241" height="649" alt="image" src="https://github.com/user-attachments/assets/22fb8415-aeb5-4ff0-ae42-bd73648a7a18" />

_Flowchart 2: EVM -> SUI Cross-Chain Swap_

### Partial Fill Mechanism
For large orders, the Maker can enable partial fills. This allows different Resolvers to fill segments of the order.
<img width="1314" height="649" alt="image" src="https://github.com/user-attachments/assets/1b19442d-2615-45ff-9408-119fc5765eca" />
_Flowchart 3: Partial Fill Mechanism & Merkle Tree Interaction_

### Multi-Stage Timelocks for HTLCs
Each `HashedTimelockEscrow` follows a precise timelock sequence to manage claims and refunds, ensuring fairness and incentivizing participation.
<img width="1040" height="779" alt="image" src="https://github.com/user-attachments/assets/fa102477-6d4e-4132-a97d-c428e847bbe9" />

_Flowchart 4: Multi-Stage Timelock Lifecycle for HashedTimelockEscrow_
