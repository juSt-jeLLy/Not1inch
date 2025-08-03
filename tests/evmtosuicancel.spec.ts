import 'dotenv/config'
import {expect, jest} from '@jest/globals'

import {CreateServerReturnType} from 'prool'

import { createHTLCDst, claimHTLCdst, recoverHTLC } from '../sui/clientpartial';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

import Sdk from '@1inch/cross-chain-sdk'
import {
    computeAddress,
    ContractFactory,
    JsonRpcProvider,
    MaxUint256,
    parseEther,
    parseUnits,
    randomBytes,
    Wallet as SignerWallet
} from 'ethers'
import {uint8ArrayToHex, UINT_40_MAX} from '@1inch/byte-utils'
import {ChainConfig, config} from './config1'
import {Wallet} from './wallet'
import {Resolver} from './resolver'
import {EscrowFactory} from './escrow-factory'
import factoryContract from '../dist/contracts/TestEscrowFactory.sol/TestEscrowFactory.json'
import resolverContract from '../dist/contracts/Resolver.sol/Resolver.json'

const {Address} = Sdk

jest.setTimeout(1000 * 60 * 20)
const SUI_PRIVATE_KEY_USER = process.env.SUI_PRIVATE_KEY_USER!;

const suiKeypairUser = Ed25519Keypair.fromSecretKey(Buffer.from(SUI_PRIVATE_KEY_USER, 'hex'));
const suiAddressUser = suiKeypairUser.getPublicKey().toSuiAddress();
const userPk = '0x38c4aadf07a344bd5f5baedc7b43f11a9b863cdd16242f3b94a53541ad19fedc'
const resolverPk = '0x1d02f466767e86d82b6c647fc7be69dc1bc98931a99ac9666d8b591bb0cc1e66'

const DEPLOYED_CONTRACTS = {
    escrowFactory: '0xCB818a64DD9AA858b96D83ccA5A628fF5452f552', 
    resolver: '0xB103C05FE2451b9b09dbE45Ad78e0C294DD22AaA'      
}

