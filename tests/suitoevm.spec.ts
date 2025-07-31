import 'dotenv/config'
import {expect, jest} from '@jest/globals'

import {CreateServerReturnType} from 'prool'
import { claimHTLCsrc, announceStandardOrder,auctionTick,fillStandardOrder, createHTLCSrc, addSafetyDeposit,  } from '../sui/clientpartial';
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
import {ChainConfig, config} from './config'
import {Wallet} from './wallet'
import {Resolver} from './resolversui'
import {EscrowFactory} from './escrow-factory'
import factoryContract from '../dist/contracts/TestEscrowFactory.sol/TestEscrowFactory.json'
import resolverContract from '../dist/contracts/Resolver.sol/Resolver.json'


import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';


const {Address, HashLock, TimeLocks, Immutables} = Sdk

jest.setTimeout(1000 * 60 * 20)

const userPk = '0x38c4aadf07a344bd5f5baedc7b43f11a9b863cdd16242f3b94a53541ad19fedc'
const resolverPk = '0x1d02f466767e86d82b6c647fc7be69dc1bc98931a99ac9666d8b591bb0cc1e66'
const SUI_PRIVATE_KEY_RESOLVER = process.env.SUI_PRIVATE_KEY_RESOLVER!;

const suiKeypairResolver = Ed25519Keypair.fromSecretKey(Buffer.from(SUI_PRIVATE_KEY_RESOLVER, 'hex'));
const suiAddressResolver = suiKeypairResolver.getPublicKey().toSuiAddress();

describe('Resolving example', () => {
    const srcChainId = config.chain.source.chainId
    const dstChainId = config.chain.destination.chainId

    type Chain = {
        node?: CreateServerReturnType | undefined
        provider: JsonRpcProvider
        escrowFactory: string
        resolver: string
    }

    let dst: Chain
    let dstChainUser: Wallet
    let dstChainResolver: Wallet
    let dstResolverContract: Wallet
    let dstFactory: EscrowFactory
    let resolverInstance: Resolver  // ✅ NEW: Separate variable for the Resolver class instance

    async function increaseTime(t: number): Promise<void> {
        await dst.provider.send('evm_increaseTime', [t])
    }

    beforeAll(async () => {
        dst = await initChain(config.chain.destination)

        dstChainUser = new Wallet(userPk, dst.provider)
        dstChainResolver = new Wallet(resolverPk, dst.provider)

        dstFactory = new EscrowFactory(dst.provider, dst.escrowFactory)

        // Transfer ETH to resolver contract for gas
        await dstChainResolver.transfer(dst.resolver, parseEther('1'))

        // ✅ 1. Transfer USDC directly to the resolver CONTRACT
        await dstChainResolver.transferToken(
            config.chain.destination.tokens.USDC.address,
            dst.resolver, // This is the resolver CONTRACT address
            parseUnits('1000', 6) // Give contract enough USDC
        );

        // ✅ 2. Make the resolver CONTRACT approve the escrow factory
        const usdcInterface = new Interface([
            'function approve(address spender, uint256 amount) returns (bool)'
        ]);
        resolverInstance = new Resolver(
            '0x0000000000000000000000000000000000000000', // srcAddress - use actual if you have one
            dst.resolver // dstAddress - this is the deployed resolver contract address
        );


        const approveCalldata = usdcInterface.encodeFunctionData('approve', [
            dst.escrowFactory, // Approve the factory
            MaxUint256 // Unlimited approval
        ]);

        const resolverInterface = new Interface(resolverContract.abi);
        
        await dstChainResolver.send({
            to: dst.resolver,
            data: resolverInterface.encodeFunctionData('arbitraryCalls', [
                [config.chain.destination.tokens.USDC.address], // Target: USDC contract
                [approveCalldata] // Call: approve(factory, MaxUint256)
            ])
        });
        
        console.log('✅ Resolver contract has USDC and approved factory');
    })

    afterAll(async () => {
        // No cleanup needed for live RPC
    })

    describe('Fill', () => {
        it('should swap Ethereum USDC -> SUI USDC. Single fill only', async () => {
            const secret = uint8ArrayToHex(randomBytes(32))
            console.log("secret",secret)
            const hashLock = Sdk.HashLock.forSingleFill(secret);
            const orderHash = uint8ArrayToHex(randomBytes(32))


            console.log('hashLock:', hashLock);

            // user craetes order on the sui chain
            const hash = hashLock.toString();

            console.log("user announcing order on Sui chain ")

            const announce_Order = await announceStandardOrder(hash)
            if (!announce_Order) throw new Error('announce_Order is undefined');
                const orderId = announce_Order.toString();
                console.log("user announced order on Sui chain ")
                console.log("OrderId : ",orderId);


                // Duch Auction Started

            console.log("DUCH AUCTION STARTED Sui chain ")
            const duchAuction = await auctionTick(orderId)
            console.log("Auction ticked successfully. Current price:", duchAuction);  



            //resolver fills the order


            console.log("resolver fill order on Sui chain ")
            const fillorder = await fillStandardOrder(orderId)
            console.log("order filled on Sui chain ")



            // create HTLCsrc on Sui chain
            console.log("create HTLCsrc on Sui chain ")
            const htlcSrc = await createHTLCSrc(hash,  orderId, suiAddressResolver)
            if (!htlcSrc) throw new Error('htlcSrc is undefined');
            const htlcId = htlcSrc.toString();
            if (!htlcId) throw new Error('htlcId is undefined');

            console.log("HTLCsrc created on Sui chain ")

            //resolver adds safety deposit
            console.log("resolver adds safety deposit on Sui chain ")
            const addSafetydeposit = await addSafetyDeposit(htlcId)
            console.log("safety deposit added on Sui chain ")



            // ✅ Fix timelock values - ensure proper ordering and reasonable values
            const currentTime = BigInt(Math.floor(Date.now() / 1000));
            
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
                orderHash: orderHash,
                hashLock: hashLock,
                maker: new Address(await dstChainUser.getAddress()),
                taker: new Address(dst.resolver),
                token: new Address(config.chain.destination.tokens.USDC.address),
                amount: parseUnits('99', 6), // 99 USDC
                safetyDeposit: parseEther('0.001'),
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
        
            const resolverContractInstance = new Resolver('0x0000000000000000000000000000000000000000', dst.resolver);
        
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
            await increaseTime(10); // Your existing function that calls evm_increaseTime
            await dst.provider.send('evm_mine', []); 



            // User withdraws from destination escrow
            console.log("secret",secret)
            console.log('💰 User withdrawing from destination escrow...')
            await dstChainResolver.send(
                resolverInstance.withdraw('dst', dstEscrowAddress, secret, dstImmutables.withDeployedAt(dstDeployedAt))
            )

            console.log('💰 User withdrawl complete from destination escrow...')


             // resolver claims the funds on sui chain

             console.log("resolver claiming funds on Sui chain ")
             const claim = await claimHTLCsrc(htlcId, secret)
             console.log("resolver claimed funds on Sui chain ")




            console.log('Cross-chain swap completed successfully! 🎉');
        })
    })
})

