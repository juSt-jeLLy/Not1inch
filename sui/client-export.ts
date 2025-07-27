import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { config as dotenvConfig } from 'dotenv';
import { keccak256, toUtf8Bytes } from 'ethers';
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
// async function ensureTwoCoins(): Promise<{ depositCoin: string, gasCoin: string }> {
//   ... (unchanged, omitted for brevity)
// }

export async function announceOrder(secretPreimage: string, timelockMs: number) {
  const txAnnounceOrder = new Transaction();
  const secretHash = keccak256(toUtf8Bytes(secretPreimage));
  const secretHashBytes = Buffer.from(secretHash.slice(2), 'hex');
  const secretHashNumberArray = Array.from(secretHashBytes);
  txAnnounceOrder.moveCall({
    target: `${SUI_PACKAGE_ID}::htlc::announce_order`,
    typeArguments: ['0x2::sui::SUI'],
    arguments: [
      txAnnounceOrder.pure.vector('u8', secretHashNumberArray), // secret_hash
      txAnnounceOrder.pure.u64(5),                      
      txAnnounceOrder.pure.u64(5),                     
      txAnnounceOrder.pure.u64(timelockMs),                     // timelock_duration_ms                 
      txAnnounceOrder.object('0x6'),                            // clock
    ],
  });
  const res = await suiClient.signAndExecuteTransaction({
    signer: suiKeypairUser,
    transaction: txAnnounceOrder,
    options: { showEffects: true, showObjectChanges: true },
  });

  console.log('create announce result:', res);
  return res;
}



export async function createHTLCDst(secretPreimage: string, timelockMs: number) {
  const secretHash = keccak256(toUtf8Bytes(secretPreimage));
  const tx = new Transaction();

  const secretHashBytes = Buffer.from(secretHash.slice(2), 'hex');
  const secretHashNumberArray = Array.from(secretHashBytes);

  // 1. Split main gas coin for `coins` and `safety_deposit_coin`
  const [htlcCoin, safetyDepositCoin] = tx.splitCoins(tx.gas, [
    tx.pure.u64(30_000_000),
    tx.pure.u64(10_000_000),
  ]);

  tx.moveCall({
    target: `${SUI_PACKAGE_ID}::htlc::create_htlc_escrow_dst`,
    typeArguments: ['0x2::sui::SUI'],
    arguments: [
      tx.makeMoveVec({ elements: [tx.object(htlcCoin)] }), // coins: vector<Coin<T>>
      tx.object(safetyDepositCoin),                        // safety_deposit_coin
      tx.pure.vector('u8', secretHashNumberArray),         // secret_hash
      tx.pure.u64(timelockMs),                             // timelock_duration_ms
      tx.pure.address(suiAddressUser),                         // maker_address                       // taker_address
      tx.object('0x6'),                                   // clock
    ],
  });

  const res = await suiClient.signAndExecuteTransaction({
    signer: suiKeypairResolver,
    transaction: tx,
    options: { showEffects: true, showObjectChanges: true },
  });

  console.log('create_htlc_escrow_dst result:', res);
  return res;
}