// eslint-disable-next-line max-lines-per-function
describe('Resolving example', () => {
    const srcChainId = config.chain.source.chainId
    const dstChainId = config.chain.destination.chainId

    type Chain = {
        node?: CreateServerReturnType | undefined
        provider: JsonRpcProvider
        escrowFactory: string
        resolver: string
    }

    let src: Chain
    let dst: Chain

    let srcChainUser: Wallet
    let srcChainResolver: Wallet

    let srcFactory: EscrowFactory
    let srcResolverContract: Wallet

    let srcTimestamp: bigint

    async function increaseTime(t: number): Promise<void> {
        await src.provider.send('evm_increaseTime', [t])
    }

    beforeAll(async () => {
src = await initChain(config.chain.source)

        srcChainUser = new Wallet(userPk, src.provider)
        srcChainResolver = new Wallet(resolverPk, src.provider)

        srcFactory = new EscrowFactory(src.provider, src.escrowFactory)
        // get 1000 USDC for user in SRC chain and approve to LOP
        await srcChainUser.approveToken(
            config.chain.source.tokens.USDC.address,
            config.chain.source.limitOrderProtocol,
            MaxUint256
        )

        // top up resolver contract for approve
        // On live networks, cannot impersonate resolver contract. If resolver is EOA and you have the key, use new Wallet(resolverPk, src.provider). Otherwise, ensure resolver contract is funded and approved externally.
        srcResolverContract = new Wallet(resolverPk, src.provider)
        await srcChainResolver.transfer(src.resolver, parseEther('1'))
        await srcResolverContract.unlimitedApprove(config.chain.source.tokens.USDC.address, src.escrowFactory)

        srcTimestamp = BigInt((await src.provider.getBlock('latest'))!.timestamp)
    })

    async function getBalances(
        srcToken: string
    ): Promise<{src: {user: bigint; resolver: bigint}}> {
        return {
            src: {
                user: await srcChainUser.tokenBalance(srcToken),
                resolver: await srcResolverContract.tokenBalance(srcToken)
            }
        }
    }

    afterAll(async () => {
        // No cleanup needed for live RPC
    })

    // eslint-disable-next-line max-lines-per-function
    describe('Fill', () => {
        it('should swap Ethereum USDC 100 -> SUI 0.05 . Single fill only', async () => {
            const initialBalances = await getBalances(
                config.chain.source.tokens.USDC.address
                
            )

            // User creates order
            const secret = uint8ArrayToHex(randomBytes(32)) // note: use crypto secure random number in real world
            const hashLock = Sdk.HashLock.forSingleFill(secret);
            console.log('hashLock:', hashLock);
            const order = Sdk.CrossChainOrder.new(
                new Address(src.escrowFactory),
                {
                    salt: Sdk.randBigInt(1000n),
                    maker: new Address(await srcChainUser.getAddress()),
                    makingAmount: parseUnits('100', 6),
                    takingAmount: parseUnits('100', 6),
                    makerAsset: new Address(config.chain.source.tokens.USDC.address),
                    takerAsset: new Address(config.chain.source.tokens.USDC.address)
                },
                {
                    hashLock: hashLock,
                    timeLocks: Sdk.TimeLocks.new({
                        srcWithdrawal: 10n, // 10sec finality lock for test
                        srcPublicWithdrawal: 120n, // 2m for private withdrawal
                        srcCancellation: 121n, // 1sec public withdrawal
                        srcPublicCancellation: 122n, // 1sec private cancellation
                        dstWithdrawal: 10n, // 10sec finality lock for test
                        dstPublicWithdrawal: 100n, // 100sec private withdrawal
                        dstCancellation: 101n // 1sec public withdrawal
                    }),
                    srcChainId,
                    dstChainId,
                    srcSafetyDeposit: parseEther('0.001'),
                    dstSafetyDeposit: parseEther('0.001')
                },
                {
                    auction: new Sdk.AuctionDetails({
                        initialRateBump: 0,
                        points: [],
                        duration: 120n,
                        startTime: srcTimestamp
                    }),
                    whitelist: [
                        {
                            address: new Address(src.resolver),
                            allowFrom: 0n
                        }
                    ],
                    resolvingStartTime: 0n
                },
                {
                    nonce: Sdk.randBigInt(UINT_40_MAX),
                    allowPartialFills: false,
                    allowMultipleFills: false
                }
            )

            const signature = await srcChainUser.signOrder(srcChainId, order)
            const orderHash = order.getOrderHash(srcChainId)
            const orderid = orderHash.toString();
            // Resolver fills order
            console.log(`[${srcChainId}]`, `User created order ${orderHash} on src chain`)
            console.log(`[${srcChainId}]`, `Filling order ${orderHash}`)

            const resolverContract = new Resolver(src.resolver, src.resolver) // src.resolver is both src and dst resolver

            const fillAmount = order.makingAmount
            const {txHash: orderFillHash, blockHash: srcDeployBlock} = await srcChainResolver.send(
                resolverContract.deploySrc(
                    srcChainId,
                    order,
                    signature,
                    Sdk.TakerTraits.default()
                        .setExtension(order.extension)
                        .setAmountMode(Sdk.AmountMode.maker)
                        .setAmountThreshold(order.takingAmount),
                    fillAmount
                )
            )
            console.log(`[${srcChainId}]`, `Order ${orderHash} filled for ${fillAmount} in tx ${orderFillHash}`)

            const srcEscrowEvent = await srcFactory.getSrcDeployEvent(srcDeployBlock)
            console.log(`[${srcChainId}]`, `Source escrow created`)

            // --- SUI SIDE LOGIC ---
            const hash = hashLock.toString();
            console.log("creating htlcDst contract on the SUI chain")
            const create_htlc_escrow_dst = await createHTLCDst(hash, suiAddressUser,orderid)
            
            if (!create_htlc_escrow_dst) {
                throw new Error('HTLC objectId not found in createHTLCDst result');
            }
            const htlcId_safety = create_htlc_escrow_dst;
            console.log("HTLCId",htlcId_safety);
            console.log("HtlcDst created on the SUI chain")
            

            
            // --- END SUI SIDE LOGIC ---

            const ESCROW_SRC_IMPLEMENTATION = await srcFactory.getSourceImpl()
            const srcEscrowAddress = new Sdk.EscrowFactory(new Address(src.escrowFactory)).getSrcEscrowAddress(
                srcEscrowEvent[0],
                ESCROW_SRC_IMPLEMENTATION
            )

            await increaseTime(11)
            // User shares key after validation of dst escrow deployment

            console.log("secret: ",secret)

            console.log("recovering htlc")
            const recover_htlc = await recoverHTLC(htlcId_safety)
            console.log("recovered htlc")


            console.log(`[${srcChainId}]`, `Cancelling src escrow ${srcEscrowAddress}`)
            const {txHash: cancelSrcEscrow} = await srcChainResolver.send(
                resolverContract.cancel('src', srcEscrowAddress, srcEscrowEvent[0])
            )
            console.log(`[${srcChainId}]`, `Cancelled src escrow ${srcEscrowAddress} in tx ${cancelSrcEscrow}`)

            // Sweep all USDC from resolver contract to resolver EOA
            const resolverEOA = await srcChainResolver.getAddress();
            const sweepUSDC = resolverContract.sweep(config.chain.source.tokens.USDC.address, resolverEOA);
            await srcChainResolver.send(sweepUSDC);
            // Sweep all ETH from resolver contract to resolver EOA
            const sweepETH = resolverContract.sweep('0x0000000000000000000000000000000000000000', resolverEOA);
            await srcChainResolver.send(sweepETH);

            const resultBalances = await getBalances(
                config.chain.source.tokens.USDC.address
            )

            // user transferred funds to resolver on source chain
            expect(initialBalances.src.user - resultBalances.src.user).toBe(order.makingAmount)
            expect(resultBalances.src.resolver - initialBalances.src.resolver).toBe(order.makingAmount)
            // resolver transferred funds to user on destination chain (SUI)
            // (SUI side is checked by the SUI helper, not by EVM balance)
        })
    })
})



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



