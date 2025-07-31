import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { config as dotenvConfig } from 'dotenv';
import { keccak256, toUtf8Bytes } from 'ethers'; // Using ethers for keccak256
import { StandardMerkleTree } from "@openzeppelin/merkle-tree"; 
import Sdk from '@1inch/cross-chain-sdk'

dotenvConfig();

const SUI_PRIVATE_KEY_RESOLVER = process.env.SUI_PRIVATE_KEY_RESOLVER!;
const SUI_PRIVATE_KEY_USER = process.env.SUI_PRIVATE_KEY_USER!;
const SUI_PACKAGE_ID  = process.env.SUI_PACKAGE_ID!;
const suiClient       = new SuiClient({ url: getFullnodeUrl('testnet') });

const suiKeypairResolver = Ed25519Keypair.fromSecretKey(Buffer.from(SUI_PRIVATE_KEY_RESOLVER, 'hex'));
const suiAddressResolver = suiKeypairResolver.getPublicKey().toSuiAddress();

const suiKeypairUser = Ed25519Keypair.fromSecretKey(Buffer.from(SUI_PRIVATE_KEY_USER, 'hex'));
const suiAddressUser = suiKeypairUser.getPublicKey().toSuiAddress();

// --- Constants for Timelock Durations (in milliseconds) ---
// These are example durations. Adjust as needed for your testing.
const FINALITY_LOCK_DURATION_MS = 10 * 10; // 10 seconds
const RESOLVER_EXCLUSIVE_UNLOCK_DURATION_MS = 20 * 10000; // 20 seconds after finality lock
const RESOLVER_CANCELLATION_DURATION_MS = 30 * 1000; // 30 seconds after finality lock
const MAKER_CANCELLATION_DURATION_MS = 60 * 1000; // 60 seconds after finality lock
const PUBLIC_CANCELLATION_INCENTIVE_DURATION_MS = 15 * 1000; // 15 seconds after exclusive unlock expires

// Helper function to replicate Move contract's _isValidPartialFill logic for index calculation
export function calculateExpectedSecretIndex(
    totalOrderAmount: number,
    remainingAmount: number,
    fillAmount: number,
    partsCount: number
): number {
    const currentFilledAmount = totalOrderAmount - remainingAmount;
    const newFilledAmount = currentFilledAmount + fillAmount;

    // the core logic from Move contract's fill_order_partial for expected_index
    const targetPercentageNumerator = newFilledAmount * (partsCount + 1);
    const targetPercentageDenominator = totalOrderAmount;

    let expectedIndex = Math.floor(targetPercentageNumerator / targetPercentageDenominator); // Using Math.floor for integer division

    if (targetPercentageNumerator % targetPercentageDenominator !== 0) {
        expectedIndex = expectedIndex + 1;
    }
    return expectedIndex;
}

// // --- Helper for converting hex string to u8 vector for Move ---
function hexToU8Vector(hexString: string): number[] {
    return Array.from(Buffer.from(hexString.slice(2), 'hex'));
}

// // --- MERKLE DATA GENERATION USING @openzeppelin/merkle-tree ---
// function generateMerkleData(partsCount: number, secretPreimageBase: string) {
//     // 1. Generate N+1 secrets and their hashes (leaves)
//     const secretPreimages: string[] = [];
//     const secretHashes: string[] = []; // Hex strings of the hashes

//     for (let i = 0; i <= partsCount; i++) {
//         const secret = `${secretPreimageBase}_part_${i}`; // Generate a unique secret for each part
//         secretPreimages.push(secret);
//         secretHashes.push(keccak256(toUtf8Bytes(secret))); // Hash the secret
//     }

//     // 2. Prepare values for OpenZeppelin Merkle Tree
//     // Each value will be an array containing a single 'bytes32' element (the secret hash)
//     const ozMerkleValues = secretHashes.map(hash => [hash]);

//     // 3. Build the Merkle Tree
//     // The types must match the structure of each 'value' array.
//     // Since each 'value' is `[hash]`, the type is `["bytes32"]`.
//     const tree = StandardMerkleTree.of(ozMerkleValues, ["bytes32"]);

//     // 4. Get the root (as a hex string from OpenZeppelin library)
//     const merkleRootHex = tree.root;

//     // 5. Convert root to u8 vector for Move contract
//     const merkleRootU8 = hexToU8Vector(merkleRootHex);

