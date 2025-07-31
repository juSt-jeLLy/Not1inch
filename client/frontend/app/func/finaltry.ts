import { Transaction } from '@mysten/sui/transactions';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import {keccak256, toUtf8Bytes} from 'ethers';
import { SUI_PACKAGE_ID } from './suitoevm';
import { exec } from 'child_process';
// Helper function to convert hex string to u8 array
function hexToU8Vector(hexString: string): number[] {
    return Array.from(Buffer.from(hexString.slice(2), 'hex'));
}
const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
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
    // const res = await suiClient.signAndExecuteTransaction({
    //     signer: suiKeypair,
    //     transaction: txAnnounceOrder,
    //     options: { showEffects: true, showObjectChanges: true },
    // });

    // const res = await suiClient.executeTransaction({
    //     transaction: txAnnounceOrder,
    //     options: { showEffects: true, showObjectChanges: true },
    //     signature: signature,
    // });
  

    // console.log('announce_order result:', res);
    // const orderId = res.objectChanges?.find(change => change.type === 'created')?.objectId;
    // return orderId;
    
}

export async function tryOrder() {
    const order = await suiClient.getObject({ id: '0x0d87b0e94a6fc1d07203a29deb5d67facb0e551808b5886959b29bfcbb71c57d' });
    return order;
}