// shared/swap-logic.ts
import {
    JsonRpcProvider,
    parseEther,
    parseUnits,
    MaxUint256,
    Interface
} from 'ethers';
import { uint8ArrayToHex } from '@1inch/byte-utils';
import Sdk from '@1inch/cross-chain-sdk';

// Import your actual classes (you'll need to copy these files to your shared folder or adjust paths)
import { Wallet } from './wallet';
import { Resolver } from './resolversui';
import { EscrowFactory } from './escrow-factory';
import resolverContract from '../dist/contracts/Resolver.sol/Resolver.json';

const { Address, HashLock, TimeLocks, Immutables } = Sdk;

// Hardcoded configuration based on your env
const CONFIG = {
    SRC_CHAIN_RPC: 'https://virtual.arbitrum.eu.rpc.tenderly.co/c58e0ebb-323d-4cc9-b206-5e1d5a9d5de6',
    DST_CHAIN_RPC: 'https://virtual.arbitrum.eu.rpc.tenderly.co/c58e0ebb-323d-4cc9-b206-5e1d5a9d5de6',
    SUI_PRIVATE_KEY_RESOLVER: 'e3cbc98f1be6f9caf78c2fb3ba2a19de1e49fdc4f05ddd082e37a18ef5252918',
    SUI_PACKAGE_ID: '0x14e9f86c5e966674e6dbb28545bbff2052e916d93daba5729dbc475b1b336bb4',
    SUI_PRIVATE_KEY_USER: '1d6b12793508282886435d5896c1898c1f05e744f64c8c9faeac1bdfdc1b5105',
    DEPLOYED_CONTRACTS: {
        escrowFactory: '0xcb818a64dd9aa858b96d83cca5a628ff5452f552',
        resolver: '0xb103c05fe2451b9b09dbe45ad78e0c294dd22aaa'
    },
    CHAIN_CONFIG: {
        chainId: 421614, // Arbitrum Sepolia
        tokens: {
            USDC: {
                address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831'
            }
        }
    }
};

// Private keys from your test file
const userPk = '0x38c4aadf07a344bd5f5baedc7b43f11a9b863cdd16242f3b94a53541ad19fedc';
const resolverPk = '0x1d02f466767e86d82b6c647fc7be69dc1bc98931a99ac9666d8b591bb0cc1e66';

export interface SwapParams {
    secret: string;
    orderHash: string;
    htlcId: string;
    amount: string;
}

export interface SwapResult {
    success: boolean;
    dstEscrowAddress?: string;
    error?: string;
    txHash?: string;
}

async function increaseTime(provider: JsonRpcProvider, timeInSeconds: number): Promise<void> {
    await provider.send('evm_increaseTime', [timeInSeconds]);
    await provider.send('evm_mine', []);
}