//     // This function now returns a helper to generate proofs on demand
//     return {
//         secretPreimages, // Store the original preimages
//         merkleRoot: merkleRootU8, // The root to send to `partial_announce_order`
//         // A helper function to get a proof for a specific index
//         getProofForIndex: (index: number) => {
//             // OpenZeppelin library gives proof as an array of hex strings
//             const proofHex: string[] = tree.getProof(ozMerkleValues[index]);
//             // Convert each proof hash to u8 vector for Move
//             return proofHex.map(hex => hexToU8Vector(hex));
//         },
//         // Get the specific hash (leaf) for an index
//         getLeafHashForIndex: (index: number) => {
//             const leafHashHex = secretHashes[index];
//             return hexToU8Vector(leafHashHex);
//         }
//     };
// }



// --- ANNOUNCE ORDER (STANDARD - FOR FULL FILLS) ---
export async function announceStandardOrder(secretPreimage: string) {
    const txAnnounceOrder = new Transaction();
    const secretHash = hexToU8Vector(keccak256(toUtf8Bytes(secretPreimage)));

    txAnnounceOrder.moveCall({
        target: `${SUI_PACKAGE_ID}::htlc::announce_order`,
        typeArguments: ['0x2::sui::SUI'],
        arguments: [
            txAnnounceOrder.pure.vector('u8', secretHash),
            txAnnounceOrder.pure.u64(1_000_000_0), // start_price
            txAnnounceOrder.pure.u64(900_000_0), // reserve_price
            txAnnounceOrder.pure.u64(60 * 1000 * 50), // duration_ms
            txAnnounceOrder.object('0x6'), // clock
        ],
    });
    const res = await suiClient.signAndExecuteTransaction({
        signer: suiKeypairUser,
        transaction: txAnnounceOrder,
        options: { showEffects: true, showObjectChanges: true },
    });

    console.log('announce_order result:', res);
    const orderId = res.objectChanges?.find(change => change.type === 'created')?.objectId;
    return orderId;
}

// --- FILL ORDER (STANDARD - FOR FULL FILLS) ---
export async function fillStandardOrder(orderId: string) {
    const txFillOrder = new Transaction();
    txFillOrder.moveCall({
        target: `${SUI_PACKAGE_ID}::htlc::fill_order`,
        typeArguments: ['0x2::sui::SUI'],
        arguments: [
            txFillOrder.object(orderId), // Pass the object ID for the shared object
            txFillOrder.pure.u64(1000_000_0), // bid_price - Set to start_price or higher to avoid E_PRICE_TOO_LOW
            txFillOrder.object('0x6'), // clock
        ],
    });

    const res = await suiClient.signAndExecuteTransaction({
        signer: suiKeypairResolver,
        transaction: txFillOrder,
        options: { showEffects: true, showObjectChanges: true },
    });

    console.log('fill_order result:', res);
    return res;
}

// --- CREATE HTLC DST (STANDARD) ---
export async function createHTLCDst(secretPreimage: string, makerAddress: string, originalOrderId: string) {
    const secretHash = hexToU8Vector(keccak256(toUtf8Bytes(secretPreimage)));
    const tx = new Transaction();

    const [htlcCoin, safetyDepositCoin] = tx.splitCoins(tx.gas, [
        tx.pure.u64(50_000_000), // Example amount for HTLC
        tx.pure.u64(10_000_000), // Example safety deposit
    ]);

    tx.moveCall({
        target: `${SUI_PACKAGE_ID}::htlc::create_htlc_escrow_dst`,
        typeArguments: ['0x2::sui::SUI'],
        arguments: [
            tx.makeMoveVec({ elements: [tx.object(htlcCoin)] }), // coins: vector<Coin<T>>
            tx.object(safetyDepositCoin), // safety_deposit_coin
            tx.pure.vector('u8', secretHash), // secret_hash
            tx.pure.u64(FINALITY_LOCK_DURATION_MS),
            tx.pure.u64(RESOLVER_EXCLUSIVE_UNLOCK_DURATION_MS),
            tx.pure.u64(RESOLVER_CANCELLATION_DURATION_MS),
            tx.pure.u64(MAKER_CANCELLATION_DURATION_MS),
            tx.pure.u64(PUBLIC_CANCELLATION_INCENTIVE_DURATION_MS),
            tx.pure.address(makerAddress), // maker_address
            tx.pure.address(suiAddressResolver), // resolver_address (caller)
            tx.object(originalOrderId), // original_order_id
            tx.object('0x6'), // clock
        ],
    });

    const res = await suiClient.signAndExecuteTransaction({
        signer: suiKeypairResolver,
        transaction: tx,
        options: { showEffects: true, showObjectChanges: true },
    });

    console.log('create_htlc_escrow_dst result:', res);
    return res.objectChanges?.find(change => change.type === 'created')?.objectId;
}