export async function claimHTLC(htlcId: string, secretPreimage: string) {
  const hashLock = Sdk.HashLock.forSingleFill(secretPreimage);
  console.log('hashLock:', hashLock);
  const hash = hashLock.toString();

  console.log('The HTLC ID is:', htlcId);
  console.log('The secret preimage is:', secretPreimage);
  const tx = new Transaction();
  const secretPreimageBytes = toUtf8Bytes(hash);
  const secretPreimageNumberArray = Array.from(secretPreimageBytes);

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

export async function claimHTLCsrc(htlcId: string, secretPreimage: string) {
  const hashLock = Sdk.HashLock.forSingleFill(secretPreimage);
  console.log('hashLock:', hashLock);
  const hash = hashLock.toString();

  console.log('The HTLC ID is:', htlcId);
  console.log('The secret preimage is:', secretPreimage);
  const tx = new Transaction();
  const secretPreimageBytes = toUtf8Bytes(hash);
  const secretPreimageNumberArray = Array.from(secretPreimageBytes);

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

export async function recoverHTLC(htlcId: string) {
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

export async function fillOrder(orderId: string){
  const txFillOrder = new Transaction();
  txFillOrder.moveCall({
    target: `${SUI_PACKAGE_ID}::htlc::fill_order`,
    typeArguments: ['0x2::sui::SUI'],
    arguments: [
      txFillOrder.object(orderId),
      txFillOrder.pure.u64(5), 
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


export async function createHTLCSrc(secretPreimage: string, timelockMs: number, orderId: string  ) {
  const tx= new Transaction();
  const secretHash = keccak256(toUtf8Bytes(secretPreimage));
  const secretHashBytes = Buffer.from(secretHash.slice(2), 'hex');
  const secretHashNumberArray = Array.from(secretHashBytes);
    const [htlcCoin] = tx.splitCoins(tx.gas, [
    tx.pure.u64(50_000_000)
    ]);
  tx.moveCall({
    target: `${SUI_PACKAGE_ID}::htlc::create_htlc_escrow_src`,
    typeArguments: ['0x2::sui::SUI'],
    arguments: [
      
      tx.object(orderId),
      tx.makeMoveVec({ elements: [tx.object(htlcCoin)] }),
      tx.pure.vector('u8', secretHashNumberArray), // secret_hash
      tx.pure.u64(timelockMs),                     // timelock_duration_ms
      tx.pure.address(suiAddressResolver),                 // resolver_address
      tx.object('0x6'),                            // clock
    ],
  });
  const res = await suiClient.signAndExecuteTransaction({
    signer: suiKeypairUser,
    transaction: tx,
    options: { showEffects: true, showObjectChanges: true },
  });
  return res;


}


export async function addSafetyDeposit(
  htlcId: string,
  
) {

  const tx = new Transaction();
  const [depositCoin] = tx.splitCoins(tx.gas, [
    tx.pure.u64(10_000_000),
  ]);

  tx.moveCall({
    target: `${SUI_PACKAGE_ID}::htlc::add_safety_deposit`,
    typeArguments: ['0x2::sui::SUI'],
    arguments: [
      tx.object(htlcId),       // &mut HashedTimelockEscrow<T>
      tx.object(depositCoin),  // Coin<0x2::sui::SUI>
    ],
  });

  const result = await suiClient.signAndExecuteTransaction({
    signer: suiKeypairResolver,
    transaction: tx,
    options: {
      showEffects: true,
      showObjectChanges: true,
    },
  });

  console.log('add_safety_deposit result:', result);
  return result;
}
export async function auctionTick(orderId: string): Promise<number> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${SUI_PACKAGE_ID}::htlc::auction_tick`,
    typeArguments: ['0x2::sui::SUI'],
    arguments: [
      tx.object(orderId),
      tx.object('0x6'),  // on‑chain Clock singleton
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

// async function testDst() {
//   const secret = 'my_super_secret';
//   const duration = 5 * 60 * 1000; // 5 minutes in ms

//   const createR = await createHTLCDst(secret, duration);
//   const htlcId = createR.objectChanges?.find(change => change.type === 'created')?.objectId;
//   console.log("Created Dst HTLC ID:", htlcId);
//   // await new Promise(r => setTimeout(r, duration + 1000));
//   // await recoverHTLC(htlcId!);
// }

// testDst().catch(console.error);


// async function testSrc(){
//   const secret = 'my_super_secret';
//   const duration = 5 * 60 * 1000; // 5 minutes in ms
//   const announce_order = await announceOrder(secret, duration);
//   const orderId = announce_order.objectChanges?.find(change => change.type === 'created')?.objectId;
//   console.log("Announced Order ID:", orderId);
//   if (orderId) {
//     await fillOrder(orderId);
//     console.log("Order filled successfully.");
//     const createHtlcSrc = await createHTLCSrc(secret, duration, orderId);
//     console.log("HTLC created on source chain:", createHtlcSrc);
//     const claimResult = await claimHTLC(createHtlcSrc.objectChanges?.find(change => change.type === 'created')?.objectId!, secret); 
//     console.log("HTLC claimed successfully:", claimResult);
//   } else {
//     console.error("Order ID not found in the response.");
//   }
// }

// testSrc().catch(console.error);