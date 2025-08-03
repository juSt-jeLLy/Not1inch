import 'dotenv/config'
import {expect, jest} from '@jest/globals'

import {CreateServerReturnType} from 'prool'
import {auctionTickpartial,fillOrderPartial,createHTLCSrcPartial, addSafetyDeposit,partialAnnounceOrder, claimHTLCsrcpartial, calculateExpectedSecretIndex } from '../../../../sui/clientpartial';
import Sdk from '@1inch/cross-chain-sdk'
import {
    computeAddress,
    ContractFactory,
    JsonRpcProvider,
    MaxUint256,
    parseEther,
    parseUnits,
    randomBytes,
    Wallet as SignerWallet,
    Interface
} from 'ethers'
import {uint8ArrayToHex, UINT_40_MAX} from '@1inch/byte-utils'
import {ChainConfig, config} from '../../../../tests/config'
import {Wallet} from '../../../../tests/wallet'
import {Resolver} from '../../../../tests/resolversui'
import {EscrowFactory} from '../../../../tests/escrow-factory'
// import factoryContract from '../dist/contracts/TestEscrowFactory.sol/TestEscrowFactory.json'
// import resolverContract from '../dist/contracts/Resolver.sol/Resolver.json'
import {MerkleTree} from 'merkletreejs'
import { sha256 } from 'ethers';


import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';


const {Address, HashLock, TimeLocks, Immutables} = Sdk

jest.setTimeout(1000 * 60 * 20)

const SUI_PRIVATE_KEY_RESOLVER = process.env.SUI_PRIVATE_KEY_RESOLVER!;
const suiKeypairResolver = Ed25519Keypair.fromSecretKey(Buffer.from(SUI_PRIVATE_KEY_RESOLVER, 'hex'));
const suiAddressResolver = suiKeypairResolver.getPublicKey().toSuiAddress();

export const DEPLOYED_CONTRACTS = {
    escrowFactory: '0xfde41A17EBfA662867DA7324C0Bf5810623Cb3F8', 
    resolver: '0x1Ae0817d98a8A222235A2383422e1A1c03d73e3a'      
}

    type Chain = {
        node?: CreateServerReturnType | undefined
        provider: JsonRpcProvider
        escrowFactory: string
        resolver: string
    }

    // let dst: Chain
    // let dstChainUser: Wallet
    // let dstChainResolver: Wallet
    // let dstResolverContract: Wallet
    // let dstFactory: EscrowFactory
    // let resolverInstance: Resolver  // ✅ NEW: Separate variable for the Resolver class instance

    async function increaseTime(t: number, dst:Chain): Promise<void> {
        await dst.provider.send('evm_increaseTime', [t])
    }



 async function afterCreateHtlcSrc( dst:Chain,dstChainUser: Wallet, dstChainResolver: Wallet, resolverInstance: Resolver, dstFactory: EscrowFactory, secretHashes: any, leaves) {
            const parts= Sdk.HashLock.forMultipleFills(leaves).getPartsCount();
            const hashLock = Sdk.HashLock.forMultipleFills(leaves)

            //Merkle Tree
            const tree= new MerkleTree(leaves, sha256)
            const root = tree.getRoot().toString('hex')
            console.log('Merkle Root:', root);

            const hash = hashLock.toString();
            console.log('hashLock:', hashLock);
            const totalOrderAmount = 100_000_000;
            let remainingAmount = 100_000_000;
            // const secret = secrets[10]
            const idx = Number((BigInt(secretHashes.length - 1)))

            // user craetes order on the sui chain
           

            console.log("user announcing order on Sui chain ")

            const { orderId: partialOrderId} = await partialAnnounceOrder(totalOrderAmount,idx,root)
            
            console.log("Partial Order Announced ID:", partialOrderId);

            if (!partialOrderId) {
                throw new Error('Partial Order ID is undefined');
            }

            console.log("DUCH AUCTION STARTED Sui chain ")
            const duchAuction = await auctionTickpartial(partialOrderId)
            console.log("Auction ticked successfully. Current price:", duchAuction);  

            //resolver fills the order
            console.log("resolver fill order on Sui chain ")
            const fillAmount1 = totalOrderAmount / idx;
            // const targetIndex1 = 10;
            const expectedIndex = calculateExpectedSecretIndex(totalOrderAmount, remainingAmount,fillAmount1, idx);
            const targetSecretHash = secretHashes[expectedIndex];
            const fill_order_partial = await fillOrderPartial(partialOrderId, fillAmount1, expectedIndex,targetSecretHash);
            if (!fill_order_partial) {
                throw new Error('Fill order partial is undefined');
            }
            console.log("order filled on Sui chain ")
            remainingAmount -= fillAmount1;
            // const secret = secrets[expectedIndex];



            // create HTLCsrc on Sui chain
            console.log("create HTLCsrc on Sui chain ")

            const htlcSrc = await createHTLCSrcPartial(partialOrderId,targetSecretHash, suiAddressResolver,expectedIndex)
            if (!htlcSrc) throw new Error('htlcSrc is undefined');
            const htlcId = htlcSrc.toString();
            if (!htlcId) throw new Error('htlcId is undefined');
            console.log("htlcid",htlcId)

            console.log("HTLCsrc created on Sui chain ")

            //resolver adds safety deposit
            console.log("resolver adds safety deposit on Sui chain ")
            const addSafetydeposit = await addSafetyDeposit(htlcId)
            console.log("safety deposit added on Sui chain ")



            // ✅ Fix timelock values - ensure proper ordering and reasonable values
            const currentTime = BigInt(Math.floor(Date.now() / 1000));
            const hashLock1 = Sdk.HashLock.forSingleFill(secret);
            console.log('hashLock:', hashLock);
            const hash1 = hashLock.toString();

            
            const timeLocks = TimeLocks.new({
                srcWithdrawal: 2n,           // 1 minute
                srcPublicWithdrawal: 3600n,   // 1 hour  
                srcCancellation: 7200n,       // 2 hours
                srcPublicCancellation: 7260n, // 2 hours 1 minute
                dstWithdrawal: 5n,           // 30 seconds
                dstPublicWithdrawal: 1800n,   // 30 minutes
                dstCancellation: 3600n        // 1 hour (MUST be < srcCancellation!)
            }).setDeployedAt(currentTime);
        
            const dstImmutables = Immutables.new({
                orderHash: partialOrderId,
                hashLock: hashLock1,
                maker: new Address(await dstChainUser.getAddress()),
                taker: new Address(dst.resolver),
                token: new Address(config.chain.destination.tokens.USDC.address),
                amount: parseUnits('50', 6), // 99 USDC
                safetyDeposit: parseEther('0.00001'),
                timeLocks: timeLocks
            });
        
            console.log('=== TIMELOCK DEBUG ===');
            console.log('Current time:', currentTime.toString());
            console.log('DeployedAt:', timeLocks.deployedAt?.toString());
            
            const srcTimeLocks = timeLocks.toSrcTimeLocks();
            const dstTimeLocks = timeLocks.toDstTimeLocks();
            
           
        
            // ✅ Validate timelock constraints
            if (dstTimeLocks.privateCancellation >= srcTimeLocks.privateCancellation) {
                throw new Error('Destination cancellation must be before source cancellation');
            }
        
            const resolverContractInstance = new Resolver(dst.resolver, dst.resolver);
        
            console.log('🏭 Deploying destination escrow...');
            
            const srcCancellationTimestamp = srcTimeLocks.privateCancellation;
            
            const {txHash: dstDepositHash, blockTimestamp: dstDeployedAt} = await dstChainResolver.send(
                resolverInstance.deployDst(dstImmutables, srcCancellationTimestamp)
            );
            
            console.log('✅ Destination escrow deployed in tx:', dstDepositHash);
        
            // Calculate escrow address
            const dstImplementation = await dstFactory.getDestinationImpl()
            const escrowFactory = new Sdk.EscrowFactory(new Address(dst.escrowFactory))
            const dstEscrowAddress = escrowFactory.getEscrowAddress(
                dstImmutables.withDeployedAt(dstDeployedAt).hash(),
                dstImplementation
            )

            console.log('📍 Destination Escrow Address:', dstEscrowAddress.toString())
            
            console.log('⏳ Waiting for destination withdrawal timelock...');
            await increaseTime(10, dst); // Your existing function that calls evm_increaseTime
            await dst.provider.send('evm_mine', []); 
}