// --- CREATE HTLC SRC (STANDARD) ---
export async function createHTLCSrc(secretPreimage: string, orderId: string, resolverAddress: string) {
    const secretHash = hexToU8Vector(keccak256(toUtf8Bytes(secretPreimage)));
    const tx = new Transaction();
    const [htlcCoin] = tx.splitCoins(tx.gas, [
        tx.pure.u64(50_000_000)
    ]);

    tx.moveCall({
        target: `${SUI_PACKAGE_ID}::htlc::create_htlc_escrow_src`,
        typeArguments: ['0x2::sui::SUI'],
        arguments: [
            tx.object(orderId),
            tx.makeMoveVec({ elements: [tx.object(htlcCoin)] }),
            tx.pure.vector('u8', secretHash),
            tx.pure.u64(FINALITY_LOCK_DURATION_MS),
            tx.pure.u64(RESOLVER_EXCLUSIVE_UNLOCK_DURATION_MS),
            tx.pure.u64(RESOLVER_CANCELLATION_DURATION_MS),
            tx.pure.u64(MAKER_CANCELLATION_DURATION_MS),
            tx.pure.u64(PUBLIC_CANCELLATION_INCENTIVE_DURATION_MS),
            tx.pure.address(resolverAddress),
            tx.object('0x6'), // clock
        ],
    });
    const res = await suiClient.signAndExecuteTransaction({
        signer: suiKeypairUser,
        transaction: tx,
        options: { showEffects: true, showObjectChanges: true },
    });
    console.log("createHTLCSrc result:", res);
    return res.objectChanges?.find(change => change.type === 'created')?.objectId;
}

// --- CLAIM HTLC ---
export async function claimHTLCdst(htlcId: string, secretPreimage: string) {
    console.log('Attempting to claim HTLC ID:', htlcId);
    const tx = new Transaction();
    const hashLock = Sdk.HashLock.forSingleFill(secretPreimage);
    const hash = hashLock.toString();
    const secretPreimageNumberArray = Array.from(toUtf8Bytes(hash));

    tx.moveCall({
        target: `${SUI_PACKAGE_ID}::htlc::claim_htlc`,
        typeArguments: ['0x2::sui::SUI'],
        arguments: [
            tx.object(htlcId),
            tx.pure.vector('u8', secretPreimageNumberArray),
            tx.object('0x6'),
        ],
    });

    const res = await suiClient.signAndExecuteTransaction({
        signer: suiKeypairResolver,
        transaction: tx,
        options: { showEffects: true, showObjectChanges: true },
    });

    console.log('claim_htlc result:', res);
    return res;
}

export async function claimHTLCdstpartial(htlcId: string, secretPreimage: string[]) {
    console.log('Attempting to claim HTLC ID:', htlcId);
    const tx = new Transaction();
    
    const leaves = Sdk.HashLock.getMerkleLeaves(secretPreimage)
    const hashLock = Sdk.HashLock.forMultipleFills(leaves)
    const hash = hashLock.toString();
    const secretPreimageNumberArray = Array.from(toUtf8Bytes(hash));

    tx.moveCall({
        target: `${SUI_PACKAGE_ID}::htlc::claim_htlc`,
        typeArguments: ['0x2::sui::SUI'],
        arguments: [
            tx.object(htlcId),
            tx.pure.vector('u8', secretPreimageNumberArray),
            tx.object('0x6'),
        ],
    });

    const res = await suiClient.signAndExecuteTransaction({
        signer: suiKeypairUser,
        transaction: tx,
        options: { showEffects: true, showObjectChanges: true },
    });

    console.log('claim_htlc result:', res);
    return res;
}

