// resolver.ts (Final Fixed version)
import {Interface, Signature, TransactionRequest} from 'ethers'
import Sdk from '@1inch/cross-chain-sdk'
import {abi} from '../dist/contracts/Resolver.sol/Resolver.json'
import {CrossChainOrder, TakerTraits, Address, Immutables} from '@1inch/cross-chain-sdk'
export class Resolver {
    private readonly iface: Interface

    constructor(
        public readonly srcAddress: string,
        public readonly dstAddress: string
    ) {
        // Create interface with fallback ABI if sweep function is missing
        this.iface = this.createInterfaceWithFallback(abi)
    }

    private createInterfaceWithFallback(abi: any[]): Interface {
        // Check if sweep function exists in ABI
        const hasSweep = abi.some(item => 
            item.type === 'function' && item.name === 'sweep'
        )

        if (!hasSweep) {
            console.warn('sweep function not found in ABI, adding manually')
            // Add sweep function to ABI
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

        // Check if arbitraryCalls function exists
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
        order: CrossChainOrder,
        signature: string,
        takerTraits: TakerTraits,
        amount: bigint,
        hashLock = order.escrowExtension.hashLockInfo
    ): TransactionRequest {
        const {r, yParityAndS: vs} = Signature.from(signature)
        const {args, trait} = takerTraits.encode()
        const immutables = order.toSrcImmutables(chainId, new Address(this.srcAddress), amount, hashLock)

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
        immutables: Immutables,
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
        escrow: Address,
        secret: string,
        immutables: Immutables
    ): TransactionRequest {
        return {
            to: side === 'src' ? this.srcAddress : this.dstAddress,
            data: this.iface.encodeFunctionData('withdraw', [escrow.toString(), secret, immutables.build()])
        }
    }

    public cancel(side: 'src' | 'dst', escrow: Address, immutables: Immutables): TransactionRequest {
        return {
            to: side === 'src' ? this.srcAddress : this.dstAddress,
            data: this.iface.encodeFunctionData('cancel', [escrow.toString(), immutables.build()])
        }
    }

    public sweep(token: string, to: string): TransactionRequest {
        return {
            to: this.srcAddress,
            data: this.iface.encodeFunctionData('sweep', [token, to])
        }
    }

    public arbitraryCalls(targets: string[], calldata: string[]): TransactionRequest {
        return {
            to: this.dstAddress,
            data: this.iface.encodeFunctionData('arbitraryCalls', [targets, calldata])
        }
    }
}
