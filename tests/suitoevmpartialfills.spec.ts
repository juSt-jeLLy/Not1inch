import 'dotenv/config'
import {expect, jest} from '@jest/globals'

import {CreateServerReturnType} from 'prool'
import { claimHTLCsrc, announceStandardOrder,auctionTickpartial,fillOrderPartial,createHTLCSrcPartial, addSafetyDeposit,partialAnnounceOrder, claimHTLCsrcpartial  } from '../sui/clientpartial';
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
import { fillOrder } from '../sui/client-export';

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';


const {Address, HashLock, TimeLocks, Immutables} = Sdk

jest.setTimeout(1000 * 60 * 20)

const userPk = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
const resolverPk = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'
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
            const secrets = Array.from({length: 11}).map(() => uint8ArrayToHex(randomBytes(32))) // note: use crypto secure random number in the real world
            const secretHashes = secrets.map((s) => Sdk.HashLock.hashSecret(s))
            const leaves = Sdk.HashLock.getMerkleLeaves(secrets)
            const hashLock = Sdk.HashLock.forMultipleFills(leaves)
            const hash = hashLock.toString();
            console.log('hashLock:', hashLock);
            const totalOrderAmount = 100_000_000;
            const secret = secrets[10]
            


            const idx = Number((BigInt(secrets.length - 1)))

            // user craetes order on the sui chain
           

            console.log("user announcing order on Sui chain ")

            const { orderId: partialOrderId, merkleData } = await partialAnnounceOrder(totalOrderAmount,idx,hash)
            
            console.log("Partial Order Announced ID:", partialOrderId);

            if (!partialOrderId) {
                throw new Error('Partial Order ID is undefined');
            }




            console.log("DUCH AUCTION STARTED Sui chain ")
            const duchAuction = await auctionTickpartial(partialOrderId)
            console.log("Auction ticked successfully. Current price:", duchAuction);  

            // Note: Partial orders don't support auction ticking
            // console.log("DUCH AUCTION STARTED Sui chain ")
            // const duchAuction = await auctionTick(partialOrderId)
            // console.log("Auction ticked successfully. Current price:", duchAuction);

            //resolver fills the order
            console.log("resolver fill order on Sui chain ")
            const fillAmount1 = totalOrderAmount / idx;
            const targetIndex1 = 10;


            const fill_order_partial = await fillOrderPartial(partialOrderId, fillAmount1, merkleData, targetIndex1)

            console.log("order filled on Sui chain ")




            // create HTLCsrc on Sui chain
            console.log("create HTLCsrc on Sui chain ")

            const htlcSrc = await createHTLCSrcPartial(partialOrderId,hash, suiAddressResolver,targetIndex1)
            if (!htlcSrc) throw new Error('htlcSrc is undefined');
            const htlcId = htlcSrc.toString();
            if (!htlcId) throw new Error('htlcId is undefined');
            console.log("htlcid",htlcId)

            console.log("HTLCsrc created on Sui chain ")

            //resolver adds safety deposit
            console.log("resolver adds safety deposit on Sui chain ")
            const addSafetydeposit = await addSafetyDeposit(htlcId, suiKeypairResolver)
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
            console.log("secret",secrets[10])
            console.log('💰 User withdrawing from destination escrow...')
            await dstChainResolver.send(
                resolverInstance.withdraw('dst', dstEscrowAddress, secret, dstImmutables.withDeployedAt(dstDeployedAt))
            )

            console.log('💰 User withdrawl complete from destination escrow...')


             // resolver claims the funds on sui chain

             console.log("resolver claiming funds on Sui chain ")

             const claim = await claimHTLCsrcpartial(htlcId, secrets)
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