export async function claimHTLCsrcpartial(htlcId: string, secretPreimage: string[]) {
    console.log('Attempting to claim HTLC ID:', htlcId);
    const tx = new Transaction();
    const leaves = Sdk.HashLock.getMerkleLeaves(secretPreimage)
    const hashLock = Sdk.HashLock.forMultipleFills(leaves)
    const hash = hashLock.toString();
    const secretPreimageNumberArray = Array.from(toUtf8Bytes(hash));

    tx.moveCall({
        target: `${SUI_PACKAGE_ID}::htlc::claim_htlc`,
        typeArguments: ['0x2::sui::SUI'],
        arguments: [
            tx.object(htlcId),
            tx.pure.vector('u8', secretPreimageNumberArray),
            tx.object('0x6'),
        ],
    });

    const res = await suiClient.signAndExecuteTransaction({
        signer: suiKeypairResolver,
        transaction: tx,
        options: { showEffects: true, showObjectChanges: true },
    });

    console.log('claim_htlc result:', res);
    return res;
}


export async function claimHTLCsrc(htlcId: string, secretPreimage: string) {
    console.log('Attempting to claim HTLC ID:', htlcId);
    const tx = new Transaction();
    const hashLock = Sdk.HashLock.forSingleFill(secretPreimage);
    const hash = hashLock.toString();
    const secretPreimageNumberArray = Array.from(toUtf8Bytes(hash));

    tx.moveCall({
        target: `${SUI_PACKAGE_ID}::htlc::claim_htlc`,
        typeArguments: ['0x2::sui::SUI'],
        arguments: [
            tx.object(htlcId),
            tx.pure.vector('u8', secretPreimageNumberArray),
            tx.object('0x6'),
        ],
    });

    const res = await suiClient.signAndExecuteTransaction({
        signer: suiKeypairResolver,
        transaction: tx,
        options: { showEffects: true, showObjectChanges: true },
    });

    console.log('claim_htlc result:', res);
    return res;
}

// --- RECOVER HTLC ---
export async function recoverHTLC(htlcId: string) {
    console.log('Attempting to recover HTLC ID:', htlcId);
    const tx = new Transaction();

    tx.moveCall({
        target: `${SUI_PACKAGE_ID}::htlc::recover_htlc_escrow`,
        typeArguments: ['0x2::sui::SUI'],
        arguments: [
            tx.object(htlcId),
            tx.object('0x6'),
        ],
    });

    const res = await suiClient.signAndExecuteTransaction({
        signer: suiKeypairUser,
        transaction: tx,
        options: { showEffects: true, showObjectChanges: true },
    });

    console.log('recover_htlc_escrow result:', res);
    return res;
}

// --- ADD SAFETY DEPOSIT ---
export async function addSafetyDeposit(
    htlcId: string,
    signerKeypair: Ed25519Keypair
) {
    const tx = new Transaction();
    const [depositCoin] = tx.splitCoins(tx.gas, [
        tx.pure.u64(10_000_000),
    ]);

    tx.moveCall({
        target: `${SUI_PACKAGE_ID}::htlc::add_safety_deposit`,
        typeArguments: ['0x2::sui::SUI'],
        arguments: [
            tx.object(htlcId),
            tx.object(depositCoin),
        ],
    });

    const result = await suiClient.signAndExecuteTransaction({
        signer: signerKeypair,
        transaction: tx,
        options: {
            showEffects: true,
            showObjectChanges: true,
        },
    });

    console.log('add_safety_deposit result:', result);
    return result;
}

// --- AUCTION TICK ---
export async function auctionTick(orderId: string): Promise<number> {
    const tx = new Transaction();
    tx.moveCall({
        target: `${SUI_PACKAGE_ID}::htlc::auction_tick`,
        typeArguments: ['0x2::sui::SUI'],
        arguments: [
            tx.object(orderId),
            tx.object('0x6'),
        ],
    });
    const res = await suiClient.signAndExecuteTransaction({
        signer: suiKeypairResolver,
        transaction: tx,
        options: { showEffects: true, showEvents: true },
    });
    const evt = res.events?.find(e => e.type.endsWith('AuctionTickEvent'));
    return evt?.parsedJson?.current_price as number;
}