async function claim(htlcId: string, secret, dstChainResolver:Wallet, resolverInstance: Resolver, dstEscrowAddress: Sdk.Address, dstImmutables: Sdk.Immutables, dstDeployedAt: bigint){
    
    console.log('💰 User withdrawing from destination escrow...')
            await dstChainResolver.send(
                resolverInstance.withdraw('dst', dstEscrowAddress, secret, dstImmutables.withDeployedAt(dstDeployedAt))
            )

            console.log('💰 User withdrawl complete from destination escrow...')


             // resolver claims the funds on sui chain

             console.log("resolver claiming funds on Sui chain ")
            const claim = await claimHTLCsrcpartial(htlcId, secret)
             console.log("resolver claimed funds on Sui chain ")

             const resolverEOA = await dstChainResolver.getAddress();
          
         
             const sweepETHTx = resolverInstance.sweepDst('0x0000000000000000000000000000000000000000', resolverEOA);
             await dstChainResolver.send(sweepETHTx);
             console.log('✅ ETH swept successfully');


            console.log('Cross-chain swap completed successfully! 🎉');
}

async function initChainWithPredeployedContracts(
    cnf: ChainConfig
): Promise<{node?: CreateServerReturnType; provider: JsonRpcProvider; escrowFactory: string; resolver: string}> {
    const {provider} = await getProvider(cnf)
    
    // Verify contracts exist at the specified addresses
    const escrowFactoryCode = await provider.getCode(DEPLOYED_CONTRACTS.escrowFactory)
    const resolverCode = await provider.getCode(DEPLOYED_CONTRACTS.resolver)
    
    if (escrowFactoryCode === '0x') {
        throw new Error(`No contract found at EscrowFactory address: ${DEPLOYED_CONTRACTS.escrowFactory}`)
    }
    
    if (resolverCode === '0x') {
        throw new Error(`No contract found at Resolver address: ${DEPLOYED_CONTRACTS.resolver}`)
    }
    
    console.log(`[${cnf.chainId}]`, `Using existing EscrowFactory at`, DEPLOYED_CONTRACTS.escrowFactory)
    console.log(`[${cnf.chainId}]`, `Using existing Resolver at`, DEPLOYED_CONTRACTS.resolver)

    return {
        provider, 
        resolver: DEPLOYED_CONTRACTS.resolver, 
        escrowFactory: DEPLOYED_CONTRACTS.escrowFactory
    }
}

async function getProvider(cnf: ChainConfig): Promise<{provider: JsonRpcProvider}> {
    const provider = new JsonRpcProvider(cnf.url, cnf.chainId, {
        cacheTimeout: -1,
        staticNetwork: true
    });

    return {provider};
}
