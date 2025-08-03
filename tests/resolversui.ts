import {Interface, Signature, TransactionRequest} from 'ethers'
import Sdk from '@1inch/cross-chain-sdk'
import Contract from '../dist/contracts/Resolver.sol/Resolver.json'

export class Resolver {
    private readonly iface: Interface

    constructor(
        public readonly srcAddress: string,
        public readonly dstAddress: string
    ) {
        this.iface = this.createInterfaceWithFallback(Contract.abi)
    }

    private createInterfaceWithFallback(abi: any[]): Interface {
        const hasSweep = abi.some(item => 
            item.type === 'function' && item.name === 'sweep'
        )

        if (!hasSweep) {
            console.warn('sweep function not found in ABI, adding manually')
            const sweepABI = {
                "type": "function",
                "name": "sweep",
                "inputs": [
                    {"name": "token", "type": "address", "internalType": "address"},
                    {"name": "to", "type": "address", "internalType": "address"}
                ],
                "outputs": [],
                "stateMutability": "nonpayable"
            }
            abi = [...abi, sweepABI]
        }

        const hasArbitraryCalls = abi.some(item => 
            item.type === 'function' && item.name === 'arbitraryCalls'
        )

        if (!hasArbitraryCalls) {
            console.warn('arbitraryCalls function not found in ABI, adding manually')
            const arbitraryCallsABI = {
                "type": "function",
                "name": "arbitraryCalls",
                "inputs": [
                    {"name": "targets", "type": "address[]", "internalType": "address[]"},
                    {"name": "arguments", "type": "bytes[]", "internalType": "bytes[]"}
                ],
                "outputs": [],
                "stateMutability": "nonpayable"
            }
            abi = [...abi, arbitraryCallsABI]
        }

        return new Interface(abi)
    }

    public deploySrc(
        chainId: number,
        order: Sdk.CrossChainOrder,
        signature: string,
        takerTraits: Sdk.TakerTraits,
        amount: bigint,
        hashLock = order.escrowExtension.hashLockInfo
    ): TransactionRequest {
        const {r, yParityAndS: vs} = Signature.from(signature)
        const {args, trait} = takerTraits.encode()
        const immutables = order.toSrcImmutables(chainId, new Sdk.Address(this.srcAddress), amount, hashLock)

        return {
            to: this.srcAddress,
            data: this.iface.encodeFunctionData('deploySrc', [
                immutables.build(),
                order.build(),
                r,
                vs,
                amount,
                trait,
                args
            ]),
            value: order.escrowExtension.srcSafetyDeposit
        }
    }

    public deployDst(
        immutables: Sdk.Immutables,
        srcCancellationTimestamp?: bigint
    ): TransactionRequest {
        const cancellationTimestamp = srcCancellationTimestamp || 
            immutables.timeLocks.toSrcTimeLocks().privateCancellation;
            
        return {
            to: this.dstAddress,
            data: this.iface.encodeFunctionData('deployDst', [
                immutables.build(),
                cancellationTimestamp
            ]),
            value: immutables.safetyDeposit
        }
    }

    public withdraw(
        side: 'src' | 'dst',
        escrow: Sdk.Address,
        secret: string,
        immutables: Sdk.Immutables
    ): TransactionRequest {
        return {
            to: side === 'src' ? this.srcAddress : this.dstAddress,
            data: this.iface.encodeFunctionData('withdraw', [escrow.toString(), secret, immutables.build()])
        }
    }

    public cancel(side: 'src' | 'dst', escrow: Sdk.Address, immutables: Sdk.Immutables): TransactionRequest {
        return {
            to: side === 'src' ? this.srcAddress : this.dstAddress,
            data: this.iface.encodeFunctionData('cancel', [escrow.toString(), immutables.build()])
        }
    }

    // ✅ FIXED: Add side parameter to determine which contract to sweep from
    public sweep(token: string, to: string, side: 'src' | 'dst' = 'dst'): TransactionRequest {
        return {
            to: side === 'src' ? this.srcAddress : this.dstAddress, // ✅ Use correct address based on side
            data: this.iface.encodeFunctionData('sweep', [token, to])
        }
    }

    public arbitraryCalls(targets: string[], calldata: string[]): TransactionRequest {
        return {
            to: this.dstAddress,
            data: this.iface.encodeFunctionData('arbitraryCalls', [targets, calldata])
        }
    }

    // ✅ NEW: Convenience methods for specific side sweeping
    public sweepSrc(token: string, to: string): TransactionRequest {
        return this.sweep(token, to, 'src')
    }

    public sweepDst(token: string, to: string): TransactionRequest {
        return this.sweep(token, to, 'dst')
    }
}