export async function auctionTickpartial(orderId: string): Promise<number> {
    const tx = new Transaction();
    tx.moveCall({
        target: `${SUI_PACKAGE_ID}::htlc::partial_auction_tick`,
        typeArguments: ['0x2::sui::SUI'],
        arguments: [
            tx.object(orderId),
            tx.object('0x6'),
        ],
    });
    const res = await suiClient.signAndExecuteTransaction({
        signer: suiKeypairResolver,
        transaction: tx,
        options: { showEffects: true, showEvents: true },
    });
    const evt = res.events?.find(e => e.type.endsWith('AuctionTickEvent'));
    return evt?.parsedJson?.current_price as number;
}


// --- PARTIAL FILL FUNCTIONS ---

// async function partialAnnounceOrder(totalAmount: number, partsCount: number, secretPreimageBase: string) {
//     const tx = new Transaction();
//     const { merkleRoot } = generateMerkleData(partsCount, secretPreimageBase);

//     tx.moveCall({
//         target: `${SUI_PACKAGE_ID}::htlc::partial_announce_order`,
//         typeArguments: ['0x2::sui::SUI'],
//         arguments: [
//             tx.pure.u64(totalAmount),
//             tx.pure.u64(1_000_000_000), // start_price
//             tx.pure.u64(900_000_000), // reserve_price
//             tx.pure.u64(60 * 1000), // duration_ms
//             tx.pure.u64(partsCount),
//             tx.pure.vector('u8', merkleRoot), // Send the actual root
//             tx.object('0x6'), // clock
//         ],
//     });

//     const announceRes = await suiClient.signAndExecuteTransaction({
//         signer: suiKeypair,
//         transaction: tx,
//         options: { showEffects: true, showObjectChanges: true },
//     });

//     console.log('partial_announce_order result:', announceRes);
//     const orderId = announceRes.objectChanges?.find(change => change.type === 'created')?.objectId;

//     // Return the orderId AND the merkleData object so you can generate proofs later
//     return { orderId, merkleData: generateMerkleData(partsCount, secretPreimageBase) }; // Re-generate to get access to getProofForIndex
// }

export async function partialAnnounceOrder(totalAmount: number, partsCount: number, merkleRoot: string) {
    const tx = new Transaction();
   

    tx.moveCall({
        target: `${SUI_PACKAGE_ID}::htlc::partial_announce_order`,
        typeArguments: ['0x2::sui::SUI'],
        arguments: [
            tx.pure.u64(totalAmount),
            tx.pure.u64(1_000_000_000), // start_price
            tx.pure.u64(900_000_000),   // reserve_price
            tx.pure.u64(60 * 1000),     // duration_ms
            tx.pure.u64(partsCount),
            tx.pure.vector('u8', hexToU8Vector(merkleRoot)), 
            tx.object('0x6'), // clock
        ],
    });

    const announceRes = await suiClient.signAndExecuteTransaction({
        signer: suiKeypairUser,
        transaction: tx,
        options: { showEffects: true, showObjectChanges: true, showEvents: true },
    });

    console.log('partial_announce_order result:', announceRes);
    const orderId = announceRes.objectChanges?.find(change => change.type === 'created')?.objectId;
    const evt = announceRes.events?.find(e => e.type.endsWith('PartialOrderAnnouncedEvent'));
    return { orderId};
}


export async function fillOrderPartial(orderId: string, fillAmount: number, targetSecretIndex: number, targetSecretHash : string) {
    const tx = new Transaction();
    const tgHash= hexToU8Vector(targetSecretHash);
    tx.moveCall({
        target: `${SUI_PACKAGE_ID}::htlc::fill_order_partial`,
        typeArguments: ['0x2::sui::SUI'],
        arguments: [
            tx.object(orderId),
            tx.pure.u64(fillAmount),
            tx.pure.u64(1_000_000_000), // bid_price - Set to start_price or higher
            tx.pure.vector('u8', tgHash),
            tx.pure.u64(targetSecretIndex),
            tx.object('0x6'), // clock
        ],
    });

    const fillRes = await suiClient.signAndExecuteTransaction({
        signer: suiKeypairResolver,
        transaction: tx,
        options: { showEffects: true, showObjectChanges: true },
    });

    console.log('fill_order_partial result:', fillRes);
    return fillRes;
}

