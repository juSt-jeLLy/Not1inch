import { Transaction } from "@mysten/sui/transactions";
import { keccak256, toUtf8Bytes } from "ethers";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

// Helper function to convert hex string to u8 array
function hexToU8Vector(hexString: string): number[] {
    return Array.from(Buffer.from(hexString.slice(2), 'hex'));
}

export const SUI_PACKAGE_ID = "0xbcf8b75841071bccd3fb756bdeea315b6277591455761e79a12e74e74c89b69d";
export const FINALITY_LOCK_DURATION_MS = 10 * 10; // 10 seconds
export const RESOLVER_EXCLUSIVE_UNLOCK_DURATION_MS = 20 * 10000; // 20 seconds after finality lock
export const RESOLVER_CANCELLATION_DURATION_MS = 30 * 1000; // 30 seconds after finality lock
export const MAKER_CANCELLATION_DURATION_MS = 60 * 1000; // 60 seconds after finality lock
export const PUBLIC_CANCELLATION_INCENTIVE_DURATION_MS = 15 * 1000; // 15 seconds after exclusive unlock expires


export const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
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
   
}