async function initChain(
    cnf: ChainConfig
): Promise<{node?: CreateServerReturnType; provider: JsonRpcProvider; escrowFactory: string; resolver: string}> {
    const {provider} = await getProvider(cnf)
    const deployer = new SignerWallet(cnf.ownerPrivateKey, provider)

    // deploy EscrowFactory
    const escrowFactory = await deploy(
        factoryContract,
        [
            cnf.limitOrderProtocol,
            cnf.wrappedNative, // feeToken,
            Address.fromBigInt(0n).toString(), // accessToken,
            deployer.address, // owner
            60 * 30, // src rescue delay
            60 * 30 // dst rescue delay
        ],
        provider,
        deployer
    )
    console.log(`[${cnf.chainId}]`, `Escrow factory contract deployed to`, escrowFactory)

    // deploy Resolver contract
    const resolver = await deploy(
        resolverContract,
        [
            escrowFactory,
            cnf.limitOrderProtocol,
            computeAddress(resolverPk) // resolver as owner of contract
        ],
        provider,
        deployer
    )
    console.log(`[${cnf.chainId}]`, `Resolver contract deployed to`, resolver)

    return {provider, resolver, escrowFactory}
}

async function getProvider(cnf: ChainConfig): Promise<{provider: JsonRpcProvider}> {
    // Always use live RPC URL from config
    return {
        provider: new JsonRpcProvider(cnf.url, cnf.chainId, {
            cacheTimeout: -1,
            staticNetwork: true
        })
    }
}

/**
 * Deploy contract and return its address
 */
async function deploy(
    json: {abi: any; bytecode: any},
    params: unknown[],
    provider: JsonRpcProvider,
    deployer: SignerWallet
): Promise<string> {
    const deployed = await new ContractFactory(json.abi, json.bytecode, deployer).deploy(...params)
    await deployed.waitForDeployment()

    return await deployed.getAddress()
}