// --- CREATE HTLC SRC PARTIAL ---
export async function createHTLCSrcPartial(
    orderId: string,
    secretPreimage: string,
    resolverAddress: string,
    hashLockIndex: number
) {
    const secretHash = hexToU8Vector(keccak256(toUtf8Bytes(secretPreimage)));
    const tx = new Transaction();
    const [htlcCoin] = tx.splitCoins(tx.gas, [
        tx.pure.u64(25_000_000)
    ]);

    tx.moveCall({
        target: `${SUI_PACKAGE_ID}::htlc::create_htlc_escrow_src_partial`,
        typeArguments: ['0x2::sui::SUI'],
        arguments: [
            tx.object(orderId),
            tx.makeMoveVec({ elements: [tx.object(htlcCoin)] }),
            tx.pure.vector('u8', secretHash),
            tx.pure.u64(FINALITY_LOCK_DURATION_MS),
            tx.pure.u64(RESOLVER_EXCLUSIVE_UNLOCK_DURATION_MS),
            tx.pure.u64(RESOLVER_CANCELLATION_DURATION_MS),
            tx.pure.u64(MAKER_CANCELLATION_DURATION_MS),
            tx.pure.u64(PUBLIC_CANCELLATION_INCENTIVE_DURATION_MS),
            tx.pure.address(resolverAddress),
            tx.pure.u64(hashLockIndex),
            tx.object('0x6'), // clock
        ],
    });
    const res = await suiClient.signAndExecuteTransaction({
        signer: suiKeypairUser,
        transaction: tx,
        options: { showEffects: true, showObjectChanges: true },
    });
    console.log("createHTLCSrcPartial result:", res);
    return res.objectChanges?.find(change => change.type === 'created')?.objectId;
}

// --- CREATE HTLC DST PARTIAL ---
export async function createHTLCDstPartial(
    secretPreimage: string,
    makerAddress: string,
    resolverAddress: string,
    originalPartialOrderId: string,
    hashLockIndex: number
) {
    const secretHash = hexToU8Vector(keccak256(toUtf8Bytes(secretPreimage)));
    const tx = new Transaction();

    const [htlcCoin, safetyDepositCoin] = tx.splitCoins(tx.gas, [
        tx.pure.u64(25_000_000),
        tx.pure.u64(5_000_000),
    ]);

    tx.moveCall({
        target: `${SUI_PACKAGE_ID}::htlc::create_htlc_escrow_dst_partial`,
        typeArguments: ['0x2::sui::SUI'],
        arguments: [
            tx.makeMoveVec({ elements: [tx.object(htlcCoin)] }),
            tx.object(safetyDepositCoin),
            tx.pure.vector('u8', secretHash),
            tx.pure.u64(FINALITY_LOCK_DURATION_MS),
            tx.pure.u64(RESOLVER_EXCLUSIVE_UNLOCK_DURATION_MS),
            tx.pure.u64(RESOLVER_CANCELLATION_DURATION_MS),
            tx.pure.u64(MAKER_CANCELLATION_DURATION_MS),
            tx.pure.u64(PUBLIC_CANCELLATION_INCENTIVE_DURATION_MS),
            tx.pure.address(makerAddress),
            tx.pure.address(resolverAddress),
            tx.object(originalPartialOrderId),
            tx.pure.u64(hashLockIndex),
            tx.object('0x6'),
        ],
    });

    const res = await suiClient.signAndExecuteTransaction({
        signer: suiKeypairResolver,
        transaction: tx,
        options: { showEffects: true, showObjectChanges: true },
    });

    console.log('create_htlc_escrow_dst_partial result:', res);
    return res.objectChanges?.find(change => change.type === 'created')?.objectId;
}


// --- TEST FUNCTIONS ---

// async function testStandardHTLCFlow() {
//     console.log("\n--- Testing Standard HTLC Flow ---");
//     const secret = 'standard_secret_123';
//     const orderId = await announceStandardOrder(secret);

//     if (orderId) {
//         await fillStandardOrder(orderId);
//         console.log("Standard Order filled successfully.");

//         const htlcSrcId = await createHTLCSrc(secret, orderId, suiAddress);
//         console.log("Standard HTLC created on source chain:", htlcSrcId);

//         if (htlcSrcId) {
//             await addSafetyDeposit(htlcSrcId, suiKeypair);
//             console.log("Safety deposit added successfully.");