async function initChain(
    cnf: ChainConfig
): Promise<{node?: CreateServerReturnType; provider: JsonRpcProvider; escrowFactory: string; resolver: string}> {
    const {provider} = await getProvider(cnf);
    const deployer = new SignerWallet(cnf.ownerPrivateKey, provider);

    const factoryParams = [
        cnf.limitOrderProtocol,
        cnf.wrappedNative,
        Address.fromBigInt(0n).toString(),
        deployer.address,
        60 * 30,
        60 * 30
    ];

    const escrowFactory = await deploy(
        factoryContract,
        factoryParams,
        provider,
        deployer
    );
    console.log(`[${cnf.chainId}]`, `Escrow factory contract deployed to`, escrowFactory)



    const resolverParams = [
        escrowFactory,
        cnf.limitOrderProtocol,
        computeAddress(resolverPk)
    ];

    const resolver = await deploy(
        resolverContract,
        resolverParams,
        provider,
        deployer
    );
    console.log(`[${cnf.chainId}]`, `Resolver contract deployed to`, resolver)


    return {provider, resolver, escrowFactory};
}

async function getProvider(cnf: ChainConfig): Promise<{provider: JsonRpcProvider}> {
    const provider = new JsonRpcProvider(cnf.url, cnf.chainId, {
        cacheTimeout: -1,
        staticNetwork: true
    });

    return {provider};
}

async function deploy(
    json: {abi: any; bytecode: any},
    params: unknown[],
    provider: JsonRpcProvider,
    deployer: SignerWallet
): Promise<string> {
    const factory = new ContractFactory(json.abi, json.bytecode, deployer);
    const deployed = await factory.deploy(...params);
    await deployed.waitForDeployment();
    return await deployed.getAddress();
}