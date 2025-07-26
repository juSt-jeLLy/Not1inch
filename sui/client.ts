import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { config as dotenvConfig } from 'dotenv';
import { keccak256, toUtf8Bytes } from 'ethers';

dotenvConfig();

const SUI_PRIVATE_KEY = process.env.SUI_PRIVATE_KEY!;
const SUI_PACKAGE_ID  = process.env.SUI_PACKAGE_ID!;
const suiClient       = new SuiClient({ url: getFullnodeUrl('testnet') });

const suiKeypair = Ed25519Keypair.fromSecretKey(Buffer.from(SUI_PRIVATE_KEY, 'hex'));
const suiAddress = suiKeypair.getPublicKey().toSuiAddress();

// async function ensureTwoCoins(): Promise<{ depositCoin: string, gasCoin: string }> {
//   const resp = await suiClient.getCoins({ owner: suiAddress, coinType: '0x2::sui::SUI' });
//   const coins = resp.data.filter(c => BigInt(c.balance) >= 100_000_000n);
  
//   if (coins.length >= 2) {
//     // Already have two suitable coins
//     return { depositCoin: coins[0].coinObjectId, gasCoin: coins[1].coinObjectId };
//   } else if (coins.length === 1) {
//     // Only one large coin: split it into two
    
//     const coinToSplit = coins[0];
//     console.log(`Splitting coin ${coinToSplit.coinObjectId} into two coins of 0.1 SUI each...`);

//     const tx = new Transaction();
//     // tx.splitCoins({
//     //   coin: tx.object(coinToSplit.coinObjectId),
//     //   amounts: [100_000_000, 100_000_000], // 0.1 SUI each
//     // });
//     tx.splitCoins(tx.gas, [tx.pure.u64(50_000_000)])
//     tx.setGasBudget(1000000); // adjust gas budget if needed

//     const splitResult = await suiClient.signAndExecuteTransaction({
//       signer: suiKeypair,
//       transaction: tx,
//       options: { showEffects: true, showObjectChanges: true },
//     });

//     // Extract the newly created coins from objectChanges
//     const createdCoins = splitResult.objectChanges?.filter(
//       c => c.type === 'created' && c.objectType === '0x2::coin::Coin<0x2::sui::SUI>'
//     );

//     if (!createdCoins || createdCoins.length < 2) {
//       throw new Error('Failed to split coin into two parts');
//     }

//     console.log('Split coins created:', createdCoins.map(c => c.objectId));
//     return { depositCoin: createdCoins[0].objectId, gasCoin: createdCoins[1].objectId };
//   } else {
//     throw new Error('No coins with balance >= 0.1 SUI found');
//   }
// }

async function createHTLC(secretPreimage: string, timelockMs: number) {
  const secretHash = keccak256(toUtf8Bytes(secretPreimage));
  const tx = new Transaction();

  const secretHashBytes = Buffer.from(secretHash.slice(2), 'hex');
  const secretHashNumberArray = Array.from(secretHashBytes);
  const [coins] = tx.splitCoins(tx.gas, [tx.pure.u64(50_000_000)]);
  tx.moveCall({
    target: `${SUI_PACKAGE_ID}::htlc::create_htlc_escrow`,
    typeArguments: ['0x2::sui::SUI'],
    arguments: [
      tx.makeMoveVec({ elements: [tx.object(coins)] }),
      tx.pure.vector('u8', secretHashNumberArray),
      tx.pure.u64(timelockMs),
      tx.pure.address(suiAddress),
      tx.pure.address(suiAddress),
      tx.object('0x6'),
    ],
  });

  const res = await suiClient.signAndExecuteTransaction({
    signer: suiKeypair,
    transaction: tx,
    options: { showEffects: true, showObjectChanges: true },
  });

  console.log('create_htlc_escrow result:', res);
  return res;
}

async function claimHTLC(htlcId: string, secretPreimage: string) {
  console.log('The HTLC ID is:', htlcId);
  console.log('The secret preimage is:', secretPreimage);
  const tx = new Transaction();
  const secretPreimageBytes = toUtf8Bytes(secretPreimage);
  const secretPreimageNumberArray = Array.from(secretPreimageBytes);

  tx.moveCall({
    target: `${SUI_PACKAGE_ID}::htlc::claim_htlc_escrow`,
    typeArguments: ['0x2::sui::SUI'],
    arguments: [
      tx.object(htlcId),
      tx.pure.vector('u8', secretPreimageNumberArray),
      tx.object('0x6'),
    ],
  });

  const res = await suiClient.signAndExecuteTransaction({
    signer: suiKeypair,
    transaction: tx,
    options: { showEffects: true, showObjectChanges: true },
  });

  console.log('claim_htlc_escrow result:', res);
  return res;
}

async function recoverHTLC(htlcId: string) {
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
    signer: suiKeypair,
    transaction: tx,
    options: { showEffects: true, showObjectChanges: true },
  });

  console.log('recover_htlc_escrow result:', res);
  return res;
}

async function main() {
  const secret = 'my_super_secret';
  const duration = 5 * 60 * 1000; // 5 minutes in ms

  const createR = await createHTLC(secret, duration);
  const htlcId = createR.objectChanges?.find(change => change.type === 'created')?.objectId;
  console.log("Created HTLC ID:", htlcId);

  await claimHTLC(htlcId!, secret);
  await new Promise(r => setTimeout(r, duration + 1000));
  // await recoverHTLC(htlcId!);
}

main().catch(console.error);