//             console.log("Waiting for finality lock to expire for claim (Standard Flow)...");
//             await new Promise(r => setTimeout(r, FINALITY_LOCK_DURATION_MS + 1000));
//             await claimHTLC(htlcSrcId, secret);
//             console.log("Standard HTLC claimed successfully.");
//         }
//     } else {
//         console.error("Standard Order ID not found.");
//     }
// }

// async function testPartialHTLCFlow() {
//     console.log("\n--- Testing Partial HTLC Flow ---");
//     const secretPreimageBase = 'partial_order_master_secret';
//     const partsCount = 4; // N=4 means 5 secrets (0-4)
//     const totalOrderAmount = 100_000_000;

//     // 1. Announce Partial Order and get the merkleData object back
//     // const { orderId: partialOrderId, merkleData } = await partialAnnounceOrder(totalOrderAmount, partsCount, secretPreimageBase);
//   const { orderId: partialOrderId, merkleData } = await partialAnnounceOrder(totalOrderAmount, partsCount, secretPreimageBase);

//     if (partialOrderId) {
//         console.log("Partial Order Announced ID:", partialOrderId);

//         // --- First Partial Fill (e.g., for secret at index 0) ---
//         const fillAmount1 = totalOrderAmount / partsCount;
//         const targetIndex1 = 0; // First secret
        
//         console.log("🧪 Debugging Merkle Proof for index", targetIndex1);
//         console.log("Merkle Root:", Buffer.from(merkleData.merkleRoot).toString('hex'));
//         console.log("Leaf Hash for index 0:", Buffer.from(merkleData.getLeafHashForIndex(targetIndex1)).toString('hex'));
//         console.log("Proof for index 0:", merkleData.getProofForIndex(targetIndex1).map(p => Buffer.from(p).toString('hex')));
//         const fillRes1 = await fillOrderPartial(partialOrderId, fillAmount1, merkleData, targetIndex1);
//         console.log("First partial fill result:", fillRes1);

//         const htlcSrcPartialId1 = await createHTLCSrcPartial(
//             partialOrderId,
//             merkleData.secretPreimages[targetIndex1], // Pass the specific secret preimage for this index
//             suiAddress,
//             targetIndex1
//         );
//         console.log("Partial HTLC SRC created (part 1):", htlcSrcPartialId1);

//         if (htlcSrcPartialId1) {
//             await addSafetyDeposit(htlcSrcPartialId1, suiKeypair);
//             console.log("Safety deposit added for partial HTLC (part 1).");
//             console.log("Waiting for finality lock to expire for partial claim (part 1)...");
//             await new Promise(r => setTimeout(r, FINALITY_LOCK_DURATION_MS + 1000));
//             await claimHTLC(htlcSrcPartialId1, merkleData.secretPreimages[targetIndex1]);
//             console.log("Partial HTLC claimed successfully (part 1).");
//         }

//         // --- Simulate another partial fill (e.g., for secret at index 1) ---
//         console.log("\n--- Simulating another partial fill for cancellation test ---");
//         const fillAmount2 = totalOrderAmount / partsCount;
//         const targetIndex2 = 1; // Use the next secret index (assuming it's valid for your mock logic)

//         const fillRes2 = await fillOrderPartial(partialOrderId, fillAmount2, merkleData, targetIndex2);
//         console.log("Second partial fill result:", fillRes2);

//         const htlcDstPartialId1 = await createHTLCDstPartial(
//             merkleData.secretPreimages[targetIndex2], // Specific secret preimage
//             suiAddress, // Maker
//             suiAddress, // Resolver
//             partialOrderId,
//             targetIndex2
//         );
//         console.log("Partial HTLC DST created (part 2):", htlcDstPartialId1);

//         if (htlcDstPartialId1) {
//             console.log("Waiting for maker cancellation window for recovery (Partial Flow)...");
//             await new Promise(r => setTimeout(r, MAKER_CANCELLATION_DURATION_MS + 2000));
//             await recoverHTLC(htlcDstPartialId1);
//             console.log("Partial HTLC DST recovered successfully (part 2).");
//         }

//     } else {
//         console.error("Partial Order ID not found.");
//     }
// }

// // --- Main execution ---
// async function main() {
//     await testStandardHTLCFlow().catch(err => console.error("Error in Standard HTLC Flow:", err));
//     await testPartialHTLCFlow().catch(err => console.error("Error in Partial HTLC Flow:", err));
// }

// main().catch(console.error);