export async function executeDestinationSwap(params: SwapParams): Promise<SwapResult> {
    try {
        const { secret, orderHash, htlcId, amount } = params;
        
        console.log('🚀 Starting destination swap execution...');
        console.log('Secret:', secret);
        console.log('Order Hash:', orderHash);
        console.log('HTLC ID:', htlcId);
        console.log('Amount:', amount);

        // Initialize provider exactly like in the test
        const provider = new JsonRpcProvider(CONFIG.DST_CHAIN_RPC, CONFIG.CHAIN_CONFIG.chainId, {
            cacheTimeout: -1,
            staticNetwork: true
        });

        // Initialize wallets using your actual Wallet class
        const dstChainUser = new Wallet(userPk, provider);
        const dstChainResolver = new Wallet(resolverPk, provider);
        const dstFactory = new EscrowFactory(provider, CONFIG.DEPLOYED_CONTRACTS.escrowFactory);

        console.log('💼 Wallets initialized');
        console.log('User address:', await dstChainUser.getAddress());
        console.log('Resolver address:', await dstChainResolver.getAddress());

        // Transfer ETH to resolver contract for gas
        console.log('⛽ Transferring ETH to resolver contract...');
        await dstChainResolver.transfer(CONFIG.DEPLOYED_CONTRACTS.resolver, parseEther('1'));

        // ✅ 1. Transfer USDC directly to the resolver CONTRACT
        console.log('💰 Transferring USDC to resolver contract...');
        await dstChainResolver.transferToken(
            CONFIG.CHAIN_CONFIG.tokens.USDC.address,
            CONFIG.DEPLOYED_CONTRACTS.resolver, // This is the resolver CONTRACT address
            parseUnits('1000', 6) // Give contract enough USDC
        );

        // ✅ 2. Make the resolver CONTRACT approve the escrow factory
        console.log('✅ Setting up resolver contract approvals...');
        const usdcInterface = new Interface([
            'function approve(address spender, uint256 amount) returns (bool)'
        ]);

        const resolverInstance = new Resolver(
            '0x0000000000000000000000000000000000000000', // srcAddress - use actual if you have one
            CONFIG.DEPLOYED_CONTRACTS.resolver // dstAddress - this is the deployed resolver contract address
        );

        const approveCalldata = usdcInterface.encodeFunctionData('approve', [
            CONFIG.DEPLOYED_CONTRACTS.escrowFactory, // Approve the factory
            MaxUint256 // Unlimited approval
        ]);

        const resolverInterface = new Interface(resolverContract.abi);
        
        await dstChainResolver.send({
            to: CONFIG.DEPLOYED_CONTRACTS.resolver,
            data: resolverInterface.encodeFunctionData('arbitraryCalls', [
                [CONFIG.CHAIN_CONFIG.tokens.USDC.address], // Target: USDC contract
                [approveCalldata] // Call: approve(factory, MaxUint256)
            ])
        });
        
        console.log('✅ Resolver contract has USDC and approved factory');

        // Create hashlock from secret exactly like in test
        const hashLock = Sdk.HashLock.forSingleFill(secret);
        
        console.log('🔐 HashLock created:', hashLock.toString());

        // ✅ Fix timelock values - ensure proper ordering and reasonable values
        const currentTime = BigInt(Math.floor(Date.now() / 1000));
        
        const timeLocks = TimeLocks.new({
            srcWithdrawal:BigInt(2),           // 1 minute
            srcPublicWithdrawal: BigInt(3200),   // 1 hour  
            srcCancellation: BigInt(7200),       // 2 hours
            srcPublicCancellation: BigInt(7260), // 2 hours 1 minute
            dstWithdrawal: BigInt(5),           // 30 seconds
            dstPublicWithdrawal: BigInt(1800),   // 30 minutes
            dstCancellation: BigInt(3600)        // 1 hour (MUST be < srcCancellation!)
        }).setDeployedAt(currentTime);

        const dstImmutables = Immutables.new({
            orderHash: orderHash,
            hashLock: hashLock,
            maker: new Address(await dstChainUser.getAddress()),
            taker: new Address(CONFIG.DEPLOYED_CONTRACTS.resolver),
            token: new Address(CONFIG.CHAIN_CONFIG.tokens.USDC.address),
            amount: parseUnits('99', 6), // 99 USDC
            safetyDeposit: parseEther('0.001'),
            timeLocks: timeLocks
        });

        console.log('=== TIMELOCK DEBUG ===');
        console.log('Current time:', currentTime.toString());
        console.log('DeployedAt:', timeLocks.deployedAt?.toString());
        
        const srcTimeLocks = timeLocks.toSrcTimeLocks();
        const dstTimeLocks = timeLocks.toDstTimeLocks();
        
        console.log('Source private cancellation:', srcTimeLocks.privateCancellation.toString());
        console.log('Destination private cancellation:', dstTimeLocks.privateCancellation.toString());

        // ✅ Validate timelock constraints
        if (dstTimeLocks.privateCancellation >= srcTimeLocks.privateCancellation) {
            throw new Error('Destination cancellation must be before source cancellation');
        }

        console.log('🏭 Deploying destination escrow...');
        
        const srcCancellationTimestamp = srcTimeLocks.privateCancellation;
        
        const {txHash: dstDepositHash, blockTimestamp: dstDeployedAt} = await dstChainResolver.send(
            resolverInstance.deployDst(dstImmutables, srcCancellationTimestamp)
        );
        
        console.log('✅ Destination escrow deployed in tx:', dstDepositHash);

        // Calculate escrow address
        const dstImplementation = await dstFactory.getDestinationImpl()
        const escrowFactory = new Sdk.EscrowFactory(new Address(CONFIG.DEPLOYED_CONTRACTS.escrowFactory))
        const dstEscrowAddress = escrowFactory.getEscrowAddress(
            dstImmutables.withDeployedAt(dstDeployedAt).hash(),
            dstImplementation
        )

        console.log('📍 Destination Escrow Address:', dstEscrowAddress.toString())
        
        console.log('⏳ Waiting for destination withdrawal timelock...');
        await increaseTime(provider, 10); // Your existing function that calls evm_increaseTime

        // User withdraws from destination escrow
        console.log('💰 User withdrawing from destination escrow...');
        const withdrawTx = await dstChainResolver.send(
            resolverInstance.withdraw('dst', dstEscrowAddress, secret, dstImmutables.withDeployedAt(dstDeployedAt))
        );

        console.log('💰 User withdrawal complete from destination escrow...', withdrawTx.txHash);
        console.log('Cross-chain swap completed successfully! 🎉');

        return {
            success: true,
            dstEscrowAddress: dstEscrowAddress.toString(),
            txHash: dstDepositHash
        };

    } catch (error) {
        console.error('❌ Swap execution